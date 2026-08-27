import { describe, expect, it, vi } from 'vitest';
import type { GigSource, KnowledgeClaim, ProjectionWorkItem, Tombstone } from '../src/knowledge/types.js';
import { AuthorityPolicy } from '../src/projection/authority-policy.js';
import type { ProjectionBndyApi } from '../src/projection/bndy-api.js';
import { projectWorkItem, type ProjectionDependencies } from '../src/projection/engine.js';

const candidateKey = 'event:test-source:gig-1';

function source(overrides: Partial<GigSource> = {}): GigSource {
  return {
    id: 'test-source',
    name: 'Test Source',
    type: 'CURATED_SOURCE',
    url: 'https://example.test',
    timezone: 'Europe/London',
    cadence: 'daily',
    localTime: '09:00',
    mode: 'delta',
    snapshotSemantics: 'complete',
    authorityClass: 'curated',
    thresholds: {},
    adapter: 'fixture',
    runtimeClass: 'standard',
    enabled: true,
    shadow: false,
    writerAuthority: 'aws',
    health: 'healthy',
    ...overrides,
  };
}

function claim(id: string, predicate: KnowledgeClaim['predicate'], value: unknown, sourceId = 'test-source', observedAt = '2026-08-21T10:00:00.000Z'): KnowledgeClaim {
  return {
    id,
    observationId: 'obs-1',
    sourceId,
    subject: { type: 'event-candidate', key: candidateKey },
    predicate,
    value,
    confidence: 1,
    observedAt,
    status: 'active',
  };
}

function positiveClaims(): KnowledgeClaim[] {
  return [
    claim('c-artist-name', 'hasPerformerName', 'The Test Band'),
    claim('c-artist', 'hasPerformer', { name: 'The Test Band', sourceNativeId: 'artist-7', location: 'Stoke-on-Trent' }),
    claim('c-venue-name', 'hasVenueName', 'The Test Pub'),
    claim('c-venue', 'occursAt', { name: 'The Test Pub', sourceNativeId: 'venue-9', location: 'Stoke-on-Trent' }),
    claim('c-date', 'occursOn', '2026-08-30'),
    claim('c-time', 'startsAt', '20:00'),
    claim('c-status', 'hasStatus', 'confirmed'),
  ];
}

function item(action: ProjectionWorkItem['action'] = 'create'): ProjectionWorkItem {
  return {
    id: `p-${action}`,
    sourceId: 'test-source',
    observationId: 'obs-1',
    candidateKey,
    entityType: 'event',
    action,
    idempotencyKey: `test-source:obs-1:${candidateKey}:${action}`,
    claimIds: action === 'withdraw' ? ['c-withdraw'] : ['c-status'],
    runId: 'run-1',
    runItemCount: 1,
    runOrdinal: 1,
    createdAt: '2026-08-21T10:00:00.000Z',
  };
}

function api(overrides: Partial<ProjectionBndyApi> = {}): ProjectionBndyApi {
  const event = { id: 'event-1', artistId: 'artist-1', venueId: 'venue-1', date: '2026-08-30', isPublic: true, cancelled: false };
  return {
    resolveArtist: vi.fn(async () => ({ id: 'artist-1', created: true, name: 'The Test Band' })),
    resolveVenue: vi.fn(async () => ({ id: 'venue-1', created: true, name: 'The Test Pub' })),
    ensureEvent: vi.fn(async () => ({ id: 'event-1', created: true, duplicate: false })),
    getEvent: vi.fn(async () => ({ ...event })),
    findEventByExternalId: vi.fn(async () => null),
    updateEvent: vi.fn(async () => ({ ...event })),
    cancelEvent: vi.fn(async () => undefined),
    uncancelEvent: vi.fn(async () => undefined),
    hideEvent: vi.fn(async () => undefined),
    restoreEvent: vi.fn(async () => undefined),
    ...overrides,
  };
}

