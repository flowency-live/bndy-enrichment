import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { CanonicalChangeStore } from '../bndy-baseline/change-store.js';
import { canonicalChangeFromImage } from '../bndy-baseline/change.js';
import { needsCanonicalHydration, needsCanonicalRemoval, type PriorCanonicalState } from '../bndy-baseline/delta.js';
import { sha256, stableJson, type BaselineEntityType } from '../bndy-baseline/mapper.js';
import { CANONICAL_SOURCE_IDS, canonicalEvidenceSource } from '../bndy-baseline/sources.js';
import { CanonicalSyncStateStore } from '../bndy-baseline/sync-state.js';
import { ClaimStore } from '../knowledge/stores/claim-store.js';
import { SourceRegistryStore } from '../knowledge/stores/source-registry-store.js';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const region = process.env.AWS_REGION ?? 'eu-west-2';
const stateTable = requiredEnv('STATE_TABLE');
const evidenceBucket = requiredEnv('EVIDENCE_BUCKET');
const canonicalTables = {
  artist: process.env.BNDY_ARTISTS_TABLE ?? 'bndy-artists',
  venue: process.env.BNDY_VENUES_TABLE ?? 'bndy-venues',
  event: process.env.BNDY_EVENTS_TABLE ?? 'bndy-events',
} as const;
const baselineSnapshotId = process.argv.find((arg) => arg.startsWith('--baseline-snapshot-id='))
  ?.slice('--baseline-snapshot-id='.length) ?? 'bndy-baseline-2026-08-24-v1';
const observedAt = new Date().toISOString();
const runId = process.argv.find((arg) => arg.startsWith('--run-id='))
  ?.slice('--run-id='.length) ?? `bndy-delta-${observedAt.replace(/[:.]/g, '-')}`;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true },
});
const changes = new CanonicalChangeStore(stateTable, evidenceBucket);
const sync = new CanonicalSyncStateStore(stateTable);
const claims = new ClaimStore(stateTable);
const registry = new SourceRegistryStore(stateTable);
const currentIds = new Set<string>();
const summary = {
  runId,
  baselineSnapshotId,
  startedAt: observedAt,
  completedAt: undefined as string | undefined,
  status: 'running' as 'running' | 'complete' | 'failed',
  canonicalWritesEnabled: false,
  scanned: 0,
  unchanged: 0,
  inserted: 0,
  modified: 0,
  removed: 0,
  claims: 0,
  checkpointsBackfilled: 0,
  skippedWithoutId: 0,
  errors: [] as string[],
};

function idOf(record: Record<string, unknown>): string | undefined {
  return typeof record.id === 'string' && record.id.trim() ? record.id.trim() : undefined;
}

function logicalEventType(record: Record<string, unknown>): 'event' | 'festival' {
  return record.entityType === 'festival' ? 'festival' : 'event';
}

function key(entityType: BaselineEntityType, id: string): string {
  return `${entityType}:${id}`;
}

async function priorState(entityType: BaselineEntityType, id: string): Promise<PriorCanonicalState | null> {
  const checkpoint = await sync.get(entityType, id);
  if (checkpoint) return checkpoint;
  return await claims.latestSourceStateBySubject(entityType, id, CANONICAL_SOURCE_IDS[entityType]);
}

async function processCurrent(entityType: BaselineEntityType, record: Record<string, unknown>): Promise<void> {
  summary.scanned += 1;
  const id = idOf(record);
  if (!id) {
    summary.skippedWithoutId += 1;
    return;
  }
  currentIds.add(key(entityType, id));
  const contentHash = sha256(stableJson(record));
  const checkpoint = await sync.get(entityType, id);
  const prior = checkpoint ?? await claims.latestSourceStateBySubject(entityType, id, CANONICAL_SOURCE_IDS[entityType]);
  if (!needsCanonicalHydration(contentHash, prior)) {
    summary.unchanged += 1;
    if (!checkpoint) {
      await sync.put({
        entityType,
        canonicalId: id,
        contentHash,
        removed: false,
        changeId: `baseline:${baselineSnapshotId}`,
        observedAt: prior!.observedAt,
      });
      summary.checkpointsBackfilled += 1;
    }
    return;
  }
  const eventName = prior && !prior.removed ? 'MODIFY' : 'INSERT';
  const change = canonicalChangeFromImage({
    eventName,
    entityType,
    canonicalRecord: record,
    version: `${runId}:${entityType}:${id}:${contentHash}`,
    observedAt,
  });
  await changes.persist(change);
  summary[eventName === 'INSERT' ? 'inserted' : 'modified'] += 1;
  summary.claims += change.claims.length;
}

