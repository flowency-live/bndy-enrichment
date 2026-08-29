import { PutObjectCommand } from '@aws-sdk/client-s3';
import { BatchWriteCommand, PutCommand, type BatchWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import type { CanonicalChange } from './change.js';
import { knowledgeClaimItem } from '../knowledge/stores/claim-store.js';
import {
  createDynamoStoreClient,
  createS3StoreClient,
  type DynamoStoreClient,
  type S3StoreClient,
} from '../knowledge/stores/clients.js';
import { sourceObservationEvidenceKey, sourceObservationItem } from '../knowledge/stores/observation-store.js';
import { entityResolutionItem } from '../knowledge/stores/resolution-store.js';
import { canonicalSyncStateItem } from './sync-state.js';

export type CanonicalChangePersistResult = {
  evidence: 'created' | 'existing';
  claims: number;
};

function isAlreadyStored(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: string; code?: string; $metadata?: { httpStatusCode?: number } };
  return value.name === 'PreconditionFailed'
    || value.code === 'PreconditionFailed'
    || value.$metadata?.httpStatusCode === 412;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export class CanonicalChangeStore {
  constructor(
    private readonly tableName: string,
    private readonly bucketName: string,
    private readonly ddb: DynamoStoreClient = createDynamoStoreClient(),
    private readonly s3: S3StoreClient = createS3StoreClient(),
  ) {}

  private async putEvidence(change: CanonicalChange): Promise<'created' | 'existing'> {
    try {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: sourceObservationEvidenceKey(change.observation, 'json'),
        Body: change.evidencePayload,
        ContentType: 'application/json; charset=utf-8',
        IfNoneMatch: '*',
        Metadata: {
          sourceid: change.sourceId,
          observationid: change.observation.id,
          changeid: change.changeId,
        },
      }));
      return 'created';
    } catch (error) {
      if (isAlreadyStored(error)) return 'existing';
      throw error;
    }
  }

  private async putClaims(change: CanonicalChange): Promise<void> {
    for (const group of chunks(change.claims.map(knowledgeClaimItem), 25)) {
      let pending: NonNullable<BatchWriteCommandInput['RequestItems']>[string] = group.map((Item) => ({ PutRequest: { Item } }));
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const response = await this.ddb.send(new BatchWriteCommand({
          RequestItems: { [this.tableName]: pending },
        }));
        pending = (response.UnprocessedItems?.[this.tableName] ?? [])
          .filter((request) => request.PutRequest?.Item)
          .map((request) => ({ PutRequest: { Item: request.PutRequest!.Item! } }));
        if (!pending.length) break;
        if (attempt === 7) throw new Error(`Canonical change ${change.changeId} left ${pending.length} unprocessed Claims`);
        await new Promise((resolve) => setTimeout(resolve, 50 * (2 ** attempt)));
      }
    }
  }

  async persist(change: CanonicalChange): Promise<CanonicalChangePersistResult> {
    const evidence = await this.putEvidence(change);
    const evidenceKey = sourceObservationEvidenceKey(change.observation, 'json');
    await this.ddb.send(new PutCommand({
      TableName: this.tableName,
      Item: sourceObservationItem({ ...change.observation, evidenceKey }),
    }));
    await this.putClaims(change);
    await this.ddb.send(new PutCommand({
      TableName: this.tableName,
      Item: entityResolutionItem(change.resolution, { sourceId: change.sourceId }),
    }));
    await this.ddb.send(new PutCommand({
      TableName: this.tableName,
      Item: canonicalSyncStateItem({
        entityType: change.entityType,
        canonicalId: change.canonicalId,
        contentHash: change.observation.captureHash!,
        removed: change.eventName === 'REMOVE',
        changeId: change.changeId,
        observedAt: change.observation.observedAt,
      }),
    }));
    return { evidence, claims: change.claims.length };
  }
}
