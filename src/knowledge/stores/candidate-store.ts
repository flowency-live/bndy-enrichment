import { BatchGetCommand, BatchWriteCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  EntityCandidateSchema,
  EventCandidateSchema,
  type EntityCandidate,
  type EntityCandidateType,
  type EventCandidate,
} from '../types.js';
import { createDynamoStoreClient, type DynamoStoreClient } from './clients.js';

export type IndexedCandidate = {
  candidateType: EntityCandidateType;
  candidateKey: string;
  sourceId: string;
  canonicalEntityId?: string;
  sourceNativeId?: string;
  displayName?: string;
  artistName?: string;
  venueName?: string;
  date?: string;
  observedAt: string;
  supportingClaimIds: string[];
  confidence: number;
  fingerprint?: string;
  projectedObservationId?: string;
  lastObservationId?: string;
  lastObservedAt?: string;
  observationCount?: number;
};

export type CandidateRef = { candidateType: EntityCandidateType; candidateKey: string };

// What a source last asserted about a candidate, reduced to the fields needed
// to decide whether a new observation is fresh testimony or a re-observation.
export type TestimonyCheckpoint = CandidateRef & {
  sourceId: string;
  fingerprint?: string;
  projectedObservationId?: string;
};

export function checkpointKey(ref: CandidateRef): string {
  return `${ref.candidateType}#${ref.candidateKey}`;
}

export function normaliseIdentityText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function coreArtistName(value: string): string {
  return normaliseIdentityText(value).replace(
    /\s+(band|duo|trio|live|acoustic|show|experience|collective|music)$/,
    '',
  );
}

export function eventIdentityKey(artistName?: string, venueName?: string, date?: string): string | undefined {
  if (!artistName || !venueName || !date) return undefined;
  return `${normaliseIdentityText(artistName)}|${normaliseIdentityText(venueName)}|${date}`;
}

function sourceRecord(candidate: EntityCandidate | EventCandidate): IndexedCandidate {
  if ('entityType' in candidate) {
    const parsed = EntityCandidateSchema.parse(candidate);
    return {
      candidateType: parsed.entityType,
      candidateKey: parsed.candidateKey,
      sourceId: parsed.sourceId,
      sourceNativeId: parsed.sourceNativeId,
      displayName: parsed.displayName,
      observedAt: parsed.observedAt,
      supportingClaimIds: parsed.supportingClaimIds,
      confidence: parsed.confidence,
    };
  }
  const parsed = EventCandidateSchema.parse(candidate);
  return {
    candidateType: 'event',
    candidateKey: parsed.candidateKey,
    sourceId: parsed.sourceId,
    sourceNativeId: parsed.sourceNativeId,
    displayName: parsed.title,
    artistName: parsed.artistName,
    venueName: parsed.venueName,
    date: parsed.date,
    observedAt: parsed.observedAt,
    supportingClaimIds: parsed.supportingClaimIds,
    confidence: parsed.confidence,
    ...(parsed.fingerprint ? { fingerprint: parsed.fingerprint } : {}),
    ...(parsed.projectedObservationId ? { projectedObservationId: parsed.projectedObservationId } : {}),
  };
}

function identityAliases(candidate: IndexedCandidate): string[] {
  if (candidate.candidateType === 'event') {
    const fingerprint = eventIdentityKey(candidate.artistName, candidate.venueName, candidate.date);
    return fingerprint ? [`event:${fingerprint}`] : [];
  }
  if (!candidate.displayName) return [];
  const exact = normaliseIdentityText(candidate.displayName);
  const core = candidate.candidateType === 'artist' ? coreArtistName(candidate.displayName) : exact;
  return [...new Set([exact, core].filter(Boolean).map((name) => `${candidate.candidateType}:${name}`))];
}

