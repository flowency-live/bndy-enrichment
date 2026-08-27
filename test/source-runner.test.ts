import { describe, expect, it } from 'vitest';
import type { GigSource, KnowledgeClaim, ProjectionWorkItem, SourceObservation } from '../src/knowledge/types.js';
import type { SourceParityArtifact } from '../src/parity/source-parity.js';
import { HttpAcquisitionRouter, assertSafeUrl, type HostResolver } from '../src/sources/runner/acquisition.js';
import type { SourceAdapter } from '../src/sources/runner/adapter.js';
import { runSource, type RunnerDependencies } from '../src/sources/runner/runner.js';
import type { SourceRunArtifactStore } from '../src/sources/runner/storage.js';
import type { NormalisedSourceEvent, SourceEventDiff, SourceRunContext, SourceRunReport } from '../src/sources/runner/types.js';

function config(overrides: Partial<GigSource> = {}): GigSource {
  return {
    id: 'fixture-source',
    name: 'Fixture Source',
    type: 'CURATED_SOURCE',
    url: 'https://example.test/gigs',
    timezone: 'Europe/London',
    cadence: 'daily',
    localTime: '09:00',
    mode: 'delta',
    snapshotSemantics: 'complete',
    authorityClass: 'curated',
    thresholds: {},
    adapter: 'fixture',
    runtimeClass: 'standard',
    enabled: false,
    shadow: true,
    writerAuthority: 'cowork',
    health: 'healthy',
    ...overrides,
  };
}

function event(key: string, hash: string, overrides: Partial<NormalisedSourceEvent> = {}): NormalisedSourceEvent {
  return {
    sourceEventKey: key,
    artistName: `Artist ${key}`,
    venueName: `Venue ${key}`,
    date: '2026-08-25',
    startTime: '20:00',
    contentHash: hash,
    ...overrides,
  };
}

class MemoryArtifacts implements SourceRunArtifactStore {
  readonly normalisedWrites: NormalisedSourceEvent[][] = [];
  readonly diffWrites: SourceEventDiff[] = [];
  readonly parityWrites: SourceParityArtifact[] = [];
  readonly reports: SourceRunReport[] = [];
  constructor(readonly prior: NormalisedSourceEvent[]) {}
  async writeNormalised(_config: GigSource, _run: SourceRunContext, events: NormalisedSourceEvent[]): Promise<string> {
    this.normalisedWrites.push(events); return 'runs/current/normalised.json';
  }
  async writeDiff(_config: GigSource, _run: SourceRunContext, diff: SourceEventDiff): Promise<string> {
    this.diffWrites.push(diff); return 'runs/current/diff.json';
  }
  async writeParity(_config: GigSource, _run: SourceRunContext, parity: SourceParityArtifact): Promise<string> {
    this.parityWrites.push(structuredClone(parity)); return 'runs/current/parity.json';
  }
  async writeReport(_config: GigSource, _run: SourceRunContext, report: SourceRunReport): Promise<string> {
    this.reports.push(structuredClone(report)); return 'runs/current/report.json';
  }
  async loadNormalised(): Promise<NormalisedSourceEvent[]> { return this.prior; }
}

