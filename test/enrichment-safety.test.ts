import { describe, expect, it } from 'vitest';
import type { EntityEnrichmentWorkItem } from '../src/knowledge/types.js';
import { processEntityEnrichment, type EntityEnrichmentDependencies } from '../src/enrichment/processor.js';
import { capEnrichmentBudget, SAFE_ENRICHMENT_BUDGET } from '../src/enrichment/safety.js';
import type { EnrichmentOutcome } from '../src/enrichment/types.js';

const item: EntityEnrichmentWorkItem = {
  id: 'enrich-1', entityType: 'artist', entityId: 'artist-1', reason: 'manual',
  createdAt: '2026-08-27T10:00:00.000Z',
};

function fixture(options: { identityConfidence?: number; begin?: 'started' | 'resume' | 'complete' | 'budget-exhausted' } = {}) {
  const observations: any[] = [];
  const claims: any[] = [];
  const outcomes: EnrichmentOutcome[] = [];
  let gathered = 0;
  const deps: EntityEnrichmentDependencies = {
    entities: { async get() { return {
      entityType: 'artist', entityId: 'artist-1', displayName: 'The Test Band',
      currentValues: { hasLocation: 'Manchester' }, ownerManagedPredicates: ['hasBio'],
      attachedToUpcomingGig: true,
    }; } },
    provider: { id: 'fixture-provider', async gather() {
      gathered += 1;
      return {
        providerId: 'fixture-provider', providerRunId: 'provider-run-1', retrievedAt: '2026-08-27T10:01:00.000Z',
        identityConfidence: options.identityConfidence ?? 0.999,
        facts: [
          { predicate: 'hasWebsiteUrl', value: 'https://testband.example', confidence: 0.999, evidenceUrls: ['https://testband.example/about'] },
          { predicate: 'hasLocation', value: 'Liverpool', confidence: 0.99, evidenceUrls: ['https://one.example/band'] },
          { predicate: 'hasBio', value: 'Owner supplied bio should remain protected.', confidence: 0.999, evidenceUrls: ['https://testband.example/about'] },
          { predicate: 'hasGenre', value: 'Rock', confidence: 0.7, evidenceUrls: ['https://testband.example/about'] },
          { predicate: 'hasInstagramUrl', value: 'http://localhost/wrong', confidence: 0.999, evidenceUrls: ['https://localhost/citation'] },
        ],
        raw: { fixture: true },
      };
    } },
    controls: {
      async begin() { return options.begin ?? 'started'; },
      async record(outcome) { outcomes.push(outcome); },
    },
    observations: { async put(observation) { const stored = { ...observation, evidenceKey: 'evidence/enrichment.json' }; observations.push(stored); return stored; } },
    claims: {
      async put(claim) { claims.push(claim); },
      async linkCanonicalEntity() {},
    },
  };
  return { deps, observations, claims, outcomes, gathered: () => gathered };
}

describe('safe entity enrichment processor', () => {
  it('caps every per-entity budget and always disables expensive models', () => {
    expect(capEnrichmentBudget({
      maxDepth: 5, maxEntities: 10, maxSearches: 99, maxFetches: 99, maxModelCalls: 5,
      maxInputTokens: 999_999, maxOutputTokens: 99_999, maxEstimatedCost: 5,
      allowExpensiveModel: true, deadlineMs: 999_999,
    })).toEqual(SAFE_ENRICHMENT_BUDGET);
  });

  it('writes immutable evidence and Claims but performs zero canonical writes', async () => {
    const fx = fixture();
    const result = await processEntityEnrichment(item, fx.deps);
    expect(result).toMatchObject({
      status: 'completed', claimsWritten: 3, protectedFacts: 1,
      conflictingFacts: 1, factsNeedingReview: 2, canonicalWrites: 0,
    });
    expect(fx.observations).toHaveLength(1);
    expect(fx.observations[0]).toMatchObject({ complete: false, evidenceKey: 'evidence/enrichment.json' });
    expect(fx.claims.map((claim) => claim.predicate)).toEqual(['hasWebsiteUrl', 'hasLocation', 'hasBio']);
    expect(fx.outcomes.at(-1)?.canonicalWrites).toBe(0);
  });

  it('parks low-confidence identity evidence without attaching Claims', async () => {
    const fx = fixture({ identityConfidence: 0.9 });
    const result = await processEntityEnrichment(item, fx.deps);
    expect(result).toMatchObject({ status: 'parked', claimsWritten: 0, reason: 'identity-confidence-below-0.98' });
    expect(fx.observations).toHaveLength(1);
    expect(fx.claims).toHaveLength(0);
  });

  it('does not call a provider when the daily budget is exhausted', async () => {
    const fx = fixture({ begin: 'budget-exhausted' });
    const result = await processEntityEnrichment(item, fx.deps);
    expect(result).toMatchObject({ status: 'budget-exhausted', canonicalWrites: 0 });
    expect(fx.gathered()).toBe(0);
    expect(fx.observations).toHaveLength(0);
  });

  it('is idempotent when the work item is already complete', async () => {
    const fx = fixture({ begin: 'complete' });
    const result = await processEntityEnrichment(item, fx.deps);
    expect(result).toEqual({
      itemId: 'enrich-1', status: 'idempotent', claimsWritten: 0,
      protectedFacts: 0, conflictingFacts: 0, factsNeedingReview: 0, canonicalWrites: 0,
    });
    expect(fx.gathered()).toBe(0);
  });
});
