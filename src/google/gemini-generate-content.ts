import crypto from 'node:crypto';
import { z } from 'zod';
import type { Evidence } from '../domain/schema.js';
import {
  EnrichmentEvidenceBundleSchema,
  type CanonicalEntitySnapshot,
  type EnrichmentEvidenceBundle,
} from '../enrichment/types.js';
import { ClaimPredicateSchema, type ClaimPredicate } from '../knowledge/types.js';
import { assertSafeUrl } from '../sources/runner/acquisition.js';
import { GroundedEnrichmentCaptureError } from './gemini.js';
import { buildTrustLoopEnrichmentPrompt } from './prompt.js';

const ProviderResponseSchema = z.object({
  identityConfidence: z.number().min(0).max(1),
  identityReason: z.string().min(1).max(2_000),
  facts: z.array(z.object({
    predicate: ClaimPredicateSchema,
    value: z.union([z.string(), z.boolean()]),
    confidence: z.number().min(0).max(1),
    // These are retained as model output only. Admission is derived exclusively
    // from provider groundingMetadata, never from these naked model URLs.
    evidenceUrls: z.array(z.string()).default([]),
    evidenceText: z.string().max(2_000).optional(),
  })).max(50),
});

interface TextRange {
  start: number;
  end: number;
}

interface GenerateContentResult {
  raw: any;
  text: string;
  groundingMetadata: any;
  queryCount: number;
  inputTokens: number;
  outputTokens: number;
}

function buildGenerateContentGroundingPrompt(input: {
  entity: CanonicalEntitySnapshot;
  sourceId: string;
  sourceCandidateKey: string;
  requestedPredicates: ClaimPredicate[];
}): string {
  return `MANDATORY GENERATECONTENT SEARCH GATE:
- You MUST invoke the supplied Google Search tool before answering.
- Execute one or two focused, non-empty Google Search queries for this exact entity.
- Do not answer from model memory or prior knowledge, even if the entity appears familiar.
- Return no facts unless the live Google Search evidence supports them.
- If Google Search is unavailable or cannot be invoked, abstain with identityConfidence 0 and facts [].

${buildTrustLoopEnrichmentPrompt(input)}`;
}

function safeHttpsUrl(value: string): string {
  const parsed = assertSafeUrl(value);
  if (parsed.protocol !== 'https:') throw new Error(`Grounding evidence must use HTTPS: ${value}`);
  return parsed.toString();
}

function parseJsonModelOutput(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch (initialError) {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw initialError;
  }
}

function factObjectRanges(text: string): TextRange[] {
  let arrayStart = -1;
  let inString = false;
  let escaped = false;
  let stringStart = -1;
  let objectDepth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') {
        inString = false;
        if (objectDepth !== 1 || stringStart < 0) continue;
        let key: unknown;
        try {
          key = JSON.parse(text.slice(stringStart, index + 1));
        } catch {
          continue;
        }
        if (key !== 'facts') continue;
        const remainder = text.slice(index + 1);
        const match = /^\s*:\s*\[/.exec(remainder);
        if (match) arrayStart = index + 1 + match[0].lastIndexOf('[');
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      stringStart = index;
    } else if (character === '{') objectDepth += 1;
    else if (character === '}') objectDepth -= 1;
    if (arrayStart >= 0) break;
  }
  if (arrayStart < 0) return [];

  const ranges: TextRange[] = [];
  inString = false;
  escaped = false;
  objectDepth = 0;
  let objectStart = -1;
  for (let index = arrayStart + 1; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') {
      if (objectDepth === 0) objectStart = index;
      objectDepth += 1;
      continue;
    }
    if (character === '}') {
      objectDepth -= 1;
      if (objectDepth === 0 && objectStart >= 0) {
        ranges.push({ start: objectStart, end: index + 1 });
        objectStart = -1;
      }
      continue;
    }
    if (character === ']' && objectDepth === 0) break;
  }
  return ranges;
}

function tokenRanges(text: string, factRange: TextRange, tokens: string[]): TextRange[] {
  const ranges: TextRange[] = [];
  const factText = text.slice(factRange.start, factRange.end);
  for (const token of new Set(tokens.filter(Boolean))) {
    let from = 0;
    while (from < factText.length) {
      const relativeStart = factText.indexOf(token, from);
      if (relativeStart < 0) break;
      ranges.push({
        start: factRange.start + relativeStart,
        end: factRange.start + relativeStart + token.length,
      });
      from = relativeStart + Math.max(token.length, 1);
    }
  }
  return ranges;
}

