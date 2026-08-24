import { createHash, randomUUID } from 'node:crypto';
import type { GigSource, KnowledgeClaim, SourceObservation } from '../../knowledge/types.js';
import type { ClaimStore, ObservationStore, SourceRegistryStore, SourceRuntimeState, SourceStateStore } from '../../knowledge/stores/index.js';
import { buildParityArtifact } from '../../parity/source-parity.js';
import type { AcquisitionRouter } from './acquisition.js';
import type { SourceAdapter } from './adapter.js';
import { diffSourceEvents } from './diff.js';
import type { SourceFanoutPublisher } from './fanout.js';
import { buildKnowledge, buildProjectionWork } from './knowledge.js';
import type { ProjectionPublisher } from './projection-publisher.js';
import type { SourceRunArtifactStore } from './storage.js';
import type {
  FetchedSource,
  NormalisedSourceEntity,
  NormalisedSourceEvent,
  SourceRunContext,
  SourceRunnerResult,
  SourceRunReport,
} from './types.js';

export type SourceRunRequest = {
  sourceId: string;
  reason: 'scheduled' | 'manual';
  requestedAt: string;
  reconciliationId?: string;
  taskKey?: string;
  task?: Record<string, unknown>;
};

export interface RunnerSourceRegistry {
  get(sourceId: string): Promise<GigSource | null>;
}

export interface RunnerStateStore {
  get(sourceId: string): Promise<SourceRuntimeState | null>;
  put(state: SourceRuntimeState): Promise<void>;
}

export interface RunnerObservationStore {
  put(observation: SourceObservation, payload: string, options?: { contentType?: string; extension?: string }): Promise<SourceObservation>;
}

export interface RunnerClaimStore {
  put(claim: KnowledgeClaim): Promise<void>;
}

export type RunnerDependencies = {
  registry: RunnerSourceRegistry;
  state: RunnerStateStore;
  observations: RunnerObservationStore;
  claims: RunnerClaimStore;
  artifacts: SourceRunArtifactStore;
  projection: ProjectionPublisher;
  fanout?: SourceFanoutPublisher;
  acquisition: AcquisitionRouter;
  loadAdapter: (config: GigSource) => SourceAdapter | undefined;
  now?: () => Date;
  newId?: () => string;
};

function extension(raw: FetchedSource): string {
  if (raw.kind === 'csv') return 'csv';
  if (raw.kind === 'html') return 'html';
  if (raw.kind === 'json') return 'json';
  return 'txt';
}

function observationFor(
  config: GigSource,
  raw: FetchedSource,
  events: NormalisedSourceEvent[],
  entities: NormalisedSourceEntity[],
  run: SourceRunContext,
): SourceObservation {
  return {
    id: `obs-${randomUUID()}`,
    sourceId: config.id,
    observedAt: raw.fetchedAt || run.startedAt,
    sourceUrl: raw.sourceUrl ?? config.url,
    captureHash: createHash('sha256').update(raw.body).digest('hex'),
    enumerationMethod: raw.fetchMethod,
    complete: raw.complete,
    paginationComplete: raw.paginationComplete,
    captureStable: raw.captureStable,
    itemCount: events.length + entities.length,
    futureItemCount: events.filter((event) => !event.date || event.date >= run.runDate).length,
    httpStatus: raw.httpStatus,
    contentType: raw.contentType,
    structuralFingerprint: raw.structuralFingerprint,
  };
}

function baselineKey(state: SourceRuntimeState | null, config: GigSource, captureComplete: boolean): string | undefined {
  const metadata = state?.metadata ?? {};
  const needsCompleteBaseline = captureComplete && config.mode === 'delta' && config.snapshotSemantics === 'complete';
  const value = needsCompleteBaseline ? metadata.lastCompleteNormalisedKey : metadata.lastNormalisedKey;
  return typeof value === 'string' ? value : undefined;
}

