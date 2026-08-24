import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  type BatchWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { buildCanonicalBaselineClaims, provenanceForRecord, sha256, stableJson, type BaselineEntityType } from '../bndy-baseline/mapper.js';
import { knowledgeClaimItem } from '../knowledge/stores/claim-store.js';
import { ObservationStore, sourceObservationItem } from '../knowledge/stores/observation-store.js';
import { entityResolutionItem } from '../knowledge/stores/resolution-store.js';
import { SourceRegistryStore } from '../knowledge/stores/source-registry-store.js';
import type { EntityResolution, GigSource, SourceObservation } from '../knowledge/types.js';

const region = process.env.AWS_REGION ?? 'eu-west-2';
const stateTable = process.env.STATE_TABLE;
const evidenceBucket = process.env.EVIDENCE_BUCKET;
if (!stateTable) throw new Error('STATE_TABLE is required');
if (!evidenceBucket) throw new Error('EVIDENCE_BUCKET is required');

const canonicalTables = {
  artist: process.env.BNDY_ARTISTS_TABLE ?? 'bndy-artists',
  venue: process.env.BNDY_VENUES_TABLE ?? 'bndy-venues',
  event: process.env.BNDY_EVENTS_TABLE ?? 'bndy-events',
} as const;

const snapshotArg = process.argv.find((arg) => arg.startsWith('--snapshot-id='))?.slice('--snapshot-id='.length);
const snapshotAtArg = process.argv.find((arg) => arg.startsWith('--snapshot-at='))?.slice('--snapshot-at='.length);
const snapshotAt = snapshotAtArg ?? new Date().toISOString();
const snapshotId = snapshotArg ?? `bndy-baseline-${snapshotAt.replace(/[:.]/g, '-')}`;
if (!snapshotId.trim()) throw new Error('--snapshot-id must not be empty');
if (Number.isNaN(new Date(snapshotAt).getTime())) throw new Error(`Invalid --snapshot-at=${snapshotAt}`);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({ region });
const registry = new SourceRegistryStore(stateTable);
const observationKeys = new ObservationStore(stateTable, evidenceBucket);

const sourceIds: Record<BaselineEntityType, string> = {
  artist: 'bndy-canonical-artists',
  venue: 'bndy-canonical-venues',
  event: 'bndy-canonical-events',
  festival: 'bndy-canonical-festivals',
};

function sourceConfig(entityType: BaselineEntityType): GigSource {
  return {
    id: sourceIds[entityType],
    name: `Canonical BNDY ${entityType}s baseline`,
    type: 'CURATED_SOURCE',
    timezone: 'Europe/London',
    cadence: 'manual',
    localTime: '05:00',
    mode: 'append-only',
    snapshotSemantics: 'one_shot',
    authorityClass: 'curated',
    thresholds: {},
    runtimeClass: 'standard',
    enabled: false,
    shadow: true,
    writerAuthority: 'aws',
    health: 'healthy',
  };
}

type TypeCounts = {
  entities: number;
  observations: number;
  claims: number;
  resolutions: number;
  evidenceCreated: number;
  evidenceExisting: number;
  legacyCanonicalEntities: number;
  recoverableSourceEntities: number;
};

type Summary = {
  snapshotId: string;
  snapshotAt: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'complete' | 'failed';
  shadow: true;
  canonicalWritesEnabled: false;
  tables: typeof canonicalTables;
  counts: Record<BaselineEntityType, TypeCounts>;
  totals: TypeCounts;
  skippedWithoutId: number;
  errors: string[];
};

function emptyCounts(): TypeCounts {
  return {
    entities: 0,
    observations: 0,
    claims: 0,
    resolutions: 0,
    evidenceCreated: 0,
    evidenceExisting: 0,
    legacyCanonicalEntities: 0,
    recoverableSourceEntities: 0,
  };
}

const summary: Summary = {
  snapshotId,
  snapshotAt,
  startedAt: new Date().toISOString(),
  status: 'running',
  shadow: true,
  canonicalWritesEnabled: false,
  tables: canonicalTables,
  counts: {
    artist: emptyCounts(),
    venue: emptyCounts(),
    event: emptyCounts(),
    festival: emptyCounts(),
  },
  totals: emptyCounts(),
  skippedWithoutId: 0,
  errors: [],
};

function addTotals(target: TypeCounts): void {
  for (const key of Object.keys(target) as Array<keyof TypeCounts>) {
    summary.totals[key] = summary.counts.artist[key]
      + summary.counts.venue[key]
      + summary.counts.event[key]
      + summary.counts.festival[key];
  }
}

function canonicalId(record: Record<string, unknown>): string | undefined {
  const value = record.id;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function logicalEventType(record: Record<string, unknown>): 'event' | 'festival' {
  return record.entityType === 'festival' ? 'festival' : 'event';
}

function isEvidenceAlreadyExists(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value.name === 'PreconditionFailed' || value.$metadata?.httpStatusCode === 412;
}

async function putEvidence(observation: SourceObservation, body: string): Promise<'created' | 'existing'> {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: evidenceBucket,
      Key: observation.evidenceKey,
      Body: body,
      ContentType: 'application/json; charset=utf-8',
      IfNoneMatch: '*',
      Metadata: {
        sourceid: observation.sourceId,
        observationid: observation.id,
        snapshotid: snapshotId,
      },
    }));
    return 'created';
  } catch (error) {
    if (isEvidenceAlreadyExists(error)) return 'existing';
    throw error;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function batchWrite(items: Record<string, unknown>[]): Promise<void> {
  for (const group of chunk(items, 25)) {
    let requestItems: NonNullable<BatchWriteCommandInput['RequestItems']> = {
      [stateTable]: group.map((Item) => ({ PutRequest: { Item } })),
    };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await ddb.send(new BatchWriteCommand({ RequestItems: requestItems }));
      const remaining = result.UnprocessedItems?.[stateTable] ?? [];
      if (remaining.length === 0) break;
      if (attempt === 7) throw new Error(`DynamoDB left ${remaining.length} unprocessed baseline rows after retries`);
      await new Promise((resolve) => setTimeout(resolve, 50 * (2 ** attempt)));
      requestItems = { [stateTable]: remaining };
    }
  }
}

