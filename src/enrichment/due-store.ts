import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  EntityEnrichmentCandidateSchema,
  type EntityEnrichmentCandidate,
} from './types.js';

export const ENTITY_ENRICHMENT_DUE_PK = 'ENTITY_ENRICHMENT_DUE';
export const MAX_DUE_CANDIDATES_PER_PLAN = 200;

export type EntityEnrichmentDueRecord = {
  key: { pk: string; sk: string };
  dueAt: string;
  candidate: EntityEnrichmentCandidate;
};

type StoredDueRecord = {
  pk?: unknown;
  sk?: unknown;
  dueAt?: unknown;
  candidate?: unknown;
};

function ttl(base: Date, days: number): number {
  return Math.floor((base.getTime() + days * 86_400_000) / 1_000);
}

function dueSortKey(dueAt: string, candidate: EntityEnrichmentCandidate): string {
  return `${dueAt}#${candidate.entityType}#${candidate.entityId}`;
}

export class DynamoEntityEnrichmentDueStore {
  private readonly ddb: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    ddb?: DynamoDBDocumentClient,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.ddb = ddb ?? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async schedule(rawCandidate: EntityEnrichmentCandidate, dueAt: Date): Promise<EntityEnrichmentDueRecord> {
    if (Number.isNaN(dueAt.getTime())) throw new Error('Enrichment dueAt must be a valid date');
    const candidate = EntityEnrichmentCandidateSchema.parse(rawCandidate);
    const dueAtIso = dueAt.toISOString();
    const key = { pk: ENTITY_ENRICHMENT_DUE_PK, sk: dueSortKey(dueAtIso, candidate) };
    const expiryBase = dueAt.getTime() > this.now().getTime() ? dueAt : this.now();
    await this.ddb.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        ...key,
        entityType: 'EntityEnrichmentDue',
        dueAt: dueAtIso,
        candidate,
        expiresAt: ttl(expiryBase, 180),
      },
    }));
    return { key, dueAt: dueAtIso, candidate };
  }

  async listDue(at: Date, limit = 100): Promise<EntityEnrichmentDueRecord[]> {
    if (Number.isNaN(at.getTime())) throw new Error('Enrichment plan time must be a valid date');
    const boundedLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_DUE_CANDIDATES_PER_PLAN);
    const response = await this.ddb.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'pk = :pk AND sk <= :upper',
      ExpressionAttributeValues: {
        ':pk': ENTITY_ENRICHMENT_DUE_PK,
        ':upper': `${at.toISOString()}\uffff`,
      },
      ScanIndexForward: true,
      ConsistentRead: true,
      Limit: boundedLimit,
    }));
    return (response.Items ?? []).map((raw) => {
      const item = raw as StoredDueRecord;
      if (item.pk !== ENTITY_ENRICHMENT_DUE_PK || typeof item.sk !== 'string' || typeof item.dueAt !== 'string') {
        throw new Error('Invalid entity enrichment due record');
      }
      return {
        key: { pk: item.pk, sk: item.sk },
        dueAt: new Date(item.dueAt).toISOString(),
        candidate: EntityEnrichmentCandidateSchema.parse(item.candidate),
      };
    });
  }

  async remove(record: EntityEnrichmentDueRecord): Promise<void> {
    if (record.key.pk !== ENTITY_ENRICHMENT_DUE_PK || !record.key.sk) {
      throw new Error('Invalid entity enrichment due key');
    }
    await this.ddb.send(new DeleteCommand({
      TableName: this.tableName,
      Key: record.key,
    }));
  }
}
