import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enrichTrustLoopEntityWithGemini,
  GroundedEnrichmentCaptureError,
} from '../src/google/gemini.js';
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
        {
          type: 'model_output',
          content: [{
            type: 'text',
            text: 'The official site describes the act as a rock band.',
            annotations: [{ type: 'url_citation', url: evidenceUrl, title: 'The Test Band' }],
          }],
        },
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
    const request = JSON.parse((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string);
    expect(request.store).toBe(false);
    expect(request.tools).toEqual([{ type: 'google_search' }]);
    expect(request.response_format).toMatchObject({
      type: 'text',
      mime_type: 'application/json',
      schema: {
        required: ['identityConfidence', 'identityReason', 'facts'],
        properties: {
          facts: {
            items: {
              properties: {
                predicate: { enum: qualificationPredicates('artist') },
              },
            },
          },
        },
      },
    });
    expect(request.input).toMatch(/at most two Google Search queries/i);
    expect(bundle.raw).toMatchObject({
      citationCount: 1,
      citedUrls: [evidenceUrl],
      providerResponse: expect.objectContaining({ output_text: expect.any(String) }),
    });
  });

  it('captures inline citation annotations from schema-constrained grounded JSON', async () => {
    const evidenceUrl = 'https://the-test-band.example/about';
    const modelText = `\`\`\`json\n${JSON.stringify({
      identityConfidence: 0.999,
      identityReason: 'The official page matches the named act and gig footprint.',
      facts: [{
        predicate: 'hasGenre',
        value: 'Rock',
        confidence: 0.99,
        evidenceUrls: [evidenceUrl],
        evidenceText: 'The official page describes the act as a rock band.',
      }],
    })}\n\`\`\``;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: modelText,
      steps: [
        { type: 'google_search_call', arguments: { queries: ['', 'The Test Band official'] } },
        {
          type: 'model_output',
          content: [{
            type: 'text',
            text: modelText,
            annotations: [{
              type: 'url_citation',
              url: evidenceUrl,
              title: 'Official page',
              startIndex: 0,
              endIndex: 20,
            }],
          }],
        },
      ],
      usage: { total_input_tokens: 500, total_output_tokens: 100 },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    const item = reviewCase('artist', 'fixture-source', 'artist-1', 'The Test Band');
    const bundle = await enrichTrustLoopEntityWithGemini({
      entity: qualificationEntity(item),
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      requestedPredicates: qualificationPredicates('artist'),
    }, { apiKey: 'fixture-key' });

    expect(bundle.facts).toEqual([expect.objectContaining({
      predicate: 'hasGenre',
      value: 'Rock',
      evidenceUrls: [evidenceUrl],
    })]);
    expect(bundle.usage).toMatchObject({ searches: 1, modelCalls: 1 });
    expect(bundle.raw).toMatchObject({
      evidence: [expect.objectContaining({
        sourceUrl: evidenceUrl,
        title: 'Official page',
        snippet: modelText.slice(0, 20),
      })],
      rejectedFacts: [],
    });
  });

  it('retains provider evidence, usage and measured cost when grounded output fails the schema', async () => {
    const evidenceUrl = 'https://the-test-band.example/about';
    const responseText = JSON.stringify({
      identityConfidence: 0.999,
      facts: { hasGenre: 'Rock' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: responseText,
      steps: [
        { type: 'google_search_call', arguments: { queries: ['The Test Band official'] } },
        {
          type: 'model_output',
          content: [{
            type: 'text',
            text: responseText,
            annotations: [{ type: 'url_citation', url: evidenceUrl, title: 'Official page' }],
          }],
        },
      ],
      usage: { total_input_tokens: 700, total_output_tokens: 150 },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    const item = reviewCase('artist', 'fixture-source', 'artist-1', 'The Test Band');
    const failure = await enrichTrustLoopEntityWithGemini({
      entity: qualificationEntity(item),
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      requestedPredicates: qualificationPredicates('artist'),
    }, { apiKey: 'fixture-key' }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(GroundedEnrichmentCaptureError);
    expect((failure as GroundedEnrichmentCaptureError).bundle).toMatchObject({
      providerId: 'gemini-grounded-v1',
      identityConfidence: 0,
      facts: [],
      usage: {
        searches: 1,
        modelCalls: 1,
        inputTokens: 700,
        outputTokens: 150,
      },
      raw: {
        responseText,
        evidence: [expect.objectContaining({ sourceUrl: evidenceUrl })],
        captureError: expect.stringMatching(/failed the Backline schema/i),
      },
    });
    expect((failure as GroundedEnrichmentCaptureError).bundle.usage!.estimatedCost).toBeGreaterThan(0.014);
  });

  it('quarantines a search-result URL that lacks a provider citation annotation', async () => {
    const evidenceUrl = 'https://invented.example';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output_text: JSON.stringify({
        identityConfidence: 0.999,
        identityReason: 'Claimed official result.',
        facts: [{
          predicate: 'hasWebsiteUrl',
          value: evidenceUrl,
          confidence: 0.999,
          evidenceUrls: [evidenceUrl],
        }],
      }),
      steps: [
        { type: 'google_search_call', arguments: { queries: ['test'] } },
        { type: 'google_search_result', url: evidenceUrl, title: 'Uncited result' },
      ],
      usage: { total_input_tokens: 400, total_output_tokens: 100 },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const item = reviewCase('venue', 'fixture-source', 'venue-1', 'The Test Hall');
    const bundle = await enrichTrustLoopEntityWithGemini({
      entity: qualificationEntity(item),
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      requestedPredicates: qualificationPredicates('venue'),
    }, { apiKey: 'fixture-key' });

    expect(bundle.facts).toEqual([]);
    expect(bundle.usage).toMatchObject({ modelCalls: 1, inputTokens: 400, outputTokens: 100 });
    expect(bundle.raw).toMatchObject({
      rejectedFacts: [{
        fact: { predicate: 'hasWebsiteUrl', value: evidenceUrl },
        reason: expect.stringMatching(/uncaptured citation/i),
      }],
      evidence: [expect.objectContaining({ sourceUrl: evidenceUrl })],
    });
  });

  it('maps a Google grounding redirect only when its destination was captured as provider evidence', async () => {
    const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/test-token';
    const evidenceUrl = 'https://the-test-band.example/about';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        output_text: JSON.stringify({
          identityConfidence: 0.999,
          identityReason: 'The official site matches the named act and gig footprint.',
          facts: [{
            predicate: 'hasGenre',
            value: 'Rock',
            confidence: 0.99,
            evidenceUrls: [redirectUrl],
            evidenceText: 'The official site describes the act as a rock band.',
          }],
        }),
        steps: [{
          type: 'model_output',
          content: [{
            type: 'text',
            text: 'Grounded result',
            annotations: [{ type: 'url_citation', url: evidenceUrl, title: 'Official site' }],
          }],
        }],
        usage: { total_input_tokens: 500, total_output_tokens: 100 },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: evidenceUrl },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const item = reviewCase('artist', 'fixture-source', 'artist-1', 'The Test Band');
    const bundle = await enrichTrustLoopEntityWithGemini({
      entity: qualificationEntity(item),
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      requestedPredicates: qualificationPredicates('artist'),
    }, { apiKey: 'fixture-key' });

    expect(bundle.facts).toEqual([expect.objectContaining({
      predicate: 'hasGenre',
      value: 'Rock',
      evidenceUrls: [evidenceUrl],
    })]);
    expect(bundle.usage).toMatchObject({ fetches: 1 });
    expect(bundle.raw).toMatchObject({
      rejectedFacts: [],
      citationMappings: [{ sourceUrl: redirectUrl, resolvedUrl: evidenceUrl, acceptedAs: evidenceUrl }],
    });
  });

  it('keeps a resolved grounding redirect quarantined when the destination was not captured', async () => {
    const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/test-token';
    const uncapturedUrl = 'https://invented.example/about';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        output_text: JSON.stringify({
          identityConfidence: 0.9,
          identityReason: 'Claimed match.',
          facts: [{
            predicate: 'hasWebsiteUrl',
            value: uncapturedUrl,
            confidence: 0.9,
            evidenceUrls: [redirectUrl],
          }],
        }),
        steps: [{ type: 'google_search_call', arguments: { queries: ['test'] } }],
        usage: { total_input_tokens: 300, total_output_tokens: 80 },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: uncapturedUrl },
      })));

    const item = reviewCase('venue', 'fixture-source', 'venue-1', 'The Test Hall');
    const bundle = await enrichTrustLoopEntityWithGemini({
      entity: qualificationEntity(item),
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      requestedPredicates: qualificationPredicates('venue'),
    }, { apiKey: 'fixture-key' });

    expect(bundle.facts).toEqual([]);
    expect(bundle.raw).toMatchObject({
      rejectedFacts: [{ reason: expect.stringMatching(/uncaptured citation/i) }],
      citationMappings: [{ sourceUrl: redirectUrl, resolvedUrl: uncapturedUrl }],
    });
  });
});
