import { describe, expect, it } from 'vitest';
import { planDailyEntityEnrichment } from '../src/enrichment/planner.js';
import type { EntityEnrichmentCandidate } from '../src/enrichment/types.js';

function candidate(overrides: Partial<EntityEnrichmentCandidate> = {}): EntityEnrichmentCandidate {
  return {
    entityType: 'artist',
    entityId: 'artist-1',
    displayName: 'Example Artist',
    identityState: 'resolved',
    missingPredicates: ['hasWebsiteUrl'],
    ownerManagedPredicates: [],
    attachedToUpcomingGig: false,
    upcomingGigCount: 0,
    sourceCount: 1,
    activeConflictCount: 0,
    ...overrides,
  };
}

const runAt = new Date('2026-08-27T12:00:00.000Z');

describe('daily entity enrichment planner', () => {
  it('prioritises resolved entities attached to upcoming gigs', () => {
    const plan = planDailyEntityEnrichment([
      candidate({ entityId: 'dormant', displayName: 'Dormant' }),
      candidate({ entityId: 'gigged', displayName: 'Gigged', attachedToUpcomingGig: true, upcomingGigCount: 2 }),
    ], { runAt, maxArtists: 1 });
    expect(plan.selected).toHaveLength(1);
    expect(plan.selected[0].candidate.entityId).toBe('gigged');
    expect(plan.skipped.overDailyLimit).toBe(1);
  });

  it('parks unresolved identities but retains owner-managed gaps as reviewable evidence work', () => {
    const plan = planDailyEntityEnrichment([
      candidate({ entityId: 'unresolved', identityState: 'unresolved' }),
      candidate({
        entityId: 'protected',
        missingPredicates: ['hasBio'],
        ownerManagedPredicates: ['hasBio'],
      }),
    ], { runAt });
    expect(plan.selected).toHaveLength(1);
    expect(plan.selected[0]).toMatchObject({
      actionablePredicates: ['hasBio'],
      candidate: { entityId: 'protected' },
    });
    expect(plan.skipped).toMatchObject({ unresolved: 1, noActionableGaps: 0 });
  });

  it('does not repeatedly spend on recently attempted entities', () => {
    const plan = planDailyEntityEnrichment([
      candidate({ lastAttemptAt: '2026-08-20T12:00:00.000Z' }),
    ], { runAt, cooldownDays: 30 });
    expect(plan.selected).toEqual([]);
    expect(plan.skipped.coolingDown).toBe(1);
  });

  it('applies separate Artist and Venue daily limits', () => {
    const plan = planDailyEntityEnrichment([
      candidate({ entityId: 'artist-1' }),
      candidate({ entityId: 'artist-2' }),
      candidate({ entityType: 'venue', entityId: 'venue-1', displayName: 'Venue 1' }),
      candidate({ entityType: 'venue', entityId: 'venue-2', displayName: 'Venue 2' }),
    ], { runAt, maxArtists: 1, maxVenues: 1 });
    expect(plan.selected.map((item) => item.candidate.entityType).sort()).toEqual(['artist', 'venue']);
    expect(plan.skipped.overDailyLimit).toBe(2);
  });

  it('creates deterministic daily work with the hard evidence-only budget', () => {
    const first = planDailyEntityEnrichment([candidate()], { runAt }).selected[0].item;
    const repeated = planDailyEntityEnrichment([candidate()], { runAt }).selected[0].item;
    const nextDay = planDailyEntityEnrichment([candidate()], {
      runAt: new Date('2026-08-28T12:00:00.000Z'),
    }).selected[0].item;
    expect(repeated.id).toBe(first.id);
    expect(nextDay.id).not.toBe(first.id);
    expect(first.budget).toMatchObject({
      maxEntities: 1,
      maxSearches: 3,
      maxFetches: 6,
      maxModelCalls: 1,
      maxEstimatedCost: 0.03,
      allowExpensiveModel: false,
    });
    expect(first.requestedPredicates).toEqual(['hasWebsiteUrl']);
  });
});