function baseItem(candidate: IndexedCandidate): Record<string, unknown> {
  return {
    pk: `CANDIDATE#${candidate.candidateType}#${candidate.candidateKey}`,
    sk: 'META',
    entityType: 'IndexedCandidate',
    ...candidate,
    GSI1PK: `SOURCE#${candidate.sourceId}`,
    GSI1SK: `CANDIDATE#${candidate.candidateType}#${candidate.observedAt}#${candidate.candidateKey}`,
  };
}

function aliasItems(candidate: IndexedCandidate): Record<string, unknown>[] {
  return identityAliases(candidate).map((identity) => ({
    pk: `CANDIDATE#${candidate.candidateType}#${candidate.candidateKey}`,
    sk: `IDENTITY#${identity}`,
    entityType: 'CandidateIdentityAlias',
    ...candidate,
    identity,
    GSI2PK: `IDENTITY#${identity}`,
    GSI2SK: `${candidate.canonicalEntityId ? 'CANONICAL' : 'SOURCE'}#${candidate.sourceId}#${candidate.candidateKey}`,
  }));
}

export function candidateItems(candidate: EntityCandidate | EventCandidate): Record<string, unknown>[] {
  const record = sourceRecord(candidate);
  return [baseItem(record), ...aliasItems(record)];
}

export function canonicalCandidateItems(candidate: IndexedCandidate): Record<string, unknown>[] {
  if (!candidate.canonicalEntityId) throw new Error('Canonical candidate requires canonicalEntityId');
  return [baseItem(candidate), ...aliasItems(candidate)];
}

