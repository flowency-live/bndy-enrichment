import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TombstoneSchema, type Tombstone, type TombstoneStatus } from '../types.js';
import { createDynamoStoreClient, type DynamoStoreClient } from './clients.js';

function tombstonePk(artistId: string, venueId: string, date: string): string {
  return `TOMBSTONE#${artistId}#${venueId}#${date}`;
}

export class TombstoneStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async put(tombstone: Tombstone): Promise<void> {
    const parsed = TombstoneSchema.parse(tombstone);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: tombstonePk(parsed.artistId, parsed.venueId, parsed.date),
        sk: 'META',
        entityType: 'Tombstone',
        ...parsed,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
  }

  async get(artistId: string, venueId: string, date: string): Promise<Tombstone | null> {
    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: tombstonePk(artistId, venueId, date), sk: 'META' },
    }));
    return response.Item ? TombstoneSchema.parse(response.Item) : null;
  }

  async updateLifecycle(
    artistId: string,
    venueId: string,
    date: string,
    status: TombstoneStatus,
    options: { supersededAt?: string; supersededByClaimId?: string } = {},
  ): Promise<void> {
    const names: Record<string, string> = { '#status': 'status' };
    const values: Record<string, unknown> = { ':status': status };
    const updates = ['#status = :status'];

    if (options.supersededAt) {
      names['#supersededAt'] = 'supersededAt';
      values[':supersededAt'] = options.supersededAt;
      updates.push('#supersededAt = :supersededAt');
    }
    if (options.supersededByClaimId) {
      names['#supersededByClaimId'] = 'supersededByClaimId';
      values[':supersededByClaimId'] = options.supersededByClaimId;
      updates.push('#supersededByClaimId = :supersededByClaimId');
    }

    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { pk: tombstonePk(artistId, venueId, date), sk: 'META' },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(pk)',
    }));
  }
}
