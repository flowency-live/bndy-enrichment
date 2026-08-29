import crypto from 'node:crypto';
import { z } from 'zod';
import { ClaimPredicateSchema } from '../../knowledge/types.js';
import {
  EnrichmentReasonerCaptureError,
  type EnrichmentReasoner,
  type EnrichmentReasonerResult,
  type EnrichmentSearchResult,
} from './search-model.js';

const StructuredReasonerResponseSchema = z.object({
  identityConfidence: z.number().min(0).max(1),
  identityReason: z.string().min(1).max(2_000),
  facts: z.array(z.object({
    predicate: ClaimPredicateSchema,
    value: z.union([z.string(), z.boolean()]),
    confidence: z.number().min(0).max(1),
    evidenceUrls: z.array(z.string().url()).min(1),
    evidenceText: z.string().max(2_000).optional(),
  })).max(50),
});

export type GeminiStructuredReasonerOptions = {
  apiKey: string;
  model?: string;
  id?: string;
  inputCostPerMillionTokens?: number;
  outputCostPerMillionTokens?: number;
  fetchImpl?: typeof fetch;
};

function outputText(raw: any): string | undefined {
  if (typeof raw?.output_text === 'string') return raw.output_text;
  if (typeof raw?.outputText === 'string') return raw.outputText;
  const texts: string[] = [];
  for (const step of raw?.steps ?? []) {
    if (step?.type !== 'model_output') continue;
    for (const item of step?.content ?? []) {
      if (item?.type === 'text' && typeof item.text === 'string') texts.push(item.text);
    }
  }
  return texts.length ? texts[texts.length - 1] : undefined;
}

function usageTokens(raw: any): { inputTokens: number; outputTokens: number } {
  const inputTokens = raw?.usage?.total_input_tokens
    ?? raw?.usage?.input_tokens
    ?? raw?.usageMetadata?.promptTokenCount;
  const outputTokens = raw?.usage?.total_output_tokens
    ?? raw?.usage?.output_tokens
    ?? raw?.usageMetadata?.candidatesTokenCount;
  if (!Number.isInteger(inputTokens) || inputTokens < 0
    || !Number.isInteger(outputTokens) || outputTokens < 0) {
    throw new Error('Gemini structured reasoner response omitted measured token usage');
  }
  return { inputTokens, outputTokens };
}

function evidenceAllowList(searches: Array<{ query: string; results: EnrichmentSearchResult[] }>) {
  return searches.flatMap(({ query, results }) => results.map((result) => ({
    query,
    title: result.title,
    url: result.url,
    snippet: result.snippet,
  })));
}

export function buildGeminiStructuredEnrichmentPrompt(input: Parameters<EnrichmentReasoner['analyse']>[0]): string {
  return `You are the deterministic reasoning stage of BNDY Backline entity enrichment.

The search stage has already completed. Use only the exact EVIDENCE ALLOW-LIST below. Do not browse, call tools, use remembered facts or invent a URL. Every evidenceUrls value must exactly match a URL in that allow-list.

ENTITY:
${JSON.stringify({
    entityType: input.entity.entityType,
    entityId: input.entity.entityId,
    displayName: input.entity.displayName,
    currentValues: input.entity.currentValues,
  }, null, 2)}

REQUESTED PREDICATES:
${JSON.stringify(input.requestedPredicates)}

EVIDENCE ALLOW-LIST:
${JSON.stringify(evidenceAllowList(input.searches), null, 2)}

RULES:
- Resolve identity before extracting facts. Name similarity alone is insufficient.
- identityConfidence may be 0.98 or higher only when the evidence ties the exact Artist or Venue to its locality, gig footprint or mutually linked official presence.
- Same-name Artists and generic Venue names are hard negatives. If identity is unsafe, return low identityConfidence and an empty facts array.
- Return only requested predicates and only values directly supported by the allow-list.
- An official URL must be proven to belong to this exact entity. Facebook is optional, not a completeness requirement.
- Artist type values: Band, Solo Act, Duo, Trio, Group, DJ, Collective.
- Act type values: Originals, Covers, Tribute Act. Return one fact per value.
- Genre values: Rock, Rock n Roll, Grunge, Metal, Punk, Alternative, New Wave, Pop, Indie, Britpop, Mod, Blues, R&B, Country, Americana, Folk, Soul, Funk, Motown, Electronic, Dance, Jazz, Classical, Reggae, Latin, Other.
- isAcoustic requires explicit positive or negative evidence; otherwise omit it.
- If identity is safe but no official presence is proven, officialPresenceAttempted may be no-official-presence-found when supported by the inspected evidence.
- Do not write to any canonical system.`;
}