async function scanCurrentTable(
  tableName: string,
  classify: (record: Record<string, unknown>) => BaselineEntityType,
): Promise<void> {
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }));
    for (const record of page.Items ?? []) await processCurrent(classify(record), record);
    ExclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    console.log(JSON.stringify({ progress: true, tableName, scanned: summary.scanned, inserted: summary.inserted, modified: summary.modified }));
  } while (ExclusiveStartKey);
}

async function baselineEntities(): Promise<Array<{ entityType: BaselineEntityType; canonicalId: string }>> {
  const result: Array<{ entityType: BaselineEntityType; canonicalId: string }> = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await ddb.send(new QueryCommand({
      TableName: stateTable,
      IndexName: 'ObservationClaimsIndex',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `BASELINE#${baselineSnapshotId}`, ':prefix': 'RESOLUTION#' },
      ProjectionExpression: 'candidateType, canonicalEntityId',
      ExclusiveStartKey,
    }));
    for (const item of page.Items ?? []) {
      const entityType = item.candidateType;
      const canonicalId = item.canonicalEntityId;
      if (['artist', 'venue', 'event', 'festival'].includes(String(entityType)) && typeof canonicalId === 'string') {
        result.push({ entityType: entityType as BaselineEntityType, canonicalId });
      }
    }
    ExclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return result;
}

async function hydrateRemovals(): Promise<void> {
  for (const baseline of await baselineEntities()) {
    if (currentIds.has(key(baseline.entityType, baseline.canonicalId))) continue;
    const prior = await priorState(baseline.entityType, baseline.canonicalId);
    if (!needsCanonicalRemoval(prior)) continue;
    const change = canonicalChangeFromImage({
      eventName: 'REMOVE',
      entityType: baseline.entityType,
      canonicalRecord: { id: baseline.canonicalId },
      version: `${runId}:${baseline.entityType}:${baseline.canonicalId}:removed`,
      observedAt,
    });
    await changes.persist(change);
    summary.removed += 1;
    summary.claims += change.claims.length;
  }
}

async function writeManifest(): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: stateTable,
    Item: { pk: `DELTA_HYDRATION#${runId}`, sk: 'META', entityType: 'CanonicalDeltaHydration', ...summary },
  }));
}

async function main(): Promise<void> {
  for (const entityType of ['artist', 'venue', 'event', 'festival'] as const) {
    await registry.put(canonicalEvidenceSource(entityType));
  }
  try {
    await scanCurrentTable(canonicalTables.artist, () => 'artist');
    await scanCurrentTable(canonicalTables.venue, () => 'venue');
    await scanCurrentTable(canonicalTables.event, logicalEventType);
    if (summary.skippedWithoutId) throw new Error(`Delta hydration skipped ${summary.skippedWithoutId} canonical rows without id`);
    await hydrateRemovals();
    summary.status = 'complete';
    summary.completedAt = new Date().toISOString();
    await writeManifest();
    for (const entityType of ['artist', 'venue', 'event', 'festival'] as const) {
      await registry.put({ ...canonicalEvidenceSource(entityType), lastSuccessfulScanAt: summary.completedAt });
    }
    console.log(JSON.stringify(summary));
  } catch (error) {
    summary.status = 'failed';
    summary.completedAt = new Date().toISOString();
    summary.errors.push(error instanceof Error ? error.message : String(error));
    await writeManifest();
    console.error(JSON.stringify(summary));
    throw error;
  }
}

await main();
