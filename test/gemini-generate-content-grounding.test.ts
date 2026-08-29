import { afterEach, describe, expect, it, vi } from 'vitest';
import { qualificationEntity, qualificationPredicates } from '../src/enrichment/qualification-cohort.js';
import { GroundedEnrichmentCaptureError } from '../src/google/gemini.js';
import { enrichTrustLoopEntityWithGeminiGenerateContent } from '../src/google/gemini-generate-content.js';
import type { TrustLoopReviewCase } from '../src/trust-loop/types.js';

function venueCase(): TrustLoopReviewCase {
  return {
    candidateType: 'venue',
    sourceId: 'gigs-news-daily-import',
    candidateKey: 'venue_whittles-oldham',
    displayName: 'Whittles Oldham',
    status: 'unresolved',
    canonicalHypotheses: [],
    supportingClaimIds: ['claim-1'],
    decisionReasoning: ['Needs grounded evidence'],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('Gemini GenerateContent grounded enrichment adapter', () => {
  it('admits a fact only when a groundingSupport links its claim text to a groundingChunk', async () => {
    const groundingUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/whittles';
    const modelText = JSON.stringify({
      identityConfidence: 0.99,
      identityReason: 'The exact venue and locality match.',
      facts: [{
        predicate: 'hasAddress',
        value: '57 Roscoe St, Oldham OL1 1EA',
        confidence: 0.98,
        evidenceUrls: ['https://whittlesoldham.com/'],
        evidenceText: 'Whittles lists 57 Roscoe St, Oldham OL1 1EA.',
      }],
    }, null, 2);
    const supportedText = '57 Roscoe St, Oldham OL1 1EA';
    const startIndex = modelText.indexOf(supportedText);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: { role: 'model', parts: [{ text: modelText }] },
        finishReason: 'STOP',
        groundingMetadata: {
          webSearchQueries: ['Whittles Oldham official address', 'Whittles Oldham venue'],
          groundingChunks: [{ web: { uri: groundingUrl, title: 'Whittles Oldham' } }],
          groundingSupports: [{
            segment: { startIndex, endIndex: startIndex + supportedText.length, text: supportedText },
            groundingChunkIndices: [0],
          }],
        },
      }],
      usageMetadata: { promptTokenCount: 1_000, candidatesTokenCount: 200 },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    const item = venueCase();
    const bundle = await enrichTrustLoopEntityWithGeminiGenerateContent({
      entity: qualificationEntity(item),
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      requestedPredicates: qualificationPredicates('venue'),
    }, { apiKey: 'fixture-key' });

    expect(bundle).toMatchObject({
      providerId: 'gemini-generatecontent-grounded-v1',
      identityConfidence: 0.99,
      facts: [{
        predicate: 'hasAddress',
        value: supportedText,
        evidenceUrls: [groundingUrl],
      }],
      usage: { searches: 2, modelCalls: 1, inputTokens: 1_000, outputTokens: 200 },
      raw: {
        transport: 'generateContent',
        citationCount: 1,
        groundingChunkCount: 1,
        groundingSupportCount: 1,
        rejectedFacts: [],
      },
    });
    expect(bundle.usage!.estimatedCost).toBeLessThan(0.05);
    const [url, requestInit] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('/v1beta/models/gemini-3.6-flash:generateContent');
    const request = JSON.parse(requestInit?.body as string);
    expect(request.tools).toEqual([{ google_search: {} }]);
    expect(request.contents[0].parts[0].text).toMatch(/at most two Google Search queries/i);
    expect(request).not.toHaveProperty('generationConfig');
  });

  it('quarantines model URLs when groundingSupports do not cover the fact claim', async () => {
    const modelText = JSON.stringify({
      identityConfidence: 0.99,
      identityReason: 'The venue name appears in search.',
      facts: [{
        predicate: 'hasWebsiteUrl',
        value: 'https://invented.example/',
        confidence: 0.99,
        evidenceUrls: ['https://invented.example/'],
      }],
    });
    const identityStart = modelText.indexOf('The venue name appears in search.');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: modelText }] },
        finishReason: 'STOP',
        groundingMetadata: {
          webSearchQueries: ['Whittles Oldham'],
          groundingChunks: [{
            web: {
              uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/identity',
              title: 'Search result',
            },
          }],
          groundingSupports: [{
            segment: {
              startIndex: identityStart,
              endIndex: identityStart + 'The venue name appears in search.'.length,
              text: 'The venue name appears in search.',
            },
            groundingChunkIndices: [0],
          }],
        },
      }],
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 100 },
    }), { status: 200 })));

    const item = venueCase();
    const bundle = await enrichTrustLoopEntityWithGeminiGenerateContent({
      entity: qualificationEntity(item),
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      requestedPredicates: qualificationPredicates('venue'),
    }, { apiKey: 'fixture-key' });

    expect(bundle.facts).toEqual([]);
    expect(bundle.raw).toMatchObject({
      citedUrls: [],
      citationCount: 0,
      rejectedFacts: [{
        fact: { predicate: 'hasWebsiteUrl', value: 'https://invented.example/' },
        reason: expect.stringMatching(/no groundingSupport linked/i),
      }],
    });
  });

  it('retains the complete provider response when the model JSON fails the Backline schema', async () => {
    const modelText = '{"identityConfidence":0.9,"facts":{}}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: modelText }] },
        finishReason: 'STOP',
        groundingMetadata: {
          webSearchQueries: ['Whittles Oldham'],
          groundingChunks: [],
          groundingSupports: [],
        },
      }],
      usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 50 },
    }), { status: 200 })));

    const item = venueCase();
    const failure = await enrichTrustLoopEntityWithGeminiGenerateContent({
      entity: qualificationEntity(item),
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      requestedPredicates: qualificationPredicates('venue'),
    }, { apiKey: 'fixture-key' }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(GroundedEnrichmentCaptureError);
    expect((failure as GroundedEnrichmentCaptureError).bundle).toMatchObject({
      providerId: 'gemini-generatecontent-grounded-v1',
      facts: [],
      usage: { searches: 1, modelCalls: 1, inputTokens: 300, outputTokens: 50 },
      raw: {
        transport: 'generateContent',
        responseText: modelText,
        providerResponse: expect.objectContaining({ candidates: expect.any(Array) }),
        captureError: expect.stringMatching(/failed the Backline schema/i),
      },
    });
  });
});
