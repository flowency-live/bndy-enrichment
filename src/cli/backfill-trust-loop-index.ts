import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { CandidateStore, type IndexedCandidate } from '../knowledge/stores/candidate-store.js';
import type { EntityCandidateType } from '../knowledge/types.js';

const stateTable = process.env.STATE_TABLE;
if (!stateTable) throw new Error('STATE_TABLE is required');
const region = process.env.AWS_REGION ?? 'eu-west-2';
const snapshotAt = new Date().toISOString();
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true },
});
const candidates = new CandidateStore(stateTable);

const canonicalTables = {
  artist: process.env.ARTISTS_TABLE ?? 'bndy-artists',
  venue: process.env.VENUES_TABLE ?? 'bndy-venues',
  event: process.env.EVENTS_TABLE ?? 'bndy-events',
} as const;

function stringField(record: Record<string, unknown>, names: string[]): string | undefined {
  for (const name of names) {
    const value = record[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function canonicalCandidate(
  candidateType: EntityCandidateType,
  record: Record<string, unknown>,
): IndexedCandidate | null {
  const canonicalEntityId = stringField(record, ['id']);
  if (!canonicalEntityId) return null;
  const logicalType = candidateType === 'event' && record.entityType === 'festival' ? 'festival' : candidateType;
  const displayName = stringField(record, ['name', 'title']);
  return {
    candidateType: logicalType,
    candidateKey: `bndy:${logicalType}:${canonicalEntityId}`,
    canonicalEntityId,
    sourceId: `bndy-canonical-${logicalType}`,
    displayName,
    ...(logicalType === 'event' || logicalType === 'festival' ? {
      artistName: stringField(record, ['artistName', 'performerName']),
      venueName: stringField(record, ['venueName']),
      date: stringField(record, ['date']),
    } : {}),
    observedAt: snapshotAt,
    supportingClaimIds: [],
    confidence: 1,
  };
}

async function backfill(tableName: string, candidateType: EntityCandidateType): Promise<number> {
  let exclusiveStartKey: Record<string, unknown> | undefined;
  let indexed = 0;
  do {
    const response = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey: exclusiveStartKey }));
    const page = (response.Items ?? [])
      .map((record) => canonicalCandidate(candidateType, record as Record<string, unknown>))
      .filter((candidate): candidate is IndexedCandidate => Boolean(candidate))
      .filter((candidate) => candidate.candidateType !== 'festival');
    await candidates.putCanonicalMany(page);
    indexed += page.length;
    console.log(JSON.stringify({ tableName, candidateType, indexed }));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);
  return indexed;
}

const counts = {
  artist: await backfill(canonicalTables.artist, 'artist'),
  venue: await backfill(canonicalTables.venue, 'venue'),
  event: await backfill(canonicalTables.event, 'event'),
};
console.log(JSON.stringify({ status: 'complete', snapshotAt, counts, canonicalWrites: 0 }));