async function processEntity(entityType: BaselineEntityType, record: Record<string, unknown>): Promise<void> {
  const id = canonicalId(record);
  if (!id) {
    summary.skippedWithoutId += 1;
    return;
  }

  const sourceId = sourceIds[entityType];
  const recordJson = stableJson(record);
  const contentHash = sha256(recordJson);
  const observationId = `bndy-baseline:${snapshotId}:${entityType}:${id}:${contentHash.slice(0, 16)}`;
  const envelope = stableJson({
    snapshotId,
    snapshotAt,
    entityType,
    canonicalEntityId: id,
    record,
  });

  const observationBase: SourceObservation = {
    id: observationId,
    sourceId,
    observedAt: snapshotAt,
    captureHash: contentHash,
    enumerationMethod: 'bndy-canonical-dynamodb-baseline-v1',
    complete: true,
    paginationComplete: true,
    captureStable: true,
    itemCount: 1,
    contentType: 'application/json; charset=utf-8',
  };
  const evidenceKey = observationKeys.evidenceKey(observationBase, 'json');
  const observation: SourceObservation = { ...observationBase, evidenceKey };
  const evidenceResult = await putEvidence(observation, envelope);

  const claims = buildCanonicalBaselineClaims({
    snapshotId,
    snapshotAt,
    sourceId,
    entityType,
    canonicalId: id,
    observationId,
    record,
    contentHash,
  });
  const resolvesTo = claims.find((claim) => claim.predicate === 'resolvesTo');
  if (!resolvesTo) throw new Error(`No resolvesTo claim generated for ${entityType}:${id}`);

  const resolution: EntityResolution = {
    candidateType: entityType,
    candidateKey: `bndy:${entityType}:${id}`,
    canonicalEntityId: id,
    method: 'canonical-self-baseline',
    confidence: 1,
    supportingClaimIds: [resolvesTo.id],
    status: 'resolved',
    resolvedAt: snapshotAt,
  };

  await batchWrite([
    sourceObservationItem(observation),
    ...claims.map(knowledgeClaimItem),
    entityResolutionItem(resolution, { sourceId, snapshotId }),
  ]);

  const counts = summary.counts[entityType];
  counts.entities += 1;
  counts.observations += 1;
  counts.claims += claims.length;
  counts.resolutions += 1;
  counts[evidenceResult === 'created' ? 'evidenceCreated' : 'evidenceExisting'] += 1;
  const provenance = provenanceForRecord(record);
  counts[provenance.classification === 'bndy-legacy-canonical' ? 'legacyCanonicalEntities' : 'recoverableSourceEntities'] += 1;
}

async function mapLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  }));
}

async function scanCanonicalTable(
  tableName: string,
  classify: (record: Record<string, unknown>) => BaselineEntityType,
): Promise<void> {
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }));
    const records = (page.Items ?? []) as Record<string, unknown>[];
    await mapLimit(records, 6, async (record) => processEntity(classify(record), record));
    ExclusiveStartKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    addTotals(summary.totals);
    console.log(JSON.stringify({
      progress: true,
      tableName,
      snapshotId,
      totals: summary.totals,
      skippedWithoutId: summary.skippedWithoutId,
    }));
  } while (ExclusiveStartKey);
}

async function writeManifest(): Promise<void> {
  addTotals(summary.totals);
  await ddb.send(new PutCommand({
    TableName: stateTable,
    Item: {
      pk: `BASELINE#${snapshotId}`,
      sk: 'META',
      entityType: 'CanonicalBaselineSnapshot',
      ...summary,
    },
  }));
}

async function main(): Promise<void> {
  for (const entityType of ['artist', 'venue', 'event', 'festival'] as const) {
    await registry.put(sourceConfig(entityType));
  }

  try {
    await scanCanonicalTable(canonicalTables.artist, () => 'artist');
    await scanCanonicalTable(canonicalTables.venue, () => 'venue');
    await scanCanonicalTable(canonicalTables.event, logicalEventType);
    if (summary.skippedWithoutId > 0) {
      throw new Error(`Baseline skipped ${summary.skippedWithoutId} canonical rows without id`);
    }
    summary.status = 'complete';
    summary.completedAt = new Date().toISOString();
    await writeManifest();
    for (const entityType of ['artist', 'venue', 'event', 'festival'] as const) {
      await registry.put({ ...sourceConfig(entityType), lastSuccessfulScanAt: summary.completedAt });
    }
    console.log(JSON.stringify(summary));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summary.status = 'failed';
    summary.completedAt = new Date().toISOString();
    summary.errors.push(message);
    await writeManifest();
    console.error(JSON.stringify(summary));
    throw error;
  }
}

await main();
