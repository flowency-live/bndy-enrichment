import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoStoreClient, type DynamoStoreClient } from '../knowledge/stores/clients.js';

export const PROJECTION_CONTROL_KEY = {
  pk: 'CONTROL#PROJECTION',
  sk: 'GLOBAL',
} as const;

export interface ProjectionControlStore {
  canonicalWritesEnabled(): Promise<boolean>;
}

export class DynamoProjectionControlStore implements ProjectionControlStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async canonicalWritesEnabled(): Promise<boolean> {
    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: PROJECTION_CONTROL_KEY,
      ConsistentRead: true,
      ProjectionExpression: 'canonicalWritesEnabled',
    }));
    return response.Item?.canonicalWritesEnabled === true;
  }
}
