import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { TrustLoopRunSchema, type TrustLoopRun } from './types.js';
import { createDynamoStoreClient, type DynamoStoreClient } from '../knowledge/stores/clients.js';

export function trustLoopRunItem(run: TrustLoopRun): Record<string, unknown> {
  const parsed = TrustLoopRunSchema.parse(run);
  return {
    pk: 'TRUST_LOOP',
    sk: `RUN#${parsed.completedAt}#${parsed.id}`,
    entityType: 'TrustLoopRun',
    ...parsed,
    // Full decisions are durable Resolution items and their Claims remain in
    // the Claim store. The run item keeps the bounded human review projection.
    decisions: [],
    enrichmentAssessments: [],
  };
}

export class TrustLoopRunStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async put(run: TrustLoopRun): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: trustLoopRunItem(run) }));
  }

  async listRecent(limit = 10): Promise<TrustLoopRun[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': 'TRUST_LOOP', ':prefix': 'RUN#' },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (response.Items ?? []).map((item) => TrustLoopRunSchema.parse(item));
  }
}