function overlaps(left: TextRange, right: TextRange): boolean {
  return left.start < right.end && left.end > right.start;
}

function extractText(raw: any): string | undefined {
  const parts = raw?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return undefined;
  const texts = parts
    .map((part: any) => typeof part?.text === 'string' ? part.text : undefined)
    .filter((text: string | undefined): text is string => text !== undefined);
  return texts.length > 0 ? texts.join('') : undefined;
}

async function callGenerateContent(
  apiKey: string,
  model: string,
  prompt: string,
  timeoutMs: number,
): Promise<GenerateContentResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini GenerateContent ${response.status}: ${await response.text()}`);
  const raw: any = await response.json();
  const text = extractText(raw);
  if (!text) throw new Error('Gemini GenerateContent response contained no model text output');
  const groundingMetadata = raw?.candidates?.[0]?.groundingMetadata;
  const queries = Array.isArray(groundingMetadata?.webSearchQueries)
    ? groundingMetadata.webSearchQueries
      .filter((query: unknown): query is string => typeof query === 'string' && query.trim().length > 0)
      .map((query: string) => query.trim())
    : [];
  return {
    raw,
    text,
    groundingMetadata,
    queryCount: new Set(queries).size,
    inputTokens: raw?.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: raw?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

function usage(result: GenerateContentResult, startedAt: number) {
  // Same conservative qualification estimate as the existing Gemini adapter.
  const estimatedCost = (result.inputTokens * 0.75 / 1_000_000)
    + (result.outputTokens * 3.75 / 1_000_000)
    + (result.queryCount * 0.014);
  return {
    searches: result.queryCount,
    fetches: 0,
    modelCalls: 1,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    estimatedCost,
    durationMs: Date.now() - startedAt,
  };
}

function failureBundle(
  providerRunId: string,
  model: string,
  result: GenerateContentResult,
  startedAt: number,
  message: string,
): EnrichmentEvidenceBundle {
  return EnrichmentEvidenceBundleSchema.parse({
    providerId: 'gemini-generatecontent-grounded-v1',
    providerRunId,
    retrievedAt: new Date().toISOString(),
    identityConfidence: 0,
    facts: [],
    usage: usage(result, startedAt),
    raw: {
      model,
      transport: 'generateContent',
      captureError: message,
      responseText: result.text,
      groundingMetadata: result.groundingMetadata,
      providerResponse: result.raw,
      rejectedFacts: [],
      citationMappings: [],
    },
  });
}

export async function enrichTrustLoopEntityWithGeminiGenerateContent(input: {
  entity: CanonicalEntitySnapshot;
  sourceId: string;
  sourceCandidateKey: string;
  requestedPredicates: ClaimPredicate[];
}, options: { apiKey: string; model?: string }): Promise<EnrichmentEvidenceBundle> {
  const startedAt = Date.now();
  const model = options.model ?? 'gemini-3.6-flash';
  const providerRunId = crypto.randomUUID();
  const requestedPredicates = [...new Set(input.requestedPredicates)];
  if (requestedPredicates.length === 0) throw new Error('Grounded enrichment requires requested predicates');

  const result = await callGenerateContent(
    options.apiKey,
    model,
    buildGenerateContentGroundingPrompt({ ...input, requestedPredicates }),
    60_000,
  );
  if (!result.groundingMetadata) {
    const message = 'Provider response contained no groundingMetadata after the mandatory Google Search request';
    throw new GroundedEnrichmentCaptureError(
      `Gemini GenerateContent grounding failed closed: ${message}`,
      failureBundle(providerRunId, model, result, startedAt, message),
    );
  }
  if (result.queryCount === 0) {
    const message = 'Provider groundingMetadata contained no non-empty Google Search query';
    throw new GroundedEnrichmentCaptureError(
      `Gemini GenerateContent grounding failed closed: ${message}`,
      failureBundle(providerRunId, model, result, startedAt, message),
    );
  }
  let parsed: z.infer<typeof ProviderResponseSchema>;
  try {
    parsed = ProviderResponseSchema.parse(parseJsonModelOutput(result.text));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Provider response failed the Backline schema: ${detail}`;
    throw new GroundedEnrichmentCaptureError(
      `Gemini GenerateContent grounded response failed the Backline schema: ${detail}`,
      failureBundle(providerRunId, model, result, startedAt, message),
      error,
    );
  }

  const groundingChunks = Array.isArray(result.groundingMetadata?.groundingChunks)
    ? result.groundingMetadata.groundingChunks
    : [];
  const groundingSupports = Array.isArray(result.groundingMetadata?.groundingSupports)
    ? result.groundingMetadata.groundingSupports
    : [];
  const ranges = factObjectRanges(result.text);
  const evidenceByUrl = new Map<string, Evidence>();
  const rejectedFacts: Array<Record<string, unknown>> = [];
  const citationMappings: Array<Record<string, unknown>> = [];
  const facts: z.infer<typeof ProviderResponseSchema>['facts'] = [];

  for (const [factIndex, fact] of parsed.facts.entries()) {
    if (!requestedPredicates.includes(fact.predicate)) {
      rejectedFacts.push({ fact, reason: `unrequested predicate: ${fact.predicate}` });
      continue;
    }
    const factRange = ranges[factIndex];
    if (!factRange) {
      rejectedFacts.push({ fact, reason: 'no provider grounding range could be mapped to this fact' });
      continue;
    }
    const claimRanges = tokenRanges(result.text, factRange, [
      JSON.stringify(fact.value),
      ...(fact.evidenceText ? [JSON.stringify(fact.evidenceText)] : []),
    ]);
    const matchingSupports = groundingSupports
      .map((support: any, supportIndex: number) => ({ support, supportIndex }))
      .filter(({ support }: { support: any }) => {
        const start = support?.segment?.startIndex;
        const end = support?.segment?.endIndex;
        if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return false;
        return claimRanges.some((range) => overlaps(range, { start, end }));
      });
    const chunkIndexSet = new Set<number>();
    for (const { support } of matchingSupports) {
      if (!Array.isArray(support?.groundingChunkIndices)) continue;
      for (const index of support.groundingChunkIndices) {
        if (Number.isInteger(index)) chunkIndexSet.add(index as number);
      }
    }
    const chunkIndices = [...chunkIndexSet];
    const evidenceUrls: string[] = [];
    for (const chunkIndex of chunkIndices) {
      const chunk = groundingChunks[chunkIndex];
      const uri = chunk?.web?.uri;
      if (typeof uri !== 'string') continue;
      try {
        const sourceUrl = safeHttpsUrl(uri);
        evidenceUrls.push(sourceUrl);
        const matchingSupport = matchingSupports.find(({ support }: { support: any }) =>
          Array.isArray(support?.groundingChunkIndices)
          && support.groundingChunkIndices.includes(chunkIndex));
        if (!evidenceByUrl.has(sourceUrl)) {
          evidenceByUrl.set(sourceUrl, {
            id: `ev_${crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 12)}`,
            sourceUrl,
            sourceDomain: new URL(sourceUrl).hostname,
            title: typeof chunk?.web?.title === 'string' ? chunk.web.title : undefined,
            snippet: typeof matchingSupport?.support?.segment?.text === 'string'
              ? matchingSupport.support.segment.text
              : undefined,
            supports: [],
          });
        }
      } catch {
        // Unsafe or non-HTTPS provider chunks are retained in the raw response only.
      }
    }
    const uniqueEvidenceUrls = [...new Set(evidenceUrls)];
    citationMappings.push({
      factIndex,
      factRange,
      supportIndices: matchingSupports.map(({ supportIndex }: { supportIndex: number }) => supportIndex),
      groundingChunkIndices: chunkIndices,
      evidenceUrls: uniqueEvidenceUrls,
    });
    if (uniqueEvidenceUrls.length === 0) {
      rejectedFacts.push({
        fact,
        reason: 'no groundingSupport linked this fact value or evidence text to a safe groundingChunk',
      });
      continue;
    }
    facts.push({ ...fact, evidenceUrls: uniqueEvidenceUrls });
  }

  const citedUrls = [...new Set(facts.flatMap((fact) => fact.evidenceUrls))];
  return EnrichmentEvidenceBundleSchema.parse({
    providerId: 'gemini-generatecontent-grounded-v1',
    providerRunId,
    retrievedAt: new Date().toISOString(),
    identityConfidence: parsed.identityConfidence,
    facts,
    usage: usage(result, startedAt),
    raw: {
      model,
      transport: 'generateContent',
      identityReason: parsed.identityReason,
      response: parsed,
      responseText: result.text,
      evidence: [...evidenceByUrl.values()],
      citedUrls,
      citationCount: citedUrls.length,
      groundingChunkCount: groundingChunks.length,
      groundingSupportCount: groundingSupports.length,
      groundingMetadata: result.groundingMetadata,
      providerResponse: result.raw,
      rejectedFacts,
      citationMappings,
    },
  });
}
