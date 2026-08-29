import { afterEach, describe, expect, it, vi } from 'vitest';
import { qualificationEntity, qualificationPredicates } from '../src/enrichment/qualification-cohort.js';
import { GroundedEnrichmentCaptureError } from '../src/google/gemini.js';
import { enrichTrustLoopEntityWithGeminiInteractionsEvidenceFirst } from '../src/google/gemini-interactions-evidence-first.js';
import type { TrustLoopReviewCase } from '../src/trust-loop/types.js';

const selected: TrustLoopReviewCase = {
  candidateType: 'venue',
  sourceId: 'gigs-news-daily-import',
  candidateKey: 'venue_whittles-oldham',
  displayName: 'Whittles Oldham',
  status: 'unresolved',
  canonicalHypotheses: [],
  supportingClaimIds: ['claim-1'],
  decisionReasoning: ['Needs grounded evidence'],
};

afterEach(() => vi.unstubAllGlobals());

function response(text: string, annotations: unknown[], queries = ['Whittles Oldham official venue']): Response {
  return new Response(JSON.stringify({
    output_text: text,
    steps: [
      { type: 'google_search_call', arguments: { queries } },
      { type: 'model_output', content: [{ type: 'text', text, annotations }] },
    ],
    usage: { total_input_tokens: 800, total_output_tokens: 120 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function run() {
  return enrichTrustLoopEntityWithGeminiInteractionsEvidenceFirst({
    entity: qualificationEntity(selected),
    sourceId: selected.sourceId,
    sourceCandidateKey: selected.candidateKey,
    requestedPredicates: qualificationPredicates('venue'),
  }, { apiKey: 'fixture-key' });
}

describe('Gemini Interactions evidence-first adapter', () => {
  it('admits a fact only when a provider url_citation ends within its exact FACT line', async () => {
    const identity = 'IDENTITY\t0.99\t"Official evidence establishes the exact Oldham venue."';
    const fact = 'FACT\t"hasAddress"\t"57 Roscoe St, Oldham OL1 1EA"\t0.99\t"The official venue page states this address."';
    const text = `${identity}\n${fact}`;
    const factStart = text.indexOf(fact);
    const evidenceUrl = 'https://whittlesoldham.example/contact';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(text, [{
      type: 'url_citation',
      url: evidenceUrl,
      title: 'Whittles Oldham',
      start_index: factStart,
      end_index: factStart + fact.length,
    }])));

    const bundle = await run();

    expect(bundle).toMatchObject({
      providerId: 'gemini-interactions-evidence-first-v1',
      identityConfidence: 0.99,
      facts: [{
        predicate: 'hasAddress',
        value: '57 Roscoe St, Oldham OL1 1EA',
        confidence: 0.99,
        evidenceUrls: [evidenceUrl],
      }],
      usage: { searches: 1, modelCalls: 1, inputTokens: 800, outputTokens: 120 },
    });
    expect(bundle.raw).toMatchObject({
      transport: 'interactions',
      outputContract: 'tab-delimited-evidence-first-v1',
      citationCount: 1,
      rejectedFacts: [],
    });
    const request = JSON.parse((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string);
    expect(request).toMatchObject({ store: false, tools: [{ type: 'google_search' }] });
    expect(request).not.toHaveProperty('response_format');
    expect(request.input).toMatch(/one or two focused, non-empty search queries/i);
    expect(request.input).toMatch(/provider url_citation for each fact to that exact FACT line/i);
  });

  it('quarantines a fact when the citation is attached outside its exact FACT line', async () => {
    const identity = 'IDENTITY\t0.99\t"Official evidence establishes the exact Oldham venue."';
    const fact = 'FACT\t"hasAddress"\t"57 Roscoe St, Oldham OL1 1EA"\t0.99\t"The official venue page states this address."';
    const text = `${identity}\n${fact}`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(text, [{
      type: 'url_citation',
      url: 'https://whittlesoldham.example/contact',
      startIndex: 0,
      endIndex: identity.length,
    }])));

    const bundle = await run();

    expect(bundle.identityConfidence).toBe(0);
    expect(bundle.facts).toEqual([]);
    expect(bundle.raw).toMatchObject({
      citationCount: 1,
      rejectedFacts: [expect.objectContaining({
        reason: 'no provider url_citation ends within the exact FACT output segment',
      })],
    });
  });

  it('does not leak a cumulative citation backwards into an earlier FACT line', async () => {
    const identity = 'IDENTITY\t0.99\t"Official evidence establishes the exact Oldham venue."';
    const address = 'FACT\t"hasAddress"\t"57 Roscoe St, Oldham OL1 1EA"\t0.99\t"The address is stated."';
    const location = 'FACT\t"hasLocation"\t"Oldham, United Kingdom"\t0.99\t"The location is stated."';
    const text = `${identity}\n${address}\n${location}`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(text, [{
      type: 'url_citation',
      url: 'https://whittlesoldham.example/contact',
      startIndex: 0,
      endIndex: text.length,
    }])));

    const bundle = await run();

    expect(bundle.facts).toEqual([expect.objectContaining({ predicate: 'hasLocation' })]);
    expect(bundle.raw).toMatchObject({
      rejectedFacts: [expect.objectContaining({
        fact: expect.objectContaining({ predicate: 'hasAddress' }),
      })],
    });
  });

  it('fails closed and retains the provider response when no search occurred', async () => {
    const text = 'IDENTITY\t0.2\t"No safe evidence was found."';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(text, [], [])));

    const failure = await run().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(GroundedEnrichmentCaptureError);
    expect((failure as GroundedEnrichmentCaptureError).message).toMatch(/observed 0 Google Search queries/i);
    expect((failure as GroundedEnrichmentCaptureError).bundle).toMatchObject({
      identityConfidence: 0,
      facts: [],
      usage: { searches: 0, modelCalls: 1 },
      raw: { providerResponse: expect.any(Object), citationCount: 0 },
    });
  });

  it('fails closed on prose outside the deterministic line contract', async () => {
    const text = 'Here are the facts:\nIDENTITY\t0.2\t"No safe evidence was found."';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(text, [])));

    const failure = await run().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(GroundedEnrichmentCaptureError);
    expect((failure as GroundedEnrichmentCaptureError).message).toMatch(/plain-text contract/i);
    expect((failure as GroundedEnrichmentCaptureError).bundle.raw).toMatchObject({
      providerResponse: expect.any(Object),
      responseText: text,
    });
  });
});