function fixtureDependencies(captureComplete: boolean) {
  const source = config();
  const prior = [event('e1', 'old'), event('e3', 'gone')];
  const current = [event('e1', 'new'), event('e2', 'new')];
  const artifacts = new MemoryArtifacts(prior);
  const claims: KnowledgeClaim[] = [];
  const projection: ProjectionWorkItem[] = [];
  const states: any[] = [];
  const observations: SourceObservation[] = [];
  const metrics: SourceRunReport[] = [];

  const adapter: SourceAdapter = {
    async fetch() {
      return {
        kind: 'json' as const,
        body: JSON.stringify(current),
        sourceUrl: source.url,
        fetchMethod: 'fixture',
        fetchedAt: '2026-08-20T10:00:00.000Z',
        complete: captureComplete,
        contentType: 'application/json',
      };
    },
    async parse() { return { events: current, parked: [], warnings: [] }; },
  };

  const deps: RunnerDependencies = {
    registry: { async get() { return source; } },
    state: {
      async get() {
        return {
          sourceId: source.id,
          lastObservationId: 'obs-prior',
          lastCompleteObservationId: 'obs-complete-prior',
          consecutiveFailures: 0,
          metadata: {
            lastNormalisedKey: 'runs/prior/normalised.json',
            lastCompleteNormalisedKey: 'runs/prior-complete/normalised.json',
          },
        };
      },
      async put(state) { states.push(structuredClone(state)); },
    },
    observations: {
      async put(observation) {
        const stored = { ...observation, evidenceKey: `evidence/${observation.id}/raw.json` };
        observations.push(stored);
        return stored;
      },
    },
    claims: { async put(claim) { claims.push(claim); } },
    artifacts,
    projection: { async publish(item) { projection.push(item); } },
    metrics: { async put(report) { metrics.push(structuredClone(report)); } },
    acquisition: { async acquire() { throw new Error('adapter should not call acquisition in fixture'); } },
    loadAdapter: () => adapter,
    now: () => new Date('2026-08-20T10:00:00.000Z'),
    newId: () => 'run-fixed',
  };

  return { deps, artifacts, claims, projection, states, observations, metrics };
}

