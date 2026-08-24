import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { SourceFanoutRequest } from './types.js';

export type SourceTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface SourceFanoutPublisher {
  publish(request: SourceFanoutRequest, requestedAt: string, reconciliationId?: string): Promise<boolean>;
  mark(sourceId: string, taskKey: string, status: SourceTaskStatus, at: string, error?: string): Promise<void>;
}

function sourceFamily(sourceId: string): string {
  return sourceId.split('-')[0] || sourceId;
}

function taskKey(sourceId: string, key: string) {
  return { pk: `BOOTSTRAP#${sourceFamily(sourceId)}`, sk: `TASK#${key}` };
}

function isoWeek(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}W${String(week).padStart(2, '0')}`;
}

function dedupeKey(request: SourceFanoutRequest, requestedAt: string): string {
  if (!request.sourceId.startsWith('lemonrock-')) return request.taskKey;
  const date = new Date(requestedAt);
  if (Number.isNaN(date.getTime())) return request.taskKey;

  // Gig detail is intentionally refreshable every hour so an explicit same-day
  // cancellation or changed time is not suppressed by bootstrap dedupe.
  if (request.sourceId === 'lemonrock-gig-hydration') {
    return `${request.taskKey}@${date.toISOString().slice(0, 13)}`;
  }

  // Rich artist/venue profiles change more slowly; one hydration per ISO week is
  // enough during national reconciliation while still allowing future refreshes.
  if (request.sourceId === 'lemonrock-artist-hydration' || request.sourceId === 'lemonrock-venue-hydration') {
    return `${request.taskKey}@${isoWeek(date)}`;
  }

  // Directory/county child pages are replayable daily. Within a bootstrap run,
  // duplicate links from multiple indexes collapse onto one durable task.
  return `${request.taskKey}@${date.toISOString().slice(0, 10)}`;
}

export class DynamoSqsSourceFanoutPublisher implements SourceFanoutPublisher {
  private readonly ddb: DynamoDBDocumentClient;
  private readonly sqs: SQSClient;

  constructor(
    private readonly tableName: string,
    private readonly queueUrl: string,
    ddb?: DynamoDBDocumentClient,
    sqs?: SQSClient,
  ) {
    this.ddb = ddb ?? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.sqs = sqs ?? new SQSClient({});
  }

  async publish(request: SourceFanoutRequest, requestedAt: string, reconciliationId?: string): Promise<boolean> {
    const resolvedTaskKey = dedupeKey(request, requestedAt);
    const key = taskKey(request.sourceId, resolvedTaskKey);
    try {
      await this.ddb.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          ...key,
          entityType: 'SourceTask',
          sourceFamily: sourceFamily(request.sourceId),
          sourceId: request.sourceId,
          taskKey: resolvedTaskKey,
          logicalTaskKey: request.taskKey,
          taskKind: typeof request.task.kind === 'string' ? request.task.kind : 'unknown',
          sourceUrl: typeof request.task.url === 'string' ? request.task.url : undefined,
          task: request.task,
          status: 'queued',
          queuedAt: requestedAt,
          lastDiscoveredAt: requestedAt,
          reconciliationId,
          lastReconciliationId: reconciliationId,
          updatedAt: requestedAt,
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      }));
    } catch (error) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        const values: Record<string, unknown> = { ':at': requestedAt };
        let update = 'SET lastDiscoveredAt = :at, updatedAt = :at';
        if (reconciliationId) {
          update += ', lastReconciliationId = :reconciliationId';
          values[':reconciliationId'] = reconciliationId;
        }
        await this.ddb.send(new UpdateCommand({
          TableName: this.tableName,
          Key: key,
          UpdateExpression: update,
          ExpressionAttributeValues: values,
        }));
        return false;
      }
      throw error;
    }

    try {
      await this.sqs.send(new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({
          sourceId: request.sourceId,
          reason: 'manual',
          requestedAt,
          reconciliationId,
          taskKey: resolvedTaskKey,
          task: request.task,
        }),
      }));
      return true;
    } catch (error) {
      await this.ddb.send(new DeleteCommand({ TableName: this.tableName, Key: key }));
      throw error;
    }
  }

  async mark(sourceId: string, keyText: string, status: SourceTaskStatus, at: string, error?: string): Promise<void> {
    const key = taskKey(sourceId, keyText);
    const names: Record<string, string> = { '#status': 'status' };
    const values: Record<string, unknown> = { ':status': status, ':at': at };
    let update = 'SET #status = :status, updatedAt = :at';
    if (status === 'running') update += ', startedAt = if_not_exists(startedAt, :at)';
    if (status === 'completed') update += ', completedAt = :at';
    if (status === 'failed') {
      update += ', failedAt = :at, lastError = :error';
      values[':error'] = error ?? 'Unknown failure';
    }
    await this.ddb.send(new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: update,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
  }
}
