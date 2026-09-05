import { describe, expect, it } from 'vitest';
import type { GigSource } from '../src/knowledge/types.js';
import { reconcileSourceDefinition } from '../src/sources/registry-reconcile.js';

function definition(overrides: Partial<GigSource> = {}): GigSource {
  return {
    id: 'onthecase-gig-index', name: 'On The Case', type: 'CURATED_SOURCE', url: 'https://onthecasemusic.co.uk/gigs',
    timezone: 'Europe/London', cadence: 'manual', localTime: '02:40', mode: 'delta', snapshotSemantics: 'complete',
    authorityClass: 'curated', thresholds: {}, adapter: 'onthecase', runtimeClass: 'standard',
    enabled: true, shadow: true, writerAuthority: 'cowork', health: 'unknown',
    projectionPolicy: { mode: 'additive-only', allowedActions: ['create'], allowedPredicates: ['occursOn'], entityCreation: 'match-only' },
    ...overrides,
  };
}

describe('reconcileSourceDefinition', () => {
  it('keeps a live source live: the registry write authority survives a re-seed', () => {
    const existing = definition({ shadow: false, writerAuthority: 'aws' });
    const result = reconcileSourceDefinition(existing, definition());
    expect(result.shadow).toBe(false);
    expect(result.writerAuthority).toBe('aws');
  });

  it('keeps an active pilot allowlist through a re-seed', () => {
    const existing = definition({ shadow: false, writerAuthority: 'aws', projectionPolicy: { ...definition().projectionPolicy!, pilotCandidateKeys: ['event:onthecase-gig-index:onthecase:gig:1'] } });
    const result = reconcileSourceDefinition(existing, definition());
    expect(result.projectionPolicy?.pilotCandidateKeys).toEqual(['event:onthecase-gig-index:onthecase:gig:1']);
    expect(result.projectionPolicy?.allowedPredicates).toEqual(['occursOn']);
  });

  it('never promotes a shadow source to live and applies the code contract otherwise', () => {
    const existing = definition({ cadence: 'weekly' });
    const result = reconcileSourceDefinition(existing, definition({ cadence: 'daily' }));
    expect(result.shadow).toBe(true);
    expect(result.writerAuthority).toBe('cowork');
    expect(result.cadence).toBe('daily');
  });

  it('returns the code definition when nothing exists yet', () => {
    expect(reconcileSourceDefinition(null, definition())).toEqual(definition());
  });
});
