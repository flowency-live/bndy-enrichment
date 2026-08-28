import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { EntityResolutionSchema, type EntityResolution, type ParsedEntityResolution } from '../types.js';
import { createDynamoStoreClient, type DynamoStoreClient } from './clients.js';

export type ResolutionMetadata = {
  sourceId?: string;
  snapshotId?: string;
};

export function entityResolutionItem(
  resolution: EntityResolution,
  metadata: ResolutionMetadata = {},
): Record<string, unknown> {
  const parsed = EntityResolutionSchema.parse(resolution);
  return {
    pk: `RESOLUTION#${parsed.candidateType}#${parsed.candidateKey}`,
    sk: 'META',
    entityType: 'EntityResolution',
    ...parsed,
    ...metadata,
    ...(metadata.snapshotId ? {
      GSI1PK: `BASELINE#${metadata.snapshotId}`,
      GSI1SK: `RESOLUTION#${parsed.candidateType}#${parsed.canonicalEntityId ?? parsed.candidateKey}`,
    } : metadata.sourceId ? {
      GSI1PK: `TRUST_LOOP_SOURCE#${metadata.sourceId}`,
      GSI1SK: `RESOLUTION#${parsed.classifiedAt ?? parsed.resolvedAt}#${parsed.candidateType}#${parsed.candidateKey}`,
    } : {}),
  };
}

export class EntityResolutionStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async put(resolution: EntityResolution, metadata: ResolutionMetadata = {}): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: entityResolutionItem(resolution, metadata),
    }));
  }

  async get(candidateType: ParsedEntityResolution['candidateType'], candidateKey: string): Promise<ParsedEntityResolution | null> {
    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: `RESOLUTION#${candidateType}#${candidateKey}`, sk: 'META' },
    }));
    return response.Item ? EntityResolutionSchema.parse(response.Item) : null;
  }
}
