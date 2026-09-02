import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  assertGlobalCanonicalWritesDisabled,
  isReadOnlyPlan,
  namedArgument,
  requireCanonicalBacklineConfirmation,
  requiredNamedArgument,
} from '../bndy-baseline/operation-gate.js';
import { SourceObservationSchema, type KnowledgeClaim, type SourceObservation } from '../knowledge/types.js';
import { ClaimStore } from '../knowledge/stores/claim-store.js';
import { OBSERVATION_INDEX } from '../knowledge/stores/observation-store.js';
import { SourceRegistryStore } from '../knowledge/stores/source-registry-store.js';
import { DynamoProjectionControlStore } from '../projection/control-store.js';
import {
  latestActiveStringClaim,
  occursAtMissingVenueLocation,
  repairOccursAtClaim,
  type VenueLocationEvidence,
} from '../repair/lemonrock-occurs-at.js';
import { parseLemonrock } from '../sources/adapters/lemonrock/parse.js';
import type { SourceRunContext } from '../sources/runner/types.js';

const SOURCE_ID = 'lemonrock-gig-hydration';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveIntegerArgument(args: string[], name: string, fallback: number): number {
  const raw = namedArgument(args, name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}

const args = process.argv.slice(2);
const dryRun = isReadOnlyPlan(args);
if (!dryRun) requireCanonicalBacklineConfirmation(args, 'lemonrock-occurs-at-repair');
const runId = requiredNamedArgument(args, 'run-id');
const candidateLimit = positiveIntegerArgument(args, 'limit', 25_000);
const onlyCandidateKey = namedArgument(args, 'candidate-key');
const stateTable = requiredEnv('STATE_TABLE');
const evidenceBucket = requiredEnv('EVIDENCE_BUCKET');
const region = process.env.AWS_REGION ?? 'eu-west-2';
const startedAt = new Date().toISOString();
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({ region });
const claims = new ClaimStore(stateTable);
const registry = new SourceRegistryStore(stateTable);
const controls = new DynamoProjectionControlStore(stateTable);

const summary = {
  runId,
  sourceId: SOURCE_ID,
  mode: dryRun ? 'read-only-plan' : 'backline-write',
  startedAt,
  completedAt: undefined as string | undefined,
  candidatesInspected: 0,
  observationsInspected: 0,
  alreadyComplete: 0,
  repairableFromGigEvidence: 0,
  repairableFromVenueClaims: 0,
  repairsPlanned: 0,
  repairsWritten: 0,
  repairsAlreadyPresent: 0,
  unresolved: 0,
  unresolvedSamples: [] as Array<{ candidateKey: string; observationId: string; reason: string }>,
  errors: [] as string[],
};

async function writeManifest(status: 'running' | 'complete' | 'failed'): Promise<void> {
  if (dryRun) return;
  await ddb.send(new PutCommand({
    TableName: stateTable,
    Item: {
      pk: `REPAIR#LEMONROCK_OCCURS_AT#${runId}`,
      sk: 'META',
      entityType: 'BacklineRepairRun',
      repairType: 'lemonrock-occurs-at-venue-location-v1',
      status,
      ...summary,
      updatedAt: new Date().toISOString(),
    },
  }));
}

async function* sourceObservations(): AsyncGenerator<SourceObservation> {
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const response = await ddb.send(new QueryCommand({
      TableName: stateTable,
      IndexName: OBSERVATION_INDEX,
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `SOURCE#${SOURCE_ID}`,
        ':prefix': 'OBS#',
      },
      ScanIndexForward: false,
      ExclusiveStartKey: exclusiveStartKey,
    }));
    for (const item of response.Items ?? []) yield SourceObservationSchema.parse(item);
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);
}

async function evidenceText(observation: SourceObservation): Promise<string> {
  if (!observation.evidenceKey) throw new Error('Observation has no evidenceKey');
  const response = await s3.send(new GetObjectCommand({
    Bucket: evidenceBucket,
    Key: observation.evidenceKey,
  }));
  const text = await response.Body?.transformToString('utf-8');
  if (!text) throw new Error('Retained evidence object is empty');
  return text;
}

function runContext(candidateKey: string): SourceRunContext {
  const sourceEventKey = candidateKey.replace(`event:${SOURCE_ID}:`, '');
  return {
    runId,
    sourceId: SOURCE_ID,
    startedAt,
    runDate: startedAt.slice(0, 10),
    reason: 'manual',
    requestedAt: startedAt,
    task: { kind: 'gig', nativeId: sourceEventKey, evidenceReplay: true },
  };
}

