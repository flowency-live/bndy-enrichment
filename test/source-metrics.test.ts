import { describe, expect, it } from 'vitest';
import { DynamoSourceRunMetricStore, sourceFamily } from '../src/sources/runner/metrics.js';
import type { SourceRunReport } from '../src/sources/runner/types.js';

function report(overrides: Partial<SourceRunReport> = {}): SourceRunReport {
  return {
    runId: 'run-1', sourceId: 'lemonrock-new-gigs', reconciliationId: 'rec-1',
    startedAt: '2026-08-27T10:00:00.000Z', completedAt: '2026-08-27T10:00:02.500Z',
    status: 'completed', reason: 'scheduled', observationId: 'obs-1', complete: true,
    rawItems: 8, validEvents: 5, entityProfiles: 2, parked: 1, claims: 30,
    added: 2, updated: 1, withdrawn: 0, unchanged: 2, projectionWorkItems: 0, reobservedUnchanged: 0, projectionSkipped: 0,
    fanoutQueued: 3, fanoutDuplicates: 1, shadow: true, writerAuthority: 'aws',
    warnings: ['fixture warning'], errors: [], artifacts: { report: 'runs/report.json' },
    ...overrides,
  };
}

describe('Backline source run metrics', () => {
  it('keeps known multi-word sources in one family', () => {
    expect(sourceFamily('gigs-news')).toBe('gigs-news');
    expect(sourceFamily('gigs-news-weekly')).toBe('gigs-news');
    expect(sourceFamily('lemonrock-new-gigs')).toBe('lemonrock');
  });

  it('writes a drill-down run row and atomic daily roll-up', async () => {
    const commands: any[] = [];
    const ddb = { async send(command: any) { commands.push(command); return {}; } } as any;
    const store = new DynamoSourceRunMetricStore('state-table', ddb);
    await store.put(report());

    expect(commands).toHaveLength(2);
    expect(commands[0].input.Item).toMatchObject({
      pk: 'SOURCE_METRICS#lemonrock',
      sk: 'RUN#2026-08-27T10:00:02.500Z#run-1',
      entityType: 'SourceRunMetric',
      metricDay: '2026-08-27',
      durationMs: 2500,
      added: 2,
      fanoutQueued: 3,
      reportKey: 'runs/report.json',
    });
    expect(commands[1].input.Key).toEqual({
      pk: 'SOURCE_METRICS#lemonrock', sk: 'DAY#2026-08-27',
    });
    expect(commands[1].input.UpdateExpression).toContain('ADD #runs :one');
    expect(commands[1].input.ExpressionAttributeValues).toMatchObject({
      ':completedRun': 1,
      ':failedRun': 0,
      ':added': 2,
      ':claims': 30,
    });
  });
});
