import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { SourceFanoutRequest } from './types.js';

export type SourceTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface SourceFanoutPublisher {
  publish(request: SourceFanoutRequest, requestedAt: string): Promise<boolean>;
  mark(sourceId: string, taskKey: string, status: SourceTaskStatus, at: string, error?: string): Promise<void>;
}

function sourceFamily(sourceId: string): string {
  return sourceId.split('-')[0] || sourceId;
}

function taskKey(sourceId: string, key: string) {
  return { pk: `BOOTSTRAP#${sourceFamily(sourceId)}`, sk: `TASK#${key}` };
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
    this.ddb = ddb ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.sqs = sqs ?? new SQSClient({});
  }

  async publish(request: SourceFanoutRequest, requestedAt: string): Promise<boolean> {
    const key = taskKey(request.sourceId, request.taskKey);
    try {
      await this.ddb.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          ...key,
          entityType: 'SourceTask',
          sourceFamily: sourceFamily(request.sourceId),
          sourceId: request.sourceId,
          taskKey: request.taskKey,
          taskKind: typeof request.task.kind === 'string' ? request.task.kind : 'unknown',
          sourceUrl: typeof request.task.url === 'string' ? request.task.url : undefined,
          task: request.task,
          status: 'queued',
          queuedAt: requestedAt,
          updatedAt: requestedAt,
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      }));
    } catch (error) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') return false;
      throw error;
    }

    try {
      await this.sqs.send(new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({
          sourceId: request.sourceId,
          reason: 'manual',
          requestedAt,
          taskKey: request.taskKey,
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