function occursAtObject(claim: KnowledgeClaim): Record<string, unknown> {
  return claim.value && typeof claim.value === 'object' && !Array.isArray(claim.value)
    ? claim.value as Record<string, unknown>
    : {};
}

async function locationEvidence(
  observation: SourceObservation,
  original: KnowledgeClaim,
): Promise<VenueLocationEvidence | undefined> {
  const sourceUrl = observation.sourceUrl ?? original.evidence?.sourceUrl;
  let replayFailure: string | undefined;
  if (sourceUrl) {
    try {
      const parsed = parseLemonrock(await evidenceText(observation), sourceUrl, runContext(original.subject.key));
      const replayed = parsed.events.find((event) => `event:${SOURCE_ID}:${event.sourceEventKey}` === original.subject.key);
      if (replayed?.venueLocation?.trim()) {
        return { location: replayed.venueLocation, method: 'gig-evidence-replay', confidence: original.confidence };
      }
    } catch (error) {
      replayFailure = error instanceof Error ? error.message : String(error);
    }
  } else {
    replayFailure = 'Observation and Claim have no source URL';
  }

  const venueNativeId = occursAtObject(original).sourceNativeId;
  if (typeof venueNativeId !== 'string' || !venueNativeId) return undefined;
  const venueClaims = await claims.listBySubjectComplete('venue-candidate', venueNativeId, 1000);
  const venueLocation = latestActiveStringClaim(venueClaims, 'hasLocation');
  if (typeof venueLocation?.value !== 'string') {
    if (replayFailure) throw new Error(`Retained gig evidence replay failed: ${replayFailure}; no active venue location Claim`);
    return undefined;
  }
  return {
    location: venueLocation.value,
    method: 'venue-claim-join',
    supportingClaimId: venueLocation.id,
    confidence: venueLocation.confidence,
  };
}

function recordUnresolved(candidateKey: string, observationId: string, reason: string): void {
  summary.unresolved += 1;
  if (summary.unresolvedSamples.length < 25) summary.unresolvedSamples.push({ candidateKey, observationId, reason });
}

async function processObservation(observation: SourceObservation, seen: Set<string>): Promise<boolean> {
  summary.observationsInspected += 1;
  const observationClaims = await claims.listByObservation(observation.id, 1000);
  const occursAtClaims = observationClaims.filter((claim) => claim.predicate === 'occursAt' && claim.status === 'active');
  for (const original of occursAtClaims) {
    const candidateKey = original.subject.key;
    if (onlyCandidateKey && candidateKey !== onlyCandidateKey) continue;
    if (seen.has(candidateKey)) continue;
    seen.add(candidateKey);
    summary.candidatesInspected += 1;
    if (!occursAtMissingVenueLocation(original)) {
      summary.alreadyComplete += 1;
      continue;
    }
    try {
      const evidence = await locationEvidence(observation, original);
      if (!evidence) {
        recordUnresolved(candidateKey, observation.id, 'No venue locality in retained gig evidence or active venue Claims');
        continue;
      }
      if (evidence.method === 'gig-evidence-replay') summary.repairableFromGigEvidence += 1;
      else summary.repairableFromVenueClaims += 1;
      const repair = repairOccursAtClaim(original, evidence, startedAt);
      summary.repairsPlanned += 1;
      if (dryRun) continue;
      if (await claims.get(repair.id)) {
        summary.repairsAlreadyPresent += 1;
        continue;
      }
      await claims.put(repair);
      summary.repairsWritten += 1;
    } catch (error) {
      recordUnresolved(candidateKey, observation.id, error instanceof Error ? error.message : String(error));
    }
  }
  return summary.candidatesInspected >= candidateLimit;
}

async function main(): Promise<void> {
  const source = await registry.get(SOURCE_ID);
  if (!source) throw new Error(`Source ${SOURCE_ID} does not exist`);
  if (source.enabled) throw new Error(`Source ${SOURCE_ID} must be disabled before repair`);
  if (!source.shadow) throw new Error(`Source ${SOURCE_ID} must remain in shadow mode`);
  assertGlobalCanonicalWritesDisabled(await controls.canonicalWritesEnabled());
  await writeManifest('running');

  const seen = new Set<string>();
  for await (const observation of sourceObservations()) {
    if (await processObservation(observation, seen)) break;
  }
  summary.completedAt = new Date().toISOString();
  await writeManifest('complete');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(async (error) => {
  summary.completedAt = new Date().toISOString();
  summary.errors.push(error instanceof Error ? error.message : String(error));
  await writeManifest('failed').catch(() => undefined);
  console.error(JSON.stringify(summary, null, 2));
  process.exitCode = 1;
});
