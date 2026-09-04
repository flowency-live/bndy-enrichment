import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { BndyEnrichmentStack } from '../lib/bndy-enrichment-stack.js';

type TemplateResource = {
  Type: string;
  Properties?: Record<string, unknown>;
};

function synthesise(canonicalChangeStreamsEnabled: boolean): Record<string, TemplateResource> {
  const app = new App({
    context: {
      canonicalChangeStreamsEnabled,
      'aws:cdk:bundling-stacks': [],
    },
  });
  const stack = new BndyEnrichmentStack(app, 'BndyEnrichmentStack', {
    env: { account: '123456789012', region: 'eu-west-2' },
  });
  return Template.fromStack(stack).toJSON().Resources as Record<string, TemplateResource>;
}

function resourcesOfType(
  resources: Record<string, TemplateResource>,
  type: string,
): Array<[string, TemplateResource]> {
  return Object.entries(resources).filter(([, resource]) => resource.Type === type);
}

function applicationFunction(
  resources: Record<string, TemplateResource>,
  logicalIdPrefix: string,
): TemplateResource {
  const match = resourcesOfType(resources, 'AWS::Lambda::Function')
    .find(([logicalId]) => logicalId.startsWith(logicalIdPrefix));
  expect(match, `missing ${logicalIdPrefix} Lambda`).toBeDefined();
  return match![1];
}

describe('Backline stack reliability controls', () => {
  let defaultResources: Record<string, TemplateResource>;
  let canonicalChangeResources: Record<string, TemplateResource>;

  beforeAll(() => {
    defaultResources = synthesise(false);
    canonicalChangeResources = synthesise(true);
  }, 60_000);

  it('retains every default application Lambda log group for 30 days', () => {
    const retentionResources = resourcesOfType(defaultResources, 'Custom::LogRetention');
    expect(retentionResources).toHaveLength(12);
    expect(retentionResources.every(([, resource]) => resource.Properties?.RetentionInDays === 30)).toBe(true);
  });

  it('also covers the opt-in canonical-change worker without enabling it by default', () => {
    expect(resourcesOfType(canonicalChangeResources, 'Custom::LogRetention')).toHaveLength(13);
    expect(resourcesOfType(defaultResources, 'AWS::Lambda::Function')
      .some(([logicalId]) => logicalId.startsWith('CanonicalChangeStreamWorker'))).toBe(false);
    expect(resourcesOfType(canonicalChangeResources, 'AWS::Lambda::Function')
      .some(([logicalId]) => logicalId.startsWith('CanonicalChangeStreamWorker'))).toBe(true);
  });

  it('synthesises the 24-alarm default reliability baseline', () => {
    const alarms = resourcesOfType(defaultResources, 'AWS::CloudWatch::Alarm');
    const countMetric = (metricName: string) => alarms
      .filter(([, resource]) => resource.Properties?.MetricName === metricName)
      .length;

    expect(alarms).toHaveLength(24);
    expect(countMetric('Errors')).toBe(12);
    expect(countMetric('ApproximateNumberOfMessagesVisible')).toBe(6);
    expect(countMetric('ApproximateAgeOfOldestMessage')).toBe(6);
    expect(alarms.every(([, resource]) => resource.Properties?.TreatMissingData === 'notBreaching')).toBe(true);
  });

  it('alarms immediately on worker errors and operational DLQ messages', () => {
    const alarms = resourcesOfType(defaultResources, 'AWS::CloudWatch::Alarm');
    const immediateMetrics = new Set(['Errors', 'ApproximateNumberOfMessagesVisible']);
    const immediateAlarms = alarms.filter(([, resource]) => immediateMetrics.has(String(resource.Properties?.MetricName)));

    expect(immediateAlarms).toHaveLength(18);
    expect(immediateAlarms.every(([, resource]) => (
      resource.Properties?.Threshold === 1
      && resource.Properties?.EvaluationPeriods === 1
    ))).toBe(true);
  });

  it('requires two consecutive periods before declaring active work stale', () => {
    const queueAgeAlarms = resourcesOfType(defaultResources, 'AWS::CloudWatch::Alarm')
      .filter(([, resource]) => resource.Properties?.MetricName === 'ApproximateAgeOfOldestMessage');
    const thresholds = queueAgeAlarms
      .map(([, resource]) => Number(resource.Properties?.Threshold))
      .sort((left, right) => left - right);

    expect(queueAgeAlarms).toHaveLength(6);
    expect(queueAgeAlarms.every(([, resource]) => (
      resource.Properties?.EvaluationPeriods === 2
      && resource.Properties?.DatapointsToAlarm === 2
    ))).toBe(true);
    expect(thresholds).toEqual([900, 900, 1800, 1800, 1800, 1800]);
  });

  it('caps source, paid, browser and projection concurrency at two', () => {
    for (const logicalIdPrefix of [
      'SourceWorker',
      'BrowserSourceWorker',
      'ProjectionWorker',
      'GoogleDiscoveryWorker',
      'CaptureProcessor',
    ]) {
      expect(applicationFunction(defaultResources, logicalIdPrefix).Properties?.ReservedConcurrentExecutions).toBe(2);
    }

    const mappings = resourcesOfType(defaultResources, 'AWS::Lambda::EventSourceMapping');
    expect(mappings.filter(([, resource]) => (
      (resource.Properties?.ScalingConfig as Record<string, unknown> | undefined)?.MaximumConcurrency === 2
    ))).toHaveLength(5);
  });

  it('does not alarm on the retained historical source-failure quarantine', () => {
    const serialisedAlarms = JSON.stringify(resourcesOfType(defaultResources, 'AWS::CloudWatch::Alarm'));
    expect(serialisedAlarms).not.toContain('HistoricalSourceFailureQuarantine');
  });
});