function responseSchema(predicates: string[]): object {
  return {
    type: 'object',
    properties: {
      identityConfidence: { type: 'number', minimum: 0, maximum: 1 },
      identityReason: { type: 'string' },
      facts: {
        type: 'array',
        maxItems: 50,
        items: {
          type: 'object',
          properties: {
            predicate: { type: 'string', enum: predicates },
            value: { anyOf: [{ type: 'string' }, { type: 'boolean' }] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            evidenceUrls: { type: 'array', minItems: 1, items: { type: 'string' } },
            evidenceText: { type: 'string' },
          },
          required: ['predicate', 'value', 'confidence', 'evidenceUrls'],
        },
      },
    },
    required: ['identityConfidence', 'identityReason', 'facts'],
  };
}

/** One stateless, schema-constrained Gemini reasoning call over captured evidence. */
export class GeminiStructuredEnrichmentReasoner implements EnrichmentReasoner {
  readonly id: string;
  private readonly fetchImpl: typeof fetch;
  private readonly model: string;
  private readonly inputCostPerMillionTokens: number;
  private readonly outputCostPerMillionTokens: number;

  constructor(private readonly options: GeminiStructuredReasonerOptions) {
    if (!options.apiKey.trim()) throw new Error('Gemini API key is required');
    this.id = options.id ?? 'gemini-structured-reasoner-v1';
    this.model = options.model ?? 'gemini-3.6-flash';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.inputCostPerMillionTokens = options.inputCostPerMillionTokens ?? 0.75;
    this.outputCostPerMillionTokens = options.outputCostPerMillionTokens ?? 3.75;
  }

  async analyse(input: Parameters<EnrichmentReasoner['analyse']>[0]): Promise<EnrichmentReasonerResult> {
    const startedAt = Date.now();
    const prompt = buildGeminiStructuredEnrichmentPrompt(input);
    const inputTokenUpperBound = Buffer.byteLength(prompt, 'utf8');
    if (inputTokenUpperBound > input.budget.maxInputTokens) {
      throw new Error('Gemini structured reasoner evidence exceeds the reserved input-token budget');
    }
    const maximumEstimatedCost = (inputTokenUpperBound * this.inputCostPerMillionTokens / 1_000_000)
      + (input.budget.maxOutputTokens * this.outputCostPerMillionTokens / 1_000_000);
    if (maximumEstimatedCost > input.budget.maxEstimatedCost) {
      throw new Error('Gemini structured reasoner cannot fit inside the remaining cost budget');
    }

    const response = await this.fetchImpl('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      signal: AbortSignal.timeout(Math.max(1, input.budget.deadlineMs)),
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.options.apiKey,
      },
      body: JSON.stringify({
        model: this.model,
        input: prompt,
        store: false,
        generation_config: {
          temperature: 0,
          thinking_level: 'low',
          max_output_tokens: input.budget.maxOutputTokens,
        },
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: responseSchema(input.requestedPredicates),
        },
      }),
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new Error(`Gemini structured reasoner ${response.status}: ${body}`);
    }

    const raw: any = await response.json();
    const text = outputText(raw);
    if (!text) throw new Error('Gemini structured reasoner returned no model output');
    const tokens = usageTokens(raw);
    const usage = {
      ...tokens,
      estimatedCost: (tokens.inputTokens * this.inputCostPerMillionTokens / 1_000_000)
        + (tokens.outputTokens * this.outputCostPerMillionTokens / 1_000_000),
      durationMs: Date.now() - startedAt,
    };
    const providerRunId = raw?.id ?? crypto.randomUUID();
    try {
      const parsed = StructuredReasonerResponseSchema.parse(JSON.parse(text));
      return {
        providerRunId,
        retrievedAt: new Date().toISOString(),
        identityConfidence: parsed.identityConfidence,
        facts: parsed.facts,
        usage,
        raw: {
          model: this.model,
          identityReason: parsed.identityReason,
          response: parsed,
          evidenceAllowList: evidenceAllowList(input.searches),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result: EnrichmentReasonerResult = {
        providerRunId,
        retrievedAt: new Date().toISOString(),
        identityConfidence: 0,
        facts: [],
        usage,
        raw: {
          model: this.model,
          captureError: `Structured response failed the Backline schema: ${message}`,
          responseText: text,
          evidenceAllowList: evidenceAllowList(input.searches),
        },
      };
      throw new EnrichmentReasonerCaptureError(
        `Gemini structured response failed the Backline schema: ${message}`,
        result,
        error,
      );
    }
  }
}
