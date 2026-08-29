import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { BaselineEntityType } from './mapper.js';
import { createDynamoStoreClient, type DynamoStoreClient } from '../knowledge/stores/clients.js';

export type CanonicalSyncState = {
  entityType: BaselineEntityType;
  canonicalId: string;
  contentHash: string;
  removed: boolean;
  changeId: string;
  observedAt: string;
};

export function canonicalSyncStateItem(state: CanonicalSyncState): Record<string, unknown> {
  return {
    pk: `CANONICAL_SYNC#${state.entityType}#${state.canonicalId}`,
    sk: 'STATE',
    entityType: 'CanonicalSyncState',
    canonicalEntityType: state.entityType,
    canonicalId: state.canonicalId,
    contentHash: state.contentHash,
    removed: state.removed,
    changeId: state.changeId,
    observedAt: state.observedAt,
  };
}

export class CanonicalSyncStateStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async get(entityType: BaselineEntityType, canonicalId: string): Promise<CanonicalSyncState | null> {
    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: `CANONICAL_SYNC#${entityType}#${canonicalId}`, sk: 'STATE' },
      ConsistentRead: true,
    }));
    if (!response.Item) return null;
    const item = response.Item;
    if (typeof item.contentHash !== 'string' || typeof item.changeId !== 'string' || typeof item.observedAt !== 'string') {
      throw new Error(`Invalid canonical sync state for ${entityType}:${canonicalId}`);
    }
    return {
      entityType,
      canonicalId,
      contentHash: item.contentHash,
      removed: item.removed === true,
      changeId: item.changeId,
      observedAt: item.observedAt,
    };
  }

  async put(state: CanonicalSyncState): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: canonicalSyncStateItem(state) }));
  }
}
