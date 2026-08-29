import { describe, expect, it, vi } from 'vitest';
import {
  GeminiStructuredEnrichmentReasoner,
  buildGeminiStructuredEnrichmentPrompt,
} from '../src/enrichment/providers/gemini-structured-reasoner.js';
import { GoogleProgrammableSearchClient } from '../src/enrichment/providers/google-programmable-search.js';
import {
  EnrichmentReasonerCaptureError,
  SearchModelEnrichmentCaptureError,
  SearchModelEnrichmentProvider,
  type EnrichmentReasoner,
  type EnrichmentSearchClient,
} from '../src/enrichment/providers/search-model.js';
import { SAFE_ENRICHMENT_BUDGET } from '../src/enrichment/safety.js';

const entity = {
  entityType: 'artist' as const,
  entityId: 'artist-1',
  displayName: 'The Example Band',
  currentValues: { hasLocation: 'Norwich' },
  ownerManagedPredicates: [],
  attachedToUpcomingGig: true,
};

const reasonerInput: Parameters<EnrichmentReasoner['analyse']>[0] = {
  entity,
  requestedPredicates: ['hasFacebookUrl', 'hasGenre'],
  searches: [{
    query: 'example query',
    results: [{
      title: 'Official profile',
      url: 'https://example.test/profile',
      snippet: 'Norwich artist official profile',
    }],
  }],
  budget: {
    maxInputTokens: 12_000,
    maxOutputTokens: 2_000,
    maxEstimatedCost: 0.02,
    deadlineMs: 60_000,
  },
};

describe('Google Programmable Search enrichment client', () => {
  it('captures one bounded public result set with deterministic usage', async () => {
    let requestedUrl: URL | undefined;
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      requestedUrl = new URL(input.toString());
      return new Response(JSON.stringify({
        items: [{
          title: '  Official   profile  ',
          link: 'https://example.test/profile',
          snippet: '  Norwich   live band  ',
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const client = new GoogleProgrammableSearchClient({
      apiKey: 'search-secret',
      engineId: 'engine-1',
      estimatedCostPerSearch: 0.005,
      fetchImpl,
    });

    const result = await client.search('The Example Band Norwich', { maxResults: 50, deadlineMs: 5_000 });

    expect(requestedUrl).toBeDefined();
    const url = requestedUrl!;
    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/customsearch/v1');
    expect(url.searchParams.get('q')).toBe('The Example Band Norwich');
    expect(url.searchParams.get('num')).toBe('10');
    expect(url.searchParams.get('safe')).toBe('active');
    expect(result).toEqual({
      results: [{
        title: 'Official profile',
        url: 'https://example.test/profile',
        snippet: 'Norwich live band',
      }],
      usage: { estimatedCost: 0.005, durationMs: expect.any(Number) },
    });
  });
});

describe('Gemini structured enrichment reasoner', () => {
  it('uses one stateless schema-constrained call over the exact evidence allow-list', async () => {
    let requestBody: any;
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        id: 'interaction-1',
        output_text: JSON.stringify({
          identityConfidence: 0.999,
          identityReason: 'The Norwich gig footprint and official profile agree.',
          facts: [{
            predicate: 'hasFacebookUrl',
            value: 'https://example.test/profile',
            confidence: 0.999,
            evidenceUrls: ['https://example.test/profile'],
          }],
        }),
        usage: { total_input_tokens: 1_000, total_output_tokens: 100 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const reasoner = new GeminiStructuredEnrichmentReasoner({ apiKey: 'gemini-secret', fetchImpl });

    const result = await reasoner.analyse(reasonerInput);

    expect(requestBody.tools).toBeUndefined();
    expect(requestBody.store).toBe(false);
    expect(requestBody.generation_config).toMatchObject({
      temperature: 0,
      thinking_level: 'low',
      max_output_tokens: 2_000,
    });
    expect(requestBody.response_format.schema.properties.facts.items.properties.predicate.enum)
      .toEqual(['hasFacebookUrl', 'hasGenre']);
    expect(requestBody.input).toContain('https://example.test/profile');
    expect(result).toMatchObject({
      providerRunId: 'interaction-1',
      identityConfidence: 0.999,
      usage: { inputTokens: 1_000, outputTokens: 100 },
    });
    expect(result.usage.estimatedCost).toBeCloseTo(0.001125, 8);
  });

  it('preserves measured usage and response text when the schema fails', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      id: 'interaction-error',
      output_text: JSON.stringify({ facts: 'not-an-array' }),
      usage: { total_input_tokens: 500, total_output_tokens: 50 },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
    const reasoner = new GeminiStructuredEnrichmentReasoner({ apiKey: 'gemini-secret', fetchImpl });

    const error = await reasoner.analyse(reasonerInput).catch((value) => value);

    expect(error).toBeInstanceOf(EnrichmentReasonerCaptureError);
    expect(error.result).toMatchObject({
      providerRunId: 'interaction-error',
      identityConfidence: 0,
      facts: [],
      usage: { inputTokens: 500, outputTokens: 50 },
      raw: { responseText: '{"facts":"not-an-array"}' },
    });
  });

  it('fails before a provider call when the maximum token spend cannot fit the budget', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const reasoner = new GeminiStructuredEnrichmentReasoner({ apiKey: 'gemini-secret', fetchImpl });

    await expect(reasoner.analyse({
      ...reasonerInput,
      budget: { ...reasonerInput.budget, maxEstimatedCost: 0.000001 },
    })).rejects.toThrow(/remaining cost budget/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('builds a prompt that explicitly forbids browsing and uncaptured URLs', () => {
    const prompt = buildGeminiStructuredEnrichmentPrompt(reasonerInput);
    expect(prompt).toContain('Do not browse, call tools, use remembered facts or invent a URL');
    expect(prompt).toContain('Every evidenceUrls value must exactly match');
  });
});

describe('split provider failure evidence', () => {
  it('preserves search and model usage when structured reasoning fails', async () => {
    const searchClient: EnrichmentSearchClient = {
      id: 'fixture-search',
      async search() {
        return {
          results: [{ title: 'Official profile', url: 'https://example.test/profile' }],
          usage: { estimatedCost: 0.005, durationMs: 10 },
        };
      },
    };
    const reasoner: EnrichmentReasoner = {
      id: 'fixture-reasoner',
      async analyse() {
        throw new EnrichmentReasonerCaptureError('schema failure', {
          providerRunId: 'run-error',
          retrievedAt: '2026-08-29T10:00:00.000Z',
          identityConfidence: 0,
          facts: [],
          usage: { inputTokens: 100, outputTokens: 10, estimatedCost: 0.001, durationMs: 20 },
          raw: { responseText: '{}' },
        });
      },
    };
    const provider = new SearchModelEnrichmentProvider(searchClient, reasoner, { id: 'split-fixture' });

    const error = await provider.gather(entity, SAFE_ENRICHMENT_BUDGET, ['hasFacebookUrl'])
      .catch((value) => value);

    expect(error).toBeInstanceOf(SearchModelEnrichmentCaptureError);
    expect(error.bundle).toMatchObject({
      providerId: 'split-fixture',
      facts: [],
      usage: { searches: 2, modelCalls: 1, estimatedCost: 0.011 },
      raw: {
        searchClientId: 'fixture-search',
        reasonerId: 'fixture-reasoner',
        reasoner: { responseText: '{}' },
      },
    });
  });
});