function initialReport(config: GigSource, run: SourceRunContext): SourceRunReport {
  return {
    runId: run.runId,
    sourceId: config.id,
    reconciliationId: run.reconciliationId,
    startedAt: run.startedAt,
    completedAt: run.startedAt,
    status: 'completed',
    reason: run.reason,
    rawItems: 0,
    validEvents: 0,
    entityProfiles: 0,
    parked: 0,
    claims: 0,
    added: 0,
    updated: 0,
    withdrawn: 0,
    unchanged: 0,
    projectionWorkItems: 0,
    fanoutQueued: 0,
    fanoutDuplicates: 0,
    shadow: config.shadow,
    writerAuthority: config.writerAuthority,
    warnings: [],
    errors: [],
    artifacts: {},
  };
}

async function recordFailure(
  stateStore: RunnerStateStore,
  previous: SourceRuntimeState | null,
  sourceId: string,
  now: string,
): Promise<void> {
  await stateStore.put({
    sourceId,
    lastObservationId: previous?.lastObservationId,
    lastCompleteObservationId: previous?.lastCompleteObservationId,
    lastRunAt: now,
    lastSuccessfulRunAt: previous?.lastSuccessfulRunAt,
    lastFailureAt: now,
    consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
    cursor: previous?.cursor,
    metadata: previous?.metadata,
  });
}

