import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { SourceRunReport } from './types.js';

const RUN_RETENTION_DAYS = 180;
const DAY_RETENTION_DAYS = 400;

export interface SourceRunMetricStore {
  put(report: SourceRunReport): Promise<void>;
}

export function sourceFamily(sourceId: string): string {
  if (sourceId === 'gigs-news' || sourceId.startsWith('gigs-news-')) return 'gigs-news';
  return sourceId.split('-')[0] || sourceId;
}

function expiresAt(completedAt: string, days: number): number {
  const completed = Date.parse(completedAt);
  const base = Number.isFinite(completed) ? completed : Date.now();
  return Math.floor((base + days * 86_400_000) / 1_000);
}

function durationMs(report: SourceRunReport): number {
  const value = Date.parse(report.completedAt) - Date.parse(report.startedAt);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export class DynamoSourceRunMetricStore implements SourceRunMetricStore {
  private readonly ddb: DynamoDBDocumentClient;

  constructor(private readonly tableName: string, ddb?: DynamoDBDocumentClient) {
    this.ddb = ddb ?? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async put(report: SourceRunReport): Promise<void> {
    const family = sourceFamily(report.sourceId);
    const day = report.completedAt.slice(0, 10);
    const pk = `SOURCE_METRICS#${family}`;
    const numeric = {
      rawItems: report.rawItems,
      validEvents: report.validEvents,
      entityProfiles: report.entityProfiles,
      parked: report.parked,
      claims: report.claims,
      added: report.added,
      updated: report.updated,
      withdrawn: report.withdrawn,
      unchanged: report.unchanged,
      projectionWorkItems: report.projectionWorkItems,
      fanoutQueued: report.fanoutQueued,
      fanoutDuplicates: report.fanoutDuplicates,
      warnings: report.warnings.length,
      errors: report.errors.length,
      durationMs: durationMs(report),
    };

    await this.ddb.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk,
        sk: `RUN#${report.completedAt}#${report.runId}`,
        entityType: 'SourceRunMetric',
        sourceFamily: family,
        metricDay: day,
        sourceId: report.sourceId,
        runId: report.runId,
        reconciliationId: report.reconciliationId,
        startedAt: report.startedAt,
        completedAt: report.completedAt,
        status: report.status,
        reason: report.reason,
        complete: report.complete,
        shadow: report.shadow,
        writerAuthority: report.writerAuthority,
        reportKey: report.artifacts.report,
        ...numeric,
        expiresAt: expiresAt(report.completedAt, RUN_RETENTION_DAYS),
      },
    }));

    const counters: Record<string, number> = {
      ':one': 1,
      ':completedRun': report.status === 'completed' ? 1 : 0,
      ':failedRun': report.status === 'failed' ? 1 : 0,
      ...Object.fromEntries(Object.entries(numeric).map(([key, value]) => [`:${key}`, value])),
    };
    const counterNames = Object.keys(numeric);
    const add = [
      '#runs :one',
      '#completedRuns :completedRun',
      '#failedRuns :failedRun',
      ...counterNames.map((key) => `#${key} :${key}`),
    ].join(', ');

    await this.ddb.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { pk, sk: `DAY#${day}` },
      UpdateExpression: `SET entityType = :entityType, sourceFamily = :family, metricDay = :day,
        lastRunId = :runId, lastSourceId = :sourceId, lastCompletedAt = :completedAt,
        lastStatus = :status, lastReportKey = :reportKey, expiresAt = :expiresAt
        ADD ${add}`,
      ExpressionAttributeNames: {
        '#runs': 'runs',
        '#completedRuns': 'completedRuns',
        '#failedRuns': 'failedRuns',
        ...Object.fromEntries(counterNames.map((key) => [`#${key}`, key])),
      },
      ExpressionAttributeValues: {
        ':entityType': 'SourceDailyMetric',
        ':family': family,
        ':day': day,
        ':runId': report.runId,
        ':sourceId': report.sourceId,
        ':completedAt': report.completedAt,
        ':status': report.status,
        ':reportKey': report.artifacts.report ?? null,
        ':expiresAt': expiresAt(report.completedAt, DAY_RETENTION_DAYS),
        ...counters,
      },
    }));
  }
}
