import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { KnowledgeClaimSchema, type ClaimSubjectType, type KnowledgeClaim } from '../types.js';
import { createDynamoStoreClient, type DynamoStoreClient } from './clients.js';

export const CLAIM_BY_OBSERVATION_INDEX = 'ObservationClaimsIndex';
export const CLAIM_BY_SUBJECT_INDEX = 'SubjectClaimsIndex';

export type CanonicalEntityType = 'artist' | 'venue' | 'event' | 'festival';

export type LatestSourceClaimState = {
  observationId: string;
  observedAt: string;
  contentHash: string;
  removed: boolean;
};

export function knowledgeClaimItem(claim: KnowledgeClaim): Record<string, unknown> {
  const parsed = KnowledgeClaimSchema.parse(claim);
  return {
    pk: `CLAIM#${parsed.id}`,
    sk: 'META',
    entityType: 'KnowledgeClaim',
    ...parsed,
    GSI1PK: `OBS#${parsed.observationId}`,
    GSI1SK: `${parsed.observedAt}#${parsed.id}`,
    GSI2PK: `SUBJECT#${parsed.subject.type}#${parsed.subject.key}`,
    GSI2SK: `${parsed.observedAt}#${parsed.id}`,
  };
}

export class ClaimStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async put(claim: KnowledgeClaim): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: knowledgeClaimItem(claim),
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
  }

  async get(claimId: string): Promise<KnowledgeClaim | null> {
    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: `CLAIM#${claimId}`, sk: 'META' },
    }));
    return response.Item ? KnowledgeClaimSchema.parse(response.Item) : null;
  }

  async listByObservation(observationId: string, limit = 1000): Promise<KnowledgeClaim[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: CLAIM_BY_OBSERVATION_INDEX,
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `OBS#${observationId}` },
      ScanIndexForward: true,
      Limit: limit,
    }));
    return (response.Items ?? []).map((item) => KnowledgeClaimSchema.parse(item));
  }

  async listBySubject(subjectType: ClaimSubjectType, subjectKey: string, limit = 1000): Promise<KnowledgeClaim[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: CLAIM_BY_SUBJECT_INDEX,
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `SUBJECT#${subjectType}#${subjectKey}` },
      ScanIndexForward: true,
      Limit: limit,
    }));
    return (response.Items ?? []).map((item) => KnowledgeClaimSchema.parse(item));
  }

  async listBySubjectComplete(
    subjectType: ClaimSubjectType,
    subjectKey: string,
    maximumClaims = 1000,
  ): Promise<KnowledgeClaim[]> {
    const items: Record<string, unknown>[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const remaining = maximumClaims + 1 - items.length;
      const response = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: CLAIM_BY_SUBJECT_INDEX,
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: { ':pk': `SUBJECT#${subjectType}#${subjectKey}` },
        ScanIndexForward: true,
        Limit: remaining,
        ExclusiveStartKey: exclusiveStartKey,
      }));
      items.push(...(response.Items ?? []));
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey && items.length <= maximumClaims);

    if (items.length > maximumClaims || exclusiveStartKey) {
      throw new Error(
        `Claim safety limit exceeded for ${subjectType}:${subjectKey}; more than ${maximumClaims} Claims require explicit review`,
      );
    }
    return items.map((item) => KnowledgeClaimSchema.parse(item));
  }

  async latestSourceStateBySubject(
    subjectType: ClaimSubjectType,
    subjectKey: string,
    sourceId: string,
    maximumClaims = 1000,
  ): Promise<LatestSourceClaimState | null> {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    let inspected = 0;
    let targetObservationId: string | undefined;
    let targetObservedAt: string | undefined;
    let contentHash: string | undefined;
    let removed = false;

    do {
      const response = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: CLAIM_BY_SUBJECT_INDEX,
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: { ':pk': `SUBJECT#${subjectType}#${subjectKey}` },
        ScanIndexForward: false,
        Limit: Math.min(100, maximumClaims - inspected),
        ExclusiveStartKey: exclusiveStartKey,
      }));
      const items = response.Items ?? [];
      inspected += items.length;
      for (const item of items) {
        if (item.sourceId !== sourceId) continue;
        const observationId = typeof item.observationId === 'string' ? item.observationId : undefined;
        const observedAt = typeof item.observedAt === 'string' ? item.observedAt : undefined;
        if (!observationId || !observedAt) continue;
        if (!targetObservationId) {
          targetObservationId = observationId;
          targetObservedAt = observedAt;
        }
        if (observedAt < targetObservedAt!) {
          if (!contentHash) throw new Error(`Latest canonical Claim state has no content hash for ${subjectType}:${subjectKey}`);
          return { observationId: targetObservationId, observedAt: targetObservedAt!, contentHash, removed };
        }
        if (observationId !== targetObservationId) continue;
        const evidence = item.evidence && typeof item.evidence === 'object'
          ? item.evidence as Record<string, unknown> : undefined;
        if (!contentHash && typeof evidence?.contentHash === 'string') contentHash = evidence.contentHash;
        if (item.predicate === 'hasStatus' && item.value === 'canonical-record-removed') removed = true;
      }
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey && inspected < maximumClaims);

    if (!targetObservationId) return null;
    if (!contentHash) throw new Error(`Latest canonical Claim state has no content hash for ${subjectType}:${subjectKey}`);
    return { observationId: targetObservationId, observedAt: targetObservedAt!, contentHash, removed };
  }

  async linkCanonicalEntity(entityType: CanonicalEntityType, entityId: string, claimId: string): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: `ENTITY#${entityType}#${entityId}`,
        sk: `SUPPORT#${claimId}`,
        claimId,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
  }

  async listSupportClaimIds(entityType: CanonicalEntityType, entityId: string): Promise<string[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `ENTITY#${entityType}#${entityId}`,
        ':prefix': 'SUPPORT#',
      },
      ScanIndexForward: true,
    }));

    return (response.Items ?? [])
      .map((item) => item.claimId)
      .filter((claimId): claimId is string => typeof claimId === 'string' && claimId.length > 0);
  }
}