export async function runSource(request: SourceRunRequest, deps: RunnerDependencies): Promise<SourceRunnerResult> {
  const config = await deps.registry.get(request.sourceId);
  if (!config) throw new Error(`Unknown source: ${request.sourceId}`);
  const adapter = deps.loadAdapter(config);
  if (!adapter) throw new Error(`No adapter registered for ${config.adapter ?? config.id}`);

  const clock = deps.now ?? (() => new Date());
  const idFactory = deps.newId ?? randomUUID;
  const started = clock();
  const runId = `run-${idFactory()}`;
  const run: SourceRunContext = {
    runId,
    sourceId: config.id,
    reconciliationId: request.reconciliationId
      ?? (request.sourceId === 'lemonrock-full-reconcile' ? runId : undefined),
    startedAt: started.toISOString(),
    runDate: started.toISOString().slice(0, 10),
    reason: request.reason,
    requestedAt: request.requestedAt,
    taskKey: request.taskKey,
    task: request.task,
  };
  const report = initialReport(config, run);
  const previousState = await deps.state.get(config.id);

  try {
    const raw = await adapter.fetch(config, run, deps.acquisition);
    const parsed = await adapter.parse(config, run, raw);
    const entities = parsed.entities ?? [];
    report.rawItems = parsed.events.length + entities.length + parsed.parked.length;
    report.validEvents = parsed.events.length;
    report.entityProfiles = entities.length;
    report.parked = parsed.parked.length;
    report.warnings.push(...parsed.warnings);

    const storedObservation = await deps.observations.put(
      observationFor(config, raw, parsed.events, entities, run),
      raw.body,
      { contentType: raw.contentType, extension: extension(raw) },
    );
    report.observationId = storedObservation.id;
    report.complete = storedObservation.complete;

    const knowledge = buildKnowledge(storedObservation, parsed.events, entities);
    for (const claim of knowledge.claims) await deps.claims.put(claim);
    report.claims = knowledge.claims.length;

    if ((parsed.nextRequests?.length ?? 0) > 0) {
      if (!deps.fanout) throw new Error(`Source ${config.id} produced child work but SOURCE_SCAN_QUEUE_URL is not configured`);
      for (const child of parsed.nextRequests ?? []) {
        const queued = await deps.fanout.publish(child, run.startedAt, run.reconciliationId);
        if (queued) report.fanoutQueued += 1;
        else report.fanoutDuplicates += 1;
      }
    }

    const normalisedKey = await deps.artifacts.writeNormalised(config, run, parsed.events);
    report.artifacts.normalised = normalisedKey;

    const previousEvents = await deps.artifacts.loadNormalised(
      baselineKey(previousState, config, storedObservation.complete),
    );
    const diff = diffSourceEvents(previousEvents, parsed.events, config, {
      runDate: run.runDate,
      captureComplete: storedObservation.complete,
    });
    const diffKey = await deps.artifacts.writeDiff(config, run, diff);
    report.artifacts.diff = diffKey;
    report.added = diff.added.length;
    report.updated = diff.updated.length;
    report.withdrawn = diff.withdrawn.length;
    report.unchanged = diff.unchanged.length;

    const parity = buildParityArtifact({
      sourceId: config.id,
      runDate: run.runDate,
      evidence: raw.body,
      parsed,
      diff,
      provenance: {
        runtime: 'aws-bndy-enrichment',
        runId: run.runId,
        observationId: storedObservation.id,
        fetchMethod: raw.fetchMethod,
        sourceUrl: raw.sourceUrl ?? config.url ?? 'unknown',
        complete: String(storedObservation.complete),
      },
    });
    if (parity.evidenceSha256 !== storedObservation.captureHash) {
      throw new Error(`Parity evidence hash does not match Observation captureHash for ${storedObservation.id}`);
    }
    const parityKey = await deps.artifacts.writeParity(config, run, parity);
    report.artifacts.parity = parityKey;

    const projection = buildProjectionWork(storedObservation, diff, knowledge.claimsByCandidate);
    for (const claim of projection.withdrawalClaims) await deps.claims.put(claim);
    report.claims += projection.withdrawalClaims.length;

    const totalWork = projection.workItems.length;
    projection.workItems.forEach((item, index) => {
      item.runId = run.runId;
      item.runItemCount = totalWork || undefined;
      item.runOrdinal = index + 1;
    });
    for (const item of projection.workItems) await deps.projection.publish(item);
    report.projectionWorkItems = totalWork;

    const priorMetadata = previousState?.metadata ?? {};
    const metadata: Record<string, unknown> = {
      ...priorMetadata,
      lastNormalisedKey: normalisedKey,
      lastDiffKey: diffKey,
      lastParityKey: parityKey,
      lastTaskKey: request.taskKey,
    };
    if (run.reconciliationId) metadata.lastReconciliationId = run.reconciliationId;
    if (storedObservation.complete) metadata.lastCompleteNormalisedKey = normalisedKey;

    await deps.state.put({
      sourceId: config.id,
      lastObservationId: storedObservation.id,
      lastCompleteObservationId: storedObservation.complete
        ? storedObservation.id
        : previousState?.lastCompleteObservationId,
      lastRunAt: run.startedAt,
      lastSuccessfulRunAt: run.startedAt,
      lastFailureAt: previousState?.lastFailureAt,
      consecutiveFailures: 0,
      cursor: previousState?.cursor,
      metadata,
    });

    report.completedAt = clock().toISOString();
    const reportKey = await deps.artifacts.writeReport(config, run, report);
    report.artifacts.report = reportKey;

    return {
      config,
      report,
      observation: storedObservation,
      claims: [...knowledge.claims, ...projection.withdrawalClaims],
      candidates: knowledge.candidates,
      diff,
      projectionWorkItems: projection.workItems,
    };
  } catch (error) {
    report.status = 'failed';
    report.completedAt = clock().toISOString();
    report.errors.push({
      step: 'run',
      message: error instanceof Error ? error.message : String(error),
    });
    await recordFailure(deps.state, previousState, config.id, report.completedAt);
    try {
      const reportKey = await deps.artifacts.writeReport(config, run, report);
      report.artifacts.report = reportKey;
    } catch (reportError) {
      report.errors.push({
        step: 'generate_report',
        message: reportError instanceof Error ? reportError.message : String(reportError),
      });
    }
    return {
      config,
      report,
      claims: [],
      candidates: [],
      projectionWorkItems: [],
    };
  }
}

void (0 as unknown as SourceRegistryStore | SourceStateStore | ObservationStore | ClaimStore);
