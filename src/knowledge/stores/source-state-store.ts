import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoStoreClient, type DynamoStoreClient } from './clients.js';

export type SourceRuntimeState = {
  sourceId: string;
  lastObservationId?: string;
  lastCompleteObservationId?: string;
  lastRunAt?: string;
  lastSuccessfulRunAt?: string;
  lastFailureAt?: string;
  consecutiveFailures: number;
  cursor?: string;
  metadata?: Record<string, unknown>;
};

export class SourceStateStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async get(sourceId: string): Promise<SourceRuntimeState | null> {
    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: `SOURCE#${sourceId}`, sk: 'STATE' },
    }));

    if (!response.Item) return null;
    const item = response.Item;
    return {
      sourceId: String(item.sourceId ?? sourceId),
      lastObservationId: typeof item.lastObservationId === 'string' ? item.lastObservationId : undefined,
      lastCompleteObservationId: typeof item.lastCompleteObservationId === 'string' ? item.lastCompleteObservationId : undefined,
      lastRunAt: typeof item.lastRunAt === 'string' ? item.lastRunAt : undefined,
      lastSuccessfulRunAt: typeof item.lastSuccessfulRunAt === 'string' ? item.lastSuccessfulRunAt : undefined,
      lastFailureAt: typeof item.lastFailureAt === 'string' ? item.lastFailureAt : undefined,
      consecutiveFailures: typeof item.consecutiveFailures === 'number' ? item.consecutiveFailures : 0,
      cursor: typeof item.cursor === 'string' ? item.cursor : undefined,
      metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata as Record<string, unknown> : undefined,
    };
  }

  async put(state: SourceRuntimeState): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: `SOURCE#${state.sourceId}`,
        sk: 'STATE',
        entityType: 'SourceState',
        ...state,
      },
    }));
  }
}
