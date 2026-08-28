import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichTrustLoopEntityWithGemini } from '../src/google/gemini.js';
import {
  qualificationEntity,
  qualificationPredicates,
  selectEnrichmentQualificationCases,
} from '../src/enrichment/qualification-cohort.js';
import type { TrustLoopReviewCase } from '../src/trust-loop/types.js';

function reviewCase(
  candidateType: 'artist' | 'venue',
  sourceId: string,
  candidateKey: string,
  displayName: string,
): TrustLoopReviewCase {
  return {
    candidateType,
    sourceId,
    candidateKey,
    displayName,
    status: 'unresolved',
    canonicalHypotheses: [],
    supportingClaimIds: ['claim-1'],
    decisionReasoning: ['Needs grounded evidence'],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('Trust Loop enrichment qualification capture', () => {
  it('selects a balanced, source-diverse artist and venue cohort', () => {
    const selected = selectEnrichmentQualificationCases([
      reviewCase('artist', 'lemonrock', 'artist-1', 'Manic'),
      reviewCase('artist', 'lemonrock', 'artist-2', 'A Long Distinctive Artist Name'),
      reviewCase('artist', 'onthecase', 'artist-3', 'The Reform'),
      reviewCase('venue', 'klma', 'venue-1', 'The Social Club'),
      reviewCase('venue', 'klma', 'venue-2', 'Distinctive Music Hall Stoke'),
      reviewCase('venue', 'gigsnews', 'venue-3', 'The Exchange'),
    ], 2);
    expect(selected).toHaveLength(4);
    expect(selected.filter((item) => item.candidateType === 'artist').map((item) => item.sourceId).sort())
      .toEqual(['lemonrock', 'onthecase']);
    expect(selected.filter((item) => item.candidateType === 'venue').map((item) => item.sourceId).sort())
      .toEqual(['gigsnews', 'klma']);
  });

  it('captures only requested, grounded evidence with measured usage and zero writes', async () => {
    const evidenceUrl = 'https://the-test-band.example/about';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: JSON.stringify({
        identityConfidence: 0.999,
        identityReason: 'The official site lists the same named act and live footprint.',
        facts: [{
          predicate: 'hasGenre',
          value: 'Rock',
          confidence: 0.99,
          evidenceUrls: [evidenceUrl],
          evidenceText: 'Official artist description.',
        }],
      }),
      steps: [
        { type: 'google_search_call', arguments: { queries: ['The Test Band official'] } },
        { type: 'google_search_result', url: evidenceUrl, title: 'The Test Band' },
      ],
      usage: { total_input_tokens: 1_000, total_output_tokens: 200 },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const item = reviewCase('artist', 'fixture-source', 'artist-1', 'The Test Band');
    const entity = qualificationEntity(item);
    const bundle = await enrichTrustLoopEntityWithGemini({
      entity,
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      requestedPredicates: qualificationPredicates('artist'),
    }, { apiKey: 'fixture-key' });
    expect(bundle).toMatchObject({
      providerId: 'gemini-grounded-v1',
      identityConfidence: 0.999,
      facts: [{ predicate: 'hasGenre', value: 'Rock', evidenceUrls: [evidenceUrl] }],
      usage: { searches: 1, fetches: 0, modelCalls: 1, inputTokens: 1_000, outputTokens: 200 },
    });
    expect(bundle.usage!.estimatedCost).toBeLessThan(0.03);
  });

  it('rejects model citations that were not captured by the grounded search', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: JSON.stringify({
        identityConfidence: 0.999,
        identityReason: 'Claimed official result.',
        facts: [{
          predicate: 'hasWebsiteUrl',
          value: 'https://invented.example',
          confidence: 0.999,
          evidenceUrls: ['https://invented.example'],
        }],
      }),
      steps: [{ type: 'google_search_call', arguments: { queries: ['test'] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const item = reviewCase('venue', 'fixture-source', 'venue-1', 'The Test Hall');
    await expect(enrichTrustLoopEntityWithGemini({
      entity: qualificationEntity(item),
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      requestedPredicates: qualificationPredicates('venue'),
    }, { apiKey: 'fixture-key' })).rejects.toThrow(/uncaptured citation/i);
  });
});
