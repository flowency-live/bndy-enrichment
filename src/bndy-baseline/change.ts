import type { DynamoDBRecord } from 'aws-lambda';
import {
  buildCanonicalBaselineClaims,
  buildCanonicalRemovalClaims,
  sha256,
  stableJson,
  type BaselineEntityType,
} from './mapper.js';
import { CANONICAL_SOURCE_IDS } from './sources.js';
import { decodeDynamoImage } from '../knowledge/dynamo-image.js';
import type { EntityResolution, KnowledgeClaim, SourceObservation } from '../knowledge/types.js';

const TABLE_TYPES: Record<string, Exclude<BaselineEntityType, 'festival'>> = {
  'bndy-artists': 'artist',
  'bndy-venues': 'venue',
  'bndy-events': 'event',
};

export type CanonicalChange = {
  changeId: string;
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE';
  entityType: BaselineEntityType;
  canonicalId: string;
  sourceId: string;
  observation: SourceObservation;
  evidencePayload: string;
  claims: KnowledgeClaim[];
  resolution: EntityResolution;
};

export type CanonicalChangeImageInput = {
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE';
  entityType: BaselineEntityType;
  canonicalRecord: Record<string, unknown>;
  version: string;
  observedAt: string;
};

function tableNameFromArn(arn?: string): string | undefined {
  return arn?.match(/:table\/([^/]+)\/stream\//)?.[1];
}

function eventTime(record: DynamoDBRecord, fallback: () => Date): string {
  const approximate = record.dynamodb?.ApproximateCreationDateTime;
  if (typeof approximate === 'number') return new Date(approximate * 1000).toISOString();
  return fallback().toISOString();
}

function logicalType(tableType: Exclude<BaselineEntityType, 'festival'>, record: Record<string, unknown>): BaselineEntityType {
  return tableType === 'event' && record.entityType === 'festival' ? 'festival' : tableType;
}

function canonicalId(record: Record<string, unknown>): string {
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  if (!id) throw new Error('Canonical stream record has no non-empty id');
  return id;
}

export function canonicalChangeFromImage(input: CanonicalChangeImageInput): CanonicalChange {
  const id = canonicalId(input.canonicalRecord);
  const sourceId = CANONICAL_SOURCE_IDS[input.entityType];
  const changeId = sha256(stableJson([sourceId, id, input.version]));
  const recordJson = stableJson(input.canonicalRecord);
  const contentHash = sha256(recordJson);
  const observationId = `bndy-change:${input.entityType}:${id}:${changeId.slice(0, 20)}`;
  const removed = input.eventName === 'REMOVE';
  const evidencePayload = stableJson({
    changeId,
    observedAt: input.observedAt,
    eventName: input.eventName,
    entityType: input.entityType,
    canonicalEntityId: id,
    record: input.canonicalRecord,
  });
  const observation: SourceObservation = {
    id: observationId,
    sourceId,
    observedAt: input.observedAt,
    captureHash: contentHash,
    enumerationMethod: 'bndy-canonical-dynamodb-stream-v1',
    complete: true,
    paginationComplete: true,
    captureStable: true,
    itemCount: 1,
    contentType: 'application/json; charset=utf-8',
  };
  const claims = removed
    ? buildCanonicalRemovalClaims({
        changeId,
        removedAt: input.observedAt,
        sourceId,
        entityType: input.entityType,
        canonicalId: id,
        observationId,
        oldRecord: input.canonicalRecord,
        contentHash,
      })
    : buildCanonicalBaselineClaims({
        snapshotId: `canonical-change:${changeId}`,
        snapshotAt: input.observedAt,
        sourceId,
        entityType: input.entityType,
        canonicalId: id,
        observationId,
        record: input.canonicalRecord,
        contentHash,
        resolutionMethod: 'canonical-self-change',
      });
  const support = claims.find((claim) => claim.predicate === (removed ? 'hasStatus' : 'resolvesTo'))!;
  const resolution: EntityResolution = removed ? {
    candidateType: input.entityType,
    candidateKey: `bndy:${input.entityType}:${id}`,
    method: 'canonical-stream-remove',
    confidence: 1,
    supportingClaimIds: [support.id],
    status: 'superseded',
    classifiedAt: input.observedAt,
  } : {
    candidateType: input.entityType,
    candidateKey: `bndy:${input.entityType}:${id}`,
    canonicalEntityId: id,
    method: 'canonical-self-change',
    confidence: 1,
    supportingClaimIds: [support.id],
    status: 'resolved',
    resolvedAt: input.observedAt,
  };

  return {
    changeId,
    eventName: input.eventName,
    entityType: input.entityType,
    canonicalId: id,
    sourceId,
    observation,
    evidencePayload,
    claims,
    resolution,
  };
}

export function canonicalChangeFromRecord(
  record: DynamoDBRecord,
  fallbackNow: () => Date = () => new Date(),
): CanonicalChange | null {
  if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY' && record.eventName !== 'REMOVE') return null;
  const tableName = tableNameFromArn(record.eventSourceARN);
  const tableType = tableName ? TABLE_TYPES[tableName] : undefined;
  if (!tableType) return null;

  const newImage = decodeDynamoImage(record.dynamodb?.NewImage);
  const oldImage = decodeDynamoImage(record.dynamodb?.OldImage);
  if (record.eventName === 'MODIFY' && newImage && oldImage && stableJson(newImage) === stableJson(oldImage)) return null;
  const canonicalRecord = record.eventName === 'REMOVE' ? oldImage : newImage;
  if (!canonicalRecord) throw new Error(`${record.eventName} canonical stream record has no usable image`);

  const entityType = logicalType(tableType, canonicalRecord);
  const id = canonicalId(canonicalRecord);
  const version = record.dynamodb?.SequenceNumber ?? record.eventID;
  if (!version) throw new Error(`Canonical stream record ${entityType}:${id} has no stable version`);
  const observedAt = eventTime(record, fallbackNow);
  return canonicalChangeFromImage({
    eventName: record.eventName,
    entityType,
    canonicalRecord,
    version,
    observedAt,
  });
}
