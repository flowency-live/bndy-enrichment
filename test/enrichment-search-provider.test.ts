import { describe, expect, it } from 'vitest';
import type { DiscoveryBudget } from '../src/knowledge/types.js';
import {
  SearchModelEnrichmentProvider,
  buildEnrichmentQueries,
  type EnrichmentReasoner,
  type EnrichmentSearchClient,
} from '../src/enrichment/providers/search-model.js';
import { SAFE_ENRICHMENT_BUDGET } from '../src/enrichment/safety.js';

const entity = {
  entityType: 'artist' as const,
  entityId: 'artist-1',
  displayName: 'The Example Band',
  currentValues: { hasLocation: 'Newcastle upon Tyne' },
  ownerManagedPredicates: [],
  attachedToUpcomingGig: true,
};

function fixture(options: { citation?: string; predicate?: 'hasWebsiteUrl' | 'hasBio'; identityConfidence?: number } = {}) {
  const searched: string[] = [];
  const searchClient: EnrichmentSearchClient = {
    id: 'fixture-search',
    async search(query) {
      searched.push(query);
      return {
        results: [{ title: 'Official site', url: 'https://example-band.test/', snippet: 'Newcastle live band' }],
        usage: { estimatedCost: 0.002, durationMs: 20 },
      };
    },
  };
  const reasoner: EnrichmentReasoner = {
    id: 'fixture-reasoner',
    async analyse(input) {
      return {
        providerRunId: 'reasoner-run-1',
        retrievedAt: '2026-08-27T13:00:00.000Z',
        identityConfidence: options.identityConfidence ?? 0.999,
        facts: [{
          predicate: options.predicate ?? 'hasWebsiteUrl',
          value: options.predicate === 'hasBio' ? 'A bio' : 'https://example-band.test/',
          confidence: 0.999,
          evidenceUrls: [options.citation ?? input.searches[0]!.results[0]!.url],
        }],
        usage: { inputTokens: 1_000, outputTokens: 150, estimatedCost: 0.003, durationMs: 50 },
        raw: { fixture: true },
      };
    },
  };
  return {
    searched,
    provider: new SearchModelEnrichmentProvider(searchClient, reasoner, { id: 'search-model-fixture' }),
  };
}

describe('search model entity enrichment provider', () => {
  it('builds bounded identity-and-location queries and returns cited evidence with usage', async () => {
    expect(buildEnrichmentQueries(entity)).toEqual([
      '"The Example Band" "Newcastle upon Tyne" music artist band official',
      '"The Example Band" "Newcastle upon Tyne" music site:facebook.com OR site:instagram.com',
    ]);
    const fx = fixture();
    const result = await fx.provider.gather(entity, SAFE_ENRICHMENT_BUDGET, ['hasWebsiteUrl']);
    expect(fx.searched).toHaveLength(2);
    expect(result).toMatchObject({
      providerId: 'search-model-fixture',
      identityConfidence: 0.999,
      usage: { searches: 2, fetches: 0, modelCalls: 1, inputTokens: 1_000, outputTokens: 150, estimatedCost: 0.007 },
    });
    expect(result.facts).toEqual([expect.objectContaining({ predicate: 'hasWebsiteUrl' })]);
  });

  it('preserves a safe low-confidence abstention for the qualification gate', async () => {
    const fx = fixture({ identityConfidence: 0.7 });
    const result = await fx.provider.gather(entity, SAFE_ENRICHMENT_BUDGET, ['hasWebsiteUrl']);
    expect(result.identityConfidence).toBe(0.7);
  });

  it('rejects facts whose citation was not captured by the search client', async () => {
    const fx = fixture({ citation: 'https://uncaptured.test/profile' });
    await expect(fx.provider.gather(entity, SAFE_ENRICHMENT_BUDGET, ['hasWebsiteUrl']))
      .rejects.toThrow(/uncaptured citation/);
  });

  it('rejects unrequested facts instead of silently broadening enrichment scope', async () => {
    const fx = fixture({ predicate: 'hasBio' });
    await expect(fx.provider.gather(entity, SAFE_ENRICHMENT_BUDGET, ['hasWebsiteUrl']))
      .rejects.toThrow(/unrequested predicate/);
  });

  it('refuses to start when the reserved budget cannot cover one search and one model call', async () => {
    const fx = fixture();
    const budget: DiscoveryBudget = { ...SAFE_ENRICHMENT_BUDGET, maxModelCalls: 0 };
    await expect(fx.provider.gather(entity, budget, ['hasWebsiteUrl']))
      .rejects.toThrow(/does not permit search and reasoning/);
    expect(fx.searched).toHaveLength(0);
  });
});