function deps(options: {
  source?: GigSource;
  claims?: KnowledgeClaim[];
  mapping?: { artistId?: string; venueId?: string; eventId?: string } | null;
  tombstone?: Tombstone | null;
  api?: ProjectionBndyApi;
  supportClaims?: KnowledgeClaim[];
  extraSources?: Record<string, GigSource>;
} = {}) {
  const claims = options.claims ?? positiveClaims();
  const supportClaims = options.supportClaims ?? [];
  const claimById = new Map([...claims, ...supportClaims].map((entry) => [entry.id, entry]));
  const linked: Array<{ type: string; id: string; claimId: string }> = [];
  const enrichments: unknown[] = [];
  const exceptions: unknown[] = [];
  const successes: unknown[] = [];
  const failures: string[] = [];
  const runItems: unknown[] = [];
  const lifecycle: unknown[] = [];
  const withdrawals: unknown[] = [];
  const tombstonePuts: Tombstone[] = [];
  const primary = options.source ?? source();

  const dependencies: ProjectionDependencies = {
    sources: {
      async get(sourceId) {
        if (sourceId === primary.id) return primary;
        return options.extraSources?.[sourceId] ?? null;
      },
    },
    claims: {
      async get(id) { return claimById.get(id) ?? null; },
      async listBySubject() { return claims; },
      async listSupportClaimIds() { return supportClaims.map((entry) => entry.id); },
      async linkCanonicalEntity(type, id, claimId) { linked.push({ type, id, claimId }); },
    },
    tombstones: {
      async get() { return options.tombstone ?? null; },
      async put(value) { tombstonePuts.push(value); },
      async updateLifecycle(...args) { lifecycle.push(args); },
    },
    state: {
      async getMapping(sourceId, currentCandidateKey) {
        return options.mapping ? { sourceId, candidateKey: currentCandidateKey, ...options.mapping } : null;
      },
      async isItemComplete() { return false; },
      async markSuccess(...args) { successes.push(args); },
      async recordFailure(_item, message) { failures.push(message); },
      async putWithdrawal(value) { withdrawals.push(value); },
      async recordRunItem(...args) { runItems.push(args); return {}; },
    },
    api: options.api ?? api(),
    authority: new AuthorityPolicy(),
    exceptions: { async raise(value) { exceptions.push(value); } },
    enrichment: { async publish(value) { enrichments.push(value); } },
    now: () => new Date('2026-08-21T12:00:00.000Z'),
  };

  return { dependencies, linked, enrichments, exceptions, successes, failures, runItems, lifecycle, withdrawals, tombstonePuts };
}

describe('AuthorityPolicy', () => {
  it('blocks a lower-authority destructive claim while fresh higher-authority support exists', () => {
    const policy = new AuthorityPolicy();
    const strong = claim('strong', 'hasStatus', 'confirmed', 'venue-source', '2026-08-20T10:00:00.000Z');
    const result = policy.evaluate({
      predicate: 'hasStatus',
      proposedAuthority: 'curated',
      existingSupportingClaims: [{ claim: strong, authorityClass: 'venue-owned' }],
      destructive: true,
      now: new Date('2026-08-21T12:00:00.000Z'),
    });
    expect(result.allowed).toBe(false);
    expect(result.strongestFreshSupport?.authorityClass).toBe('venue-owned');
  });

  it('blocks aggregator mutation of owner-managed events', () => {
    const result = new AuthorityPolicy().evaluate({
      predicate: 'hasStatus',
      proposedAuthority: 'aggregator',
      ownerManaged: true,
      mutation: true,
    });
    expect(result.allowed).toBe(false);
  });
});

