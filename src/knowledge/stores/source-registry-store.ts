import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GigSourceSchema, type GigSource } from '../types.js';
import { createDynamoStoreClient, type DynamoStoreClient } from './clients.js';

export const SOURCE_SCHEDULE_INDEX = 'SourceScheduleIndex';

export class SourceRegistryStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async put(source: GigSource): Promise<void> {
    const item: Record<string, unknown> = {
      pk: `SOURCE#${source.id}`,
      sk: 'CONFIG',
      entityType: 'GigSource',
      ...source,
    };

    if (source.enabled && source.nextScanAt) {
      item.GSI_SCHEDULE_PK = 'SOURCE_SCHEDULE';
      item.GSI_SCHEDULE_SK = `${source.nextScanAt}#${source.id}`;
    }

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
    }));
  }

  async get(sourceId: string): Promise<GigSource | null> {
    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: `SOURCE#${sourceId}`, sk: 'CONFIG' },
    }));
    return response.Item ? GigSourceSchema.parse(response.Item) : null;
  }

  async queryDue(nowIso: string, limit = 100): Promise<GigSource[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: SOURCE_SCHEDULE_INDEX,
      KeyConditionExpression: 'GSI_SCHEDULE_PK = :pk AND GSI_SCHEDULE_SK <= :due',
      ExpressionAttributeValues: {
        ':pk': 'SOURCE_SCHEDULE',
        ':due': `${nowIso}#\uffff`,
      },
      ScanIndexForward: true,
      Limit: limit,
    }));

    return (response.Items ?? []).map((item) => GigSourceSchema.parse(item));
  }

  async advanceSchedule(
    sourceId: string,
    expectedNextScanAt: string,
    nextScanAt: string,
    scheduledAt: string,
  ): Promise<void> {
    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { pk: `SOURCE#${sourceId}`, sk: 'CONFIG' },
      UpdateExpression: [
        'SET nextScanAt = :next',
        'lastScheduledAt = :scheduled',
        'GSI_SCHEDULE_PK = :schedulePk',
        'GSI_SCHEDULE_SK = :scheduleSk',
      ].join(', '),
      ConditionExpression: 'enabled = :enabled AND nextScanAt = :expected',
      ExpressionAttributeValues: {
        ':next': nextScanAt,
        ':scheduled': scheduledAt,
        ':schedulePk': 'SOURCE_SCHEDULE',
        ':scheduleSk': `${nextScanAt}#${sourceId}`,
        ':enabled': true,
        ':expected': expectedNextScanAt,
      },
    }));
  }
}