function fromItem(item: Record<string, unknown>): IndexedCandidate {
  return {
    candidateType: item.candidateType as EntityCandidateType,
    candidateKey: String(item.candidateKey),
    sourceId: String(item.sourceId),
    ...(typeof item.canonicalEntityId === 'string' ? { canonicalEntityId: item.canonicalEntityId } : {}),
    ...(typeof item.sourceNativeId === 'string' ? { sourceNativeId: item.sourceNativeId } : {}),
    ...(typeof item.displayName === 'string' ? { displayName: item.displayName } : {}),
    ...(typeof item.artistName === 'string' ? { artistName: item.artistName } : {}),
    ...(typeof item.venueName === 'string' ? { venueName: item.venueName } : {}),
    ...(typeof item.date === 'string' ? { date: item.date } : {}),
    observedAt: String(item.observedAt),
    supportingClaimIds: Array.isArray(item.supportingClaimIds)
      ? item.supportingClaimIds.filter((value): value is string => typeof value === 'string')
      : [],
    confidence: Number(item.confidence ?? 0),
    ...(typeof item.fingerprint === 'string' ? { fingerprint: item.fingerprint } : {}),
    ...(typeof item.projectedObservationId === 'string' ? { projectedObservationId: item.projectedObservationId } : {}),
    ...(typeof item.lastObservationId === 'string' ? { lastObservationId: item.lastObservationId } : {}),
    ...(typeof item.lastObservedAt === 'string' ? { lastObservedAt: item.lastObservedAt } : {}),
    ...(typeof item.observationCount === 'number' ? { observationCount: item.observationCount } : {}),
  };
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export class CandidateStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async putMany(candidates: Array<EntityCandidate | EventCandidate>): Promise<void> {
    await this.writeItems(candidates.flatMap(candidateItems));
  }

  async putCanonical(candidate: IndexedCandidate): Promise<void> {
    await this.writeItems(canonicalCandidateItems(candidate));
  }

  async putCanonicalMany(candidates: IndexedCandidate[]): Promise<void> {
    await this.writeItems(candidates.flatMap(canonicalCandidateItems));
  }

  private async writeItems(items: Record<string, unknown>[]): Promise<void> {
    for (const group of chunks(items, 25)) {
      let pending = group.map((Item) => ({ PutRequest: { Item } }));
      for (let attempt = 0; pending.length > 0 && attempt < 8; attempt += 1) {
        const response = await this.client.send(new BatchWriteCommand({
          RequestItems: { [this.tableName]: pending },
        }));
        pending = response.UnprocessedItems?.[this.tableName]
          ?.filter((request) => request.PutRequest?.Item)
          .map((request) => ({ PutRequest: { Item: request.PutRequest!.Item! } })) ?? [];
      }
      if (pending.length > 0) throw new Error(`Candidate index left ${pending.length} unprocessed writes`);
    }
  }

  async getCheckpoints(refs: CandidateRef[]): Promise<Map<string, TestimonyCheckpoint>> {
    const out = new Map<string, TestimonyCheckpoint>();
    const unique = [...new Map(refs.map((ref) => [checkpointKey(ref), ref] as const)).values()];
    for (const group of chunks(unique, 100)) {
      const response = await this.client.send(new BatchGetCommand({
        RequestItems: {
          [this.tableName]: {
            Keys: group.map((ref) => ({ pk: `CANDIDATE#${ref.candidateType}#${ref.candidateKey}`, sk: 'META' })),
            ProjectionExpression: 'candidateType, candidateKey, sourceId, fingerprint, projectedObservationId',
          },
        },
      }));
      for (const item of response.Responses?.[this.tableName] ?? []) {
        if (typeof item.candidateType !== 'string' || typeof item.candidateKey !== 'string' || typeof item.sourceId !== 'string') continue;
        const checkpoint: TestimonyCheckpoint = {
          candidateType: item.candidateType as EntityCandidateType,
          candidateKey: item.candidateKey,
          sourceId: item.sourceId,
          ...(typeof item.fingerprint === 'string' ? { fingerprint: item.fingerprint } : {}),
          ...(typeof item.projectedObservationId === 'string' ? { projectedObservationId: item.projectedObservationId } : {}),
        };
        out.set(checkpointKey(checkpoint), checkpoint);
      }
    }
    return out;
  }

  async checkpoint(
    ref: CandidateRef,
    update: { observationId: string; observedAt: string; projectedObservationId?: string },
  ): Promise<void> {
    const projected = update.projectedObservationId ? ', projectedObservationId = :projected' : '';
    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { pk: `CANDIDATE#${ref.candidateType}#${ref.candidateKey}`, sk: 'META' },
      UpdateExpression: `SET lastObservationId = :observationId, lastObservedAt = :observedAt, observationCount = if_not_exists(observationCount, :zero) + :one${projected}`,
      ExpressionAttributeValues: {
        ':observationId': update.observationId,
        ':observedAt': update.observedAt,
        ':zero': 0,
        ':one': 1,
        ...(update.projectedObservationId ? { ':projected': update.projectedObservationId } : {}),
      },
    }));
  }

  async get(candidateType: EntityCandidateType, candidateKey: string): Promise<IndexedCandidate | null> {
    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: `CANDIDATE#${candidateType}#${candidateKey}`, sk: 'META' },
    }));
    return response.Item ? fromItem(response.Item) : null;
  }

  async listBySource(sourceId: string, limit = 100): Promise<IndexedCandidate[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'ObservationClaimsIndex',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `SOURCE#${sourceId}`, ':prefix': 'CANDIDATE#' },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (response.Items ?? []).filter((item) => item.entityType === 'IndexedCandidate').map(fromItem);
  }

  async listBySourceType(
    sourceId: string,
    candidateType: EntityCandidateType,
    limit = 100,
  ): Promise<IndexedCandidate[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'ObservationClaimsIndex',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `SOURCE#${sourceId}`,
        ':prefix': `CANDIDATE#${candidateType}#`,
      },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (response.Items ?? []).filter((item) => item.entityType === 'IndexedCandidate').map(fromItem);
  }

  async listByIdentity(identity: string, limit = 25): Promise<IndexedCandidate[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'SubjectClaimsIndex',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `IDENTITY#${identity}` },
      ScanIndexForward: true,
      Limit: limit,
    }));
    return (response.Items ?? []).filter((item) => item.entityType === 'CandidateIdentityAlias').map(fromItem);
  }
}