describe('ProjectionEngine', () => {
  it('creates through canonical APIs, verifies read-back, links Claims and emits enrichment for new entities', async () => {
    const fx = deps();
    const result = await projectWorkItem(item('create'), fx.dependencies);

    expect(result.status).toBe('success');
    expect(result.eventId).toBe('event-1');
    expect(fx.linked.some((link) => link.type === 'event')).toBe(true);
    expect(fx.enrichments).toHaveLength(2);
    expect(fx.successes).toHaveLength(1);
    expect(fx.failures).toHaveLength(0);
  });

  it('does no BNDY API work in shadow mode', async () => {
    const mockApi = api();
    const fx = deps({ source: source({ shadow: true, writerAuthority: 'cowork' }), api: mockApi });
    const result = await projectWorkItem(item('create'), fx.dependencies);

    expect(result.status).toBe('shadow');
    expect(mockApi.resolveArtist).not.toHaveBeenCalled();
    expect(mockApi.ensureEvent).not.toHaveBeenCalled();
  });

  it('active tombstone blocks recreation from a curated source', async () => {
    const tombstone: Tombstone = {
      id: 't-1', eventFingerprint: 'artist-1|venue-1|2026-08-30', canonicalEventId: 'event-old',
      artistId: 'artist-1', venueId: 'venue-1', date: '2026-08-30', status: 'active', reason: 'cancelled',
      authorityClass: 'venue-owned', sourceId: 'venue-source', claimId: 'old-cancel', observationId: 'old-obs',
      createdAt: '2026-08-20T10:00:00.000Z',
    };
    const mockApi = api();
    const fx = deps({ tombstone, api: mockApi });
    const result = await projectWorkItem(item('create'), fx.dependencies);

    expect(result.status).toBe('exception');
    expect(mockApi.ensureEvent).not.toHaveBeenCalled();
    expect(fx.exceptions).toHaveLength(1);
  });

  it('venue-owned positive evidence can reinstate a tombstoned hidden/cancelled event', async () => {
    const tombstone: Tombstone = {
      id: 't-1', eventFingerprint: 'artist-1|venue-1|2026-08-30', canonicalEventId: 'event-1',
      artistId: 'artist-1', venueId: 'venue-1', date: '2026-08-30', status: 'active', reason: 'cancelled',
      authorityClass: 'curated', sourceId: 'old-source', claimId: 'old-cancel', observationId: 'old-obs',
      createdAt: '2026-08-20T10:00:00.000Z',
    };
    let reads = 0;
    const mockApi = api({
      resolveArtist: vi.fn(async () => ({ id: 'artist-1', created: false })),
      resolveVenue: vi.fn(async () => ({ id: 'venue-1', created: false })),
      ensureEvent: vi.fn(async () => ({ id: 'event-1', created: false, duplicate: true })),
      getEvent: vi.fn(async () => {
        reads++;
        return { id: 'event-1', artistId: 'artist-1', venueId: 'venue-1', date: '2026-08-30', cancelled: reads < 3, isPublic: reads < 3 ? false : true };
      }),
    });
    const fx = deps({ source: source({ authorityClass: 'venue-owned' }), tombstone, api: mockApi });
    const result = await projectWorkItem(item('create'), fx.dependencies);

    expect(result.status).toBe('success');
    expect(mockApi.uncancelEvent).toHaveBeenCalledWith('event-1');
    expect(mockApi.restoreEvent).toHaveBeenCalledWith('event-1');
    expect(fx.lifecycle).toHaveLength(1);
  });

  it('refuses a curated withdrawal when a fresh venue-owned claim supports the event', async () => {
    const withdrawalClaims = [...positiveClaims(), claim('c-withdraw', 'hasStatus', 'absent-from-complete-snapshot')];
    const strong = claim('strong-support', 'hasStatus', 'confirmed', 'venue-source', '2026-08-21T09:00:00.000Z');
    const mockApi = api();
    const fx = deps({
      claims: withdrawalClaims,
      mapping: { artistId: 'artist-1', venueId: 'venue-1', eventId: 'event-1' },
      api: mockApi,
      supportClaims: [strong],
      extraSources: { 'venue-source': source({ id: 'venue-source', authorityClass: 'venue-owned' }) },
    });
    const result = await projectWorkItem(item('withdraw'), fx.dependencies);

    expect(result.status).toBe('exception');
    expect(mockApi.hideEvent).not.toHaveBeenCalled();
  });

  it('explicit cancellation uses cancel, retains event and writes a tombstone', async () => {
    const cancelledClaims = [...positiveClaims().filter((entry) => entry.id !== 'c-status'), claim('c-status', 'hasStatus', 'cancelled')];
    let cancelled = false;
    const mockApi = api({
      getEvent: vi.fn(async () => ({ id: 'event-1', artistId: 'artist-1', venueId: 'venue-1', date: '2026-08-30', isPublic: true, cancelled })),
      cancelEvent: vi.fn(async () => { cancelled = true; }),
    });
    const fx = deps({ claims: cancelledClaims, mapping: { artistId: 'artist-1', venueId: 'venue-1', eventId: 'event-1' }, api: mockApi });
    const result = await projectWorkItem(item('cancel'), fx.dependencies);

    expect(result.status).toBe('success');
    expect(mockApi.cancelEvent).toHaveBeenCalled();
    expect(mockApi.hideEvent).not.toHaveBeenCalled();
    expect(fx.tombstonePuts).toHaveLength(1);
  });

  it('withdrawal hides instead of cancelling and persists ClaimWithdrawal', async () => {
    const withdrawalClaims = [...positiveClaims(), claim('c-withdraw', 'hasStatus', 'absent-from-complete-snapshot')];
    let hidden = false;
    const mockApi = api({
      getEvent: vi.fn(async () => ({ id: 'event-1', artistId: 'artist-1', venueId: 'venue-1', date: '2026-08-30', isPublic: !hidden, cancelled: false })),
      hideEvent: vi.fn(async () => { hidden = true; }),
    });
    const fx = deps({ claims: withdrawalClaims, mapping: { artistId: 'artist-1', venueId: 'venue-1', eventId: 'event-1' }, api: mockApi });
    const result = await projectWorkItem(item('withdraw'), fx.dependencies);

    expect(result.status).toBe('success');
    expect(mockApi.hideEvent).toHaveBeenCalled();
    expect(mockApi.cancelEvent).not.toHaveBeenCalled();
    expect(fx.withdrawals).toHaveLength(1);
  });

  it('verification failure fails only this work item for SQS retry', async () => {
    const mockApi = api({
      getEvent: vi.fn(async () => ({ id: 'event-1', artistId: 'artist-1', venueId: 'venue-1', date: '2099-01-01' })),
    });
    const fx = deps({ api: mockApi });

    await expect(projectWorkItem(item('create'), fx.dependencies)).rejects.toThrow(/verification failed/i);
    expect(fx.failures).toHaveLength(1);
  });

  it('blocks non-create work before any BNDY API call for an additive-only source', async () => {
    const mockApi = api();
    const fx = deps({
      source: source({ projectionPolicy: { mode: 'additive-only' } }),
      api: mockApi,
    });
    const result = await projectWorkItem(item('update'), fx.dependencies);

    expect(result.status).toBe('exception');
    expect(result.message).toContain('Additive-only projection blocks update');
    expect(mockApi.resolveArtist).not.toHaveBeenCalled();
    expect(mockApi.ensureEvent).not.toHaveBeenCalled();
    expect(mockApi.updateEvent).not.toHaveBeenCalled();
  });

  it('fails closed if live KLMA projection has no explicit policy', async () => {
    const mockApi = api();
    const fx = deps({
      source: source({ id: 'klma-stoke-gig-list' }),
      api: mockApi,
    });
    const klmaItem = { ...item('create'), sourceId: 'klma-stoke-gig-list' };
    const result = await projectWorkItem(klmaItem, fx.dependencies);

    expect(result.status).toBe('exception');
    expect(result.message).toContain('requires an explicit source projection policy');
    expect(mockApi.resolveArtist).not.toHaveBeenCalled();
    expect(mockApi.ensureEvent).not.toHaveBeenCalled();
  });

  it('matches and verifies an existing Event without mutating it in additive-only mode', async () => {
    const mockApi = api({
      resolveArtist: vi.fn(async () => ({ id: 'artist-1', created: false })),
      resolveVenue: vi.fn(async () => ({ id: 'venue-1', created: false })),
      ensureEvent: vi.fn(async () => ({ id: 'event-1', created: false, duplicate: true })),
    });
    const fx = deps({
      source: source({ projectionPolicy: { mode: 'additive-only' } }),
      api: mockApi,
    });
    const result = await projectWorkItem(item('create'), fx.dependencies);

    expect(result.status).toBe('success');
    expect(result.eventId).toBe('event-1');
    expect(mockApi.updateEvent).not.toHaveBeenCalled();
    expect(mockApi.cancelEvent).not.toHaveBeenCalled();
    expect(mockApi.hideEvent).not.toHaveBeenCalled();
    expect(mockApi.restoreEvent).not.toHaveBeenCalled();
    expect(mockApi.uncancelEvent).not.toHaveBeenCalled();
  });

  it('will not reinstate a tombstoned Event in additive-only mode', async () => {
    const tombstone: Tombstone = {
      id: 't-1', eventFingerprint: 'artist-1|venue-1|2026-08-30', canonicalEventId: 'event-1',
      artistId: 'artist-1', venueId: 'venue-1', date: '2026-08-30', status: 'active', reason: 'cancelled',
      authorityClass: 'curated', sourceId: 'old-source', claimId: 'old-cancel', observationId: 'old-obs',
      createdAt: '2026-08-20T10:00:00.000Z',
    };
    const mockApi = api({
      resolveArtist: vi.fn(async () => ({ id: 'artist-1', created: false })),
      resolveVenue: vi.fn(async () => ({ id: 'venue-1', created: false })),
    });
    const fx = deps({
      source: source({ projectionPolicy: { mode: 'additive-only' } }),
      tombstone,
      api: mockApi,
    });
    const result = await projectWorkItem(item('create'), fx.dependencies);

    expect(result.status).toBe('exception');
    expect(mockApi.ensureEvent).not.toHaveBeenCalled();
    expect(mockApi.restoreEvent).not.toHaveBeenCalled();
    expect(mockApi.uncancelEvent).not.toHaveBeenCalled();
  });
});