describe('target Source Runner', () => {
  it('produces Observation, Claims, diff, parity artifact, one ProjectionWorkItem per change and a report', async () => {
    const fx = fixtureDependencies(true);
    const result = await runSource({
      sourceId: 'fixture-source',
      reason: 'manual',
      requestedAt: '2026-08-20T09:59:00.000Z',
    }, fx.deps);

    expect(result.report.status).toBe('completed');
    expect(fx.observations).toHaveLength(1);
    expect(result.observation?.complete).toBe(true);
    expect(result.diff?.added.map((item) => item.sourceEventKey)).toEqual(['e2']);
    expect(result.diff?.updated.map((item) => item.sourceEventKey)).toEqual(['e1']);
    expect(result.diff?.withdrawn.map((item) => item.sourceEventKey)).toEqual(['e3']);
    expect(result.projectionWorkItems.map((item) => item.action).sort()).toEqual(['create', 'update', 'withdraw']);
    expect(result.projectionWorkItems).toHaveLength(3);
    expect(result.projectionWorkItems.every((item) => item.runId === 'run-run-fixed')).toBe(true);
    expect(result.projectionWorkItems.every((item) => item.runItemCount === 3)).toBe(true);
    expect(fx.projection).toHaveLength(3);
    expect(fx.claims.some((claim) => claim.predicate === 'hasStatus' && claim.value === 'absent-from-complete-snapshot')).toBe(true);
    expect(result.report.projectionWorkItems).toBe(3);
    expect(fx.artifacts.parityWrites).toHaveLength(1);
    expect(fx.artifacts.parityWrites[0]?.evidenceSha256).toBe(result.observation?.captureHash);
    expect(fx.artifacts.parityWrites[0]?.diff).toEqual({
      added: ['e2'], updated: ['e1'], unchanged: [], withdrawn: ['e3'], pastDropped: [], ignoredAbsences: [],
    });
    expect(fx.artifacts.parityWrites[0]?.provenance).toMatchObject({
      runtime: 'aws-bndy-enrichment', runId: 'run-run-fixed', fetchMethod: 'fixture', complete: 'true',
    });
    expect(result.report.artifacts.parity).toBe('runs/current/parity.json');
    expect(fx.artifacts.reports).toHaveLength(1);
    expect(fx.metrics).toHaveLength(1);
    expect(fx.metrics[0]).toMatchObject({
      sourceId: 'fixture-source', status: 'completed', added: 1, updated: 1, withdrawn: 1,
    });
    expect(fx.metrics[0]?.artifacts.report).toBe('runs/current/report.json');
    expect(fx.states.at(-1)?.lastCompleteObservationId).toBe(result.observation?.id);
    expect(fx.states.at(-1)?.metadata.lastCompleteNormalisedKey).toBe('runs/current/normalised.json');
    expect(fx.states.at(-1)?.metadata.lastParityKey).toBe('runs/current/parity.json');
  });

  it('allows positive additions/updates but produces zero withdrawals for an incomplete capture', async () => {
    const fx = fixtureDependencies(false);
    const result = await runSource({
      sourceId: 'fixture-source',
      reason: 'scheduled',
      requestedAt: '2026-08-20T10:00:00.000Z',
    }, fx.deps);

    expect(result.report.status).toBe('completed');
    expect(result.observation?.complete).toBe(false);
    expect(result.diff?.added).toHaveLength(1);
    expect(result.diff?.updated).toHaveLength(1);
    expect(result.diff?.withdrawn).toHaveLength(0);
    expect(result.diff?.ignoredAbsences.map((item) => item.sourceEventKey)).toEqual(['e3']);
    expect(result.projectionWorkItems.map((item) => item.action).sort()).toEqual(['create', 'update']);
    expect(fx.claims.some((claim) => claim.value === 'absent-from-complete-snapshot')).toBe(false);
    expect(fx.artifacts.parityWrites[0]?.diff?.withdrawn).toEqual([]);
    expect(fx.artifacts.parityWrites[0]?.diff?.ignoredAbsences).toEqual(['e3']);
    expect(fx.states.at(-1)?.lastCompleteObservationId).toBe('obs-complete-prior');
    expect(fx.states.at(-1)?.metadata.lastCompleteNormalisedKey).toBe('runs/prior-complete/normalised.json');
  });

  it('append-only mode never withdraws from absence even when capture is complete', async () => {
    const fx = fixtureDependencies(true);
    const originalGet = fx.deps.registry.get;
    fx.deps.registry.get = async (sourceId) => ({ ...(await originalGet(sourceId))!, mode: 'append-only' });
    const result = await runSource({ sourceId: 'fixture-source', reason: 'manual', requestedAt: '2026-08-20T10:00:00.000Z' }, fx.deps);
    expect(result.diff?.withdrawn).toHaveLength(0);
    expect(result.projectionWorkItems.some((item) => item.action === 'withdraw')).toBe(false);
  });

  it('turns explicit cancellation evidence into cancel rather than withdrawal', async () => {
    const fx = fixtureDependencies(true);
    const originalAdapter = fx.deps.loadAdapter(config())!;
    fx.deps.loadAdapter = () => ({
      ...originalAdapter,
      async parse(sourceConfig, run, raw) {
        const parsed = await originalAdapter.parse(sourceConfig, run, raw);
        return { ...parsed, events: parsed.events.map((item) => item.sourceEventKey === 'e2' ? { ...item, status: 'cancelled' } : item) };
      },
    });
    const result = await runSource({ sourceId: 'fixture-source', reason: 'manual', requestedAt: '2026-08-20T10:00:00.000Z' }, fx.deps);
    expect(result.projectionWorkItems.find((entry) => entry.candidateKey.endsWith(':e2'))?.action).toBe('cancel');
    expect(result.projectionWorkItems.find((entry) => entry.candidateKey.endsWith(':e3'))?.action).toBe('withdraw');
  });
});

describe('acquisition SSRF and response guards', () => {
  it('rejects non-http protocols and literal private addresses', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow(/Unsupported source protocol/);
    expect(() => assertSafeUrl('http://127.0.0.1/admin')).toThrow(/Blocked private/);
    expect(() => assertSafeUrl('http://localhost/admin')).toThrow(/Blocked source hostname/);
  });

  it('rejects DNS rebinding to a private address before fetch', async () => {
    const resolver: HostResolver = { async resolve() { return ['10.0.0.7']; } };
    let fetched = false;
    const router = new HttpAcquisitionRouter(resolver, (async () => {
      fetched = true;
      return new Response('nope');
    }) as typeof fetch);
    await expect(router.acquire({ url: 'https://example.test' })).rejects.toThrow(/blocked address/i);
    expect(fetched).toBe(false);
  });

  it('enforces actual response byte caps', async () => {
    const resolver: HostResolver = { async resolve() { return ['93.184.216.34']; } };
    const router = new HttpAcquisitionRouter(resolver, (async () => new Response('1234567890', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })) as typeof fetch);
    await expect(router.acquire({ url: 'https://example.test', maxBytes: 5 })).rejects.toThrow(/byte cap/);
  });
});
