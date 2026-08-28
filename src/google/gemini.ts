import crypto from 'node:crypto';
import { z } from 'zod';
import {
  AdmissionSchema,
  DiscoveryResponseSchema,
  EntityEnrichmentSchema,
  type DiscoveryResult,
  type EntityEnrichment,
  type Evidence,
  type EventCandidate,
  type SearchEntity,
} from '../domain/schema.js';
import { ClaimPredicateSchema, type ClaimPredicate } from '../knowledge/types.js';
import { assertSafeUrl } from '../sources/runner/acquisition.js';
import {
  EnrichmentEvidenceBundleSchema,
  type CanonicalEntitySnapshot,
  type EnrichmentEvidenceBundle,
} from '../enrichment/types.js';
import {
  classifyEligibility,
  commercialEntitySignals,
  partitionEvents,
} from '../domain/eligibility.js';
import {
  buildAdmissionFollowUpPrompt,
  buildDiscoveryPrompt,
  buildEntityEnrichmentFollowUpPrompt,
  buildTrustLoopEnrichmentPrompt,
} from './prompt.js';

export interface GeminiOptions {
  apiKey: string;
  model?: string;
  horizonDays?: number;
}

const genreValues = [
  'Rock', 'Rock n Roll', 'Grunge', 'Metal', 'Punk', 'Alternative', 'New Wave', 'Pop',
  'Indie', 'Britpop', 'Mod', 'Blues', 'R&B', 'Country', 'Americana', 'Folk', 'Soul',
  'Funk', 'Motown', 'Electronic', 'Dance', 'Jazz', 'Classical', 'Reggae', 'Latin', 'Other',
];
const artistTypeValues = ['Band', 'Solo Act', 'Duo', 'Trio', 'Group', 'DJ', 'Collective'];
const actTypeValues = ['Originals', 'Covers', 'Tribute Act'];
const classificationSourceValues = ['artist_declared', 'official_source', 'promoter_or_venue', 'gemini_inferred'];

const classificationEvidenceProperties = {
  confidence: { type: 'number', minimum: 0, maximum: 1 },
  source: { type: 'string', enum: classificationSourceValues },
  evidenceUrls: { type: 'array', items: { type: 'string' } },
  rawText: { type: 'string' },
};

const artistProfileProperties = {
  genres: { type: 'array', items: { type: 'string', enum: genreValues } },
  genreEvidence: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        genre: { type: 'string', enum: genreValues },
        ...classificationEvidenceProperties,
      },
      required: ['genre', 'confidence', 'source', 'evidenceUrls'],
    },
  },
  artistType: { type: 'string', enum: artistTypeValues },
  artistTypeEvidence: {
    type: 'object',
    properties: classificationEvidenceProperties,
    required: ['confidence', 'source', 'evidenceUrls'],
  },
  actTypes: { type: 'array', items: { type: 'string', enum: actTypeValues } },
  actTypeEvidence: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        actType: { type: 'string', enum: actTypeValues },
        ...classificationEvidenceProperties,
      },
      required: ['actType', 'confidence', 'source', 'evidenceUrls'],
    },
  },
  acousticPerformances: { type: 'boolean' },
  acousticEvidence: {
    type: 'object',
    properties: classificationEvidenceProperties,
    required: ['confidence', 'source', 'evidenceUrls'],
  },
};

const facebookProperties = {
  searched: { type: 'boolean' },
  status: { type: 'string', enum: ['matched', 'not_found', 'ambiguous', 'not_searched'] },
  url: { type: 'string' },
  confidence: { type: 'number', minimum: 0, maximum: 1 },
  evidenceUrls: { type: 'array', items: { type: 'string' } },
  notes: { type: ['string', 'null'] },
};

const enrichmentProperties = {
  entityType: { type: 'string', enum: ['artist', 'venue'] },
  name: { type: 'string' },
  town: { type: 'string' },
  officialWebsite: { type: 'string' },
  facebook: {
    type: 'object',
    properties: facebookProperties,
    required: ['searched', 'status', 'confidence', 'evidenceUrls'],
  },
  bio: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      evidenceUrls: { type: 'array', items: { type: 'string' } },
    },
    required: ['evidenceUrls'],
  },
  artistProfile: {
    type: 'object',
    properties: artistProfileProperties,
    required: ['genres', 'genreEvidence', 'actTypes', 'actTypeEvidence'],
  },
  evidenceUrls: { type: 'array', items: { type: 'string' } },
};

const ticketProperties = {
  expected: { type: 'boolean' },
  status: { type: 'string', enum: ['found', 'not_found', 'not_applicable', 'unknown'] },
  ticketUrl: { type: 'string' },
  provider: { type: 'string' },
  priceText: { type: 'string' },
  onSale: { type: 'boolean' },
  evidenceUrls: { type: 'array', items: { type: 'string' } },
};

const admissionProperties = {
  status: { type: 'string', enum: ['FREE_CONFIRMED', 'PAID_CONFIRMED', 'UNKNOWN'] },
  confidence: { type: 'number', minimum: 0, maximum: 1 },
  priceText: { type: 'string' },
  evidenceUrls: { type: 'array', items: { type: 'string' } },
  reason: { type: 'string' },
};

const responseSchema = {
  type: 'object',
  properties: {
    identityConfidence: { type: 'number', minimum: 0, maximum: 1 },
    entityEnrichment: {
      type: 'object',
      properties: enrichmentProperties,
      required: ['entityType', 'name', 'facebook', 'bio', 'evidenceUrls'],
    },
    discoveredEntities: {
      type: 'array',
      items: {
        type: 'object',
        properties: enrichmentProperties,
        required: ['entityType', 'name', 'facebook', 'bio', 'evidenceUrls'],
      },
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          artistName: { type: 'string' },
          venueName: { type: 'string' },
          town: { type: 'string' },
          eventDate: { type: 'string' },
          startTime: { type: 'string' },
          timezone: { type: 'string' },
          cancelled: { type: 'boolean' },
          confidence: { type: 'number' },
          sourceUrls: { type: 'array', items: { type: 'string' } },
          eventUrl: { type: 'string' },
          promoter: { type: 'string' },
          supportActs: { type: 'array', items: { type: 'string' } },
          ticketing: {
            type: 'object',
            properties: ticketProperties,
            required: ['expected', 'status', 'evidenceUrls'],
          },
          admission: {
            type: 'object',
            properties: admissionProperties,
            required: ['status', 'confidence', 'evidenceUrls'],
          },
          notes: { type: ['string', 'null'] },
        },
        required: [
          'artistName', 'venueName', 'eventDate', 'timezone', 'cancelled', 'confidence',
          'sourceUrls', 'supportActs', 'ticketing', 'admission',
        ],
      },
    },
  },
  required: ['identityConfidence', 'entityEnrichment', 'discoveredEntities', 'events'],
};

const AdmissionFollowUpItemSchema = z.object({
  index: z.number().int().nonnegative(),
  admission: AdmissionSchema,
});
const AdmissionFollowUpSchema = z.object({ results: z.array(AdmissionFollowUpItemSchema) });
const admissionFollowUpResponseSchema = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          admission: {
            type: 'object',
            properties: admissionProperties,
            required: ['status', 'confidence', 'evidenceUrls'],
          },
        },
        required: ['index', 'admission'],
      },
    },
  },
  required: ['results'],
};

const EnrichmentFollowUpItemSchema = z.object({
  index: z.number().int().nonnegative(),
  enrichment: EntityEnrichmentSchema,
});
const EnrichmentFollowUpSchema = z.object({ results: z.array(EnrichmentFollowUpItemSchema) });
const enrichmentFollowUpResponseSchema = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          enrichment: {
            type: 'object',
            properties: enrichmentProperties,
            required: ['entityType', 'name', 'facebook', 'bio', 'evidenceUrls'],
          },
        },
        required: ['index', 'enrichment'],
      },
    },
  },
  required: ['results'],
};

const GroundedEnrichmentResponseSchema = z.object({
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

interface ApiCallResult {
  raw: any;
  text: string;
  evidence: Evidence[];
  queryCount: number;
  inputTokens?: number;
  outputTokens?: number;
}

type EnrichmentUsage = NonNullable<EnrichmentEvidenceBundle['usage']>;

export class GroundedEnrichmentCaptureError extends Error {
  readonly bundle: EnrichmentEvidenceBundle;

  constructor(message: string, bundle: EnrichmentEvidenceBundle, cause?: unknown) {
    super(message, { cause });
    this.name = 'GroundedEnrichmentCaptureError';
    this.bundle = bundle;
  }
}

function groundedEnrichmentUsage(result: ApiCallResult, startedAt: number): EnrichmentUsage {
  const inputTokens = result.inputTokens ?? 0;
  const outputTokens = result.outputTokens ?? 0;
  // Conservative post-free-pool estimate: Gemini 3.6 Flash standard tokens plus
  // Google Search grounding. Qualification records the estimate but performs no billing action.
  const estimatedCost = (inputTokens * 0.75 / 1_000_000)
    + (outputTokens * 3.75 / 1_000_000)
    + (result.queryCount * 0.014);

  return {
    searches: result.queryCount,
    fetches: 0,
    modelCalls: 1,
    inputTokens,
    outputTokens,
    estimatedCost,
    durationMs: Date.now() - startedAt,
  };
}

function extractOutputText(raw: any): string | undefined {
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

function extractEvidence(raw: any): { evidence: Evidence[]; queryCount: number } {
  const evidence: Evidence[] = [];
  let queryCount = 0;
  const seen = new Set<string>();

  const addEvidence = (node: any, snippet?: string) => {
    const url = node?.url ?? node?.uri ?? node?.source?.url;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url) || seen.has(url)) return;
    seen.add(url);
    evidence.push({
      id: `ev_${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}`,
      sourceUrl: url,
      sourceDomain: new URL(url).hostname,
      title: node.title,
      snippet: snippet ?? node.snippet,
      searchQuery: node.query,
      supports: [],
    });
  };

  // Interactions search grounding puts authoritative citations on model-output
  // text blocks. Preserve the exact cited segment before the generic walk.
  for (const step of raw?.steps ?? []) {
    if (step?.type !== 'model_output') continue;
    for (const item of step?.content ?? []) {
      if (item?.type !== 'text' || typeof item.text !== 'string') continue;
      for (const annotation of item.annotations ?? []) {
        if (annotation?.type !== 'url_citation') continue;
        const start = annotation.start_index ?? annotation.startIndex;
        const end = annotation.end_index ?? annotation.endIndex;
        const snippet = Number.isInteger(start) && Number.isInteger(end)
          ? item.text.slice(start, end)
          : undefined;
        addEvidence(annotation, snippet);
      }
    }
  }

  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'google_search_call') {
      const queries = node?.arguments?.queries;
      queryCount += Array.isArray(queries)
        ? queries.filter((query) => typeof query === 'string' && query.trim().length > 0).length
        : 1;
    }

    addEvidence(node);

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else walk(value);
    }
  };

  walk(raw);
  return { evidence, queryCount };
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  schema?: object,
  timeoutMs?: number,
): Promise<ApiCallResult> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      tools: [{ type: 'google_search' }],
      ...(schema ? {
        response_format: { type: 'text', mime_type: 'application/json', schema },
      } : {}),
    }),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const raw: any = await res.json();
  const text = extractOutputText(raw);
  if (!text) throw new Error('Gemini response contained no model text output');
  const extracted = extractEvidence(raw);

  return {
    raw,
    text,
    evidence: extracted.evidence,
    queryCount: extracted.queryCount,
    inputTokens: raw?.usage?.total_input_tokens ?? raw?.usage?.input_tokens ?? raw?.usageMetadata?.promptTokenCount,
    outputTokens: raw?.usage?.total_output_tokens ?? raw?.usage?.output_tokens ?? raw?.usageMetadata?.candidatesTokenCount,
  };
}

function mergeEvidence(...sets: Evidence[][]): Evidence[] {
  const byUrl = new Map<string, Evidence>();
  for (const item of sets.flat()) byUrl.set(item.sourceUrl, item);
  return [...byUrl.values()];
}

function needsRichEnrichment(entity: EntityEnrichment): boolean {
  const artistClassificationMissing = entity.entityType === 'artist' && !entity.artistProfile;
  return entity.facebook.searched !== true ||
    entity.facebook.status !== 'matched' ||
    !entity.facebook.url ||
    !entity.bio.text ||
    artistClassificationMissing;
}

function relevantToFreeEvents(item: EntityEnrichment, events: EventCandidate[]): boolean {
  const name = item.name.trim().toLowerCase();
  return events.some(event =>
    event.artistName.trim().toLowerCase() === name || event.venueName.trim().toLowerCase() === name
  );
}

function safeHttpsEvidenceUrl(value: string): string {
  const parsed = assertSafeUrl(value);
  if (parsed.protocol !== 'https:') throw new Error(`Grounded enrichment evidence must use HTTPS: ${value}`);
  return parsed.toString();
}

const groundingRedirectHost = 'vertexaisearch.cloud.google.com';
const groundingRedirectPath = '/grounding-api-redirect/';
const groundingRedirectHopCap = 3;

function isGoogleGroundingRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname.toLowerCase() === groundingRedirectHost
      && url.pathname.startsWith(groundingRedirectPath);
  } catch {
    return false;
  }
}

async function resolveGoogleGroundingRedirect(
  sourceUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ resolvedUrl?: string; fetches: number; reason?: string }> {
  if (!isGoogleGroundingRedirect(sourceUrl)) return { fetches: 0, reason: 'not a Google grounding redirect' };

  let currentUrl = safeHttpsEvidenceUrl(sourceUrl);
  let fetches = 0;
  try {
    for (let hop = 0; hop < groundingRedirectHopCap; hop += 1) {
      const response = await fetchImpl(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(5_000),
        headers: { range: 'bytes=0-0' },
      });
      fetches += 1;

      if (response.status < 300 || response.status >= 400) {
        return { fetches, reason: `grounding redirect returned HTTP ${response.status}` };
      }

      const location = response.headers.get('location');
      if (!location) return { fetches, reason: 'grounding redirect omitted Location' };
      const nextUrl = safeHttpsEvidenceUrl(new URL(location, currentUrl).toString());
      if (!isGoogleGroundingRedirect(nextUrl)) return { resolvedUrl: nextUrl, fetches };
      currentUrl = nextUrl;
    }
    return { fetches, reason: `grounding redirect exceeded ${groundingRedirectHopCap} hops` };
  } catch (error) {
    return {
      fetches,
      reason: error instanceof Error ? error.message : 'grounding redirect resolution failed',
    };
  }
}

export async function enrichTrustLoopEntityWithGemini(input: {
  entity: CanonicalEntitySnapshot;
  sourceId: string;
  sourceCandidateKey: string;
  requestedPredicates: ClaimPredicate[];
}, options: Pick<GeminiOptions, 'apiKey' | 'model'>): Promise<EnrichmentEvidenceBundle> {
  const startedAt = Date.now();
  const model = options.model ?? 'gemini-3.6-flash';
  const providerRunId = crypto.randomUUID();
  const requestedPredicates = [...new Set(input.requestedPredicates)];
  if (requestedPredicates.length === 0) throw new Error('Grounded enrichment requires requested predicates');

  const result = await callGemini(
    options.apiKey,
    model,
    buildTrustLoopEnrichmentPrompt({ ...input, requestedPredicates }),
    // Gemini search grounding emits url_citation annotations on normal text
    // output. Its structured-output mode may omit those annotations, so this
    // qualification path relies on prompt-shaped JSON plus strict Zod parsing.
    undefined,
    60_000,
  );
  const usage = groundedEnrichmentUsage(result, startedAt);
  let parsed: z.infer<typeof GroundedEnrichmentResponseSchema>;
  try {
    parsed = GroundedEnrichmentResponseSchema.parse(parseJsonModelOutput(result.text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const bundle = EnrichmentEvidenceBundleSchema.parse({
      providerId: 'gemini-grounded-v1',
      providerRunId,
      retrievedAt: new Date().toISOString(),
      identityConfidence: 0,
      facts: [],
      usage,
      raw: {
        model,
        captureError: `Provider response failed the Backline schema: ${message}`,
        responseText: result.text,
        evidence: result.evidence,
        rejectedFacts: [],
        citationMappings: [],
      },
    });
    throw new GroundedEnrichmentCaptureError(
      `Gemini grounded response failed the Backline schema: ${message}`,
      bundle,
      error,
    );
  }
  const capturedUrls = new Set(result.evidence.flatMap((item) => {
    try {
      return [safeHttpsEvidenceUrl(item.sourceUrl)];
    } catch {
      return [];
    }
  }));
  const rejectedFacts: Array<Record<string, unknown>> = [];
  const citationMappings: Array<Record<string, unknown>> = [];
  const redirectCache = new Map<string, Awaited<ReturnType<typeof resolveGoogleGroundingRedirect>>>();
  let citationResolutionFetches = 0;
  const facts: typeof parsed.facts = [];
  for (const fact of parsed.facts) {
    if (!requestedPredicates.includes(fact.predicate)) {
      rejectedFacts.push({
        fact,
        reason: `unrequested predicate: ${fact.predicate}`,
      });
      continue;
    }

    let evidenceUrls: string[];
    try {
      evidenceUrls = fact.evidenceUrls.map(safeHttpsEvidenceUrl);
    } catch (error) {
      rejectedFacts.push({
        fact,
        reason: error instanceof Error ? error.message : 'unsafe evidence URL',
      });
      continue;
    }

    const normalisedEvidenceUrls: string[] = [];
    for (const evidenceUrl of evidenceUrls) {
      if (capturedUrls.has(evidenceUrl)) {
        normalisedEvidenceUrls.push(evidenceUrl);
        continue;
      }

      if (!isGoogleGroundingRedirect(evidenceUrl)) {
        normalisedEvidenceUrls.push(evidenceUrl);
        continue;
      }

      let resolution = redirectCache.get(evidenceUrl);
      if (!resolution) {
        resolution = await resolveGoogleGroundingRedirect(evidenceUrl);
        redirectCache.set(evidenceUrl, resolution);
        citationResolutionFetches += resolution.fetches;
      }
      const mappedUrl = resolution.resolvedUrl && capturedUrls.has(resolution.resolvedUrl)
        ? resolution.resolvedUrl
        : evidenceUrl;
      citationMappings.push({
        sourceUrl: evidenceUrl,
        resolvedUrl: resolution.resolvedUrl,
        acceptedAs: mappedUrl === evidenceUrl ? undefined : mappedUrl,
        reason: resolution.reason,
      });
      normalisedEvidenceUrls.push(mappedUrl);
    }

    const uncapturedUrls = normalisedEvidenceUrls.filter((url) => !capturedUrls.has(url));
    if (uncapturedUrls.length > 0) {
      rejectedFacts.push({
        fact: { ...fact, evidenceUrls: normalisedEvidenceUrls },
        reason: `uncaptured citation: ${uncapturedUrls.join(', ')}`,
      });
      continue;
    }

    facts.push({ ...fact, evidenceUrls: normalisedEvidenceUrls });
  }
  return EnrichmentEvidenceBundleSchema.parse({
    providerId: 'gemini-grounded-v1',
    providerRunId,
    retrievedAt: new Date().toISOString(),
    identityConfidence: parsed.identityConfidence,
    facts,
    usage: { ...usage, fetches: citationResolutionFetches },
    raw: {
      model,
      identityReason: parsed.identityReason,
      response: parsed,
      evidence: result.evidence,
      rejectedFacts,
      citationMappings,
    },
  });
}

export async function discoverWithGemini(entity: SearchEntity, options: GeminiOptions): Promise<DiscoveryResult> {
  const started = Date.now();
  const model = options.model ?? 'gemini-3.6-flash';
  const horizonDays = options.horizonDays ?? 90;

  const primary = await callGemini(options.apiKey, model, buildDiscoveryPrompt(entity, horizonDays), responseSchema);
  const parsed = DiscoveryResponseSchema.parse(JSON.parse(primary.text));

  let entityEnrichment = parsed.entityEnrichment;
  let events = [...parsed.events];
  let discoveredEntities = [...parsed.discoveredEntities];
  let evidence = [...primary.evidence];
  let searchQueries = primary.queryCount;
  let inputTokens = primary.inputTokens ?? 0;
  let outputTokens = primary.outputTokens ?? 0;
  let admissionFollowUps = 0;
  let richEnrichmentFollowUps = 0;

  const unknownAdmission = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.admission.status === 'UNKNOWN');

  if (unknownAdmission.length) {
    const followUp = await callGemini(
      options.apiKey,
      model,
      buildAdmissionFollowUpPrompt(unknownAdmission.map(({ event }) => event)),
      admissionFollowUpResponseSchema,
    );
    const parsedFollowUp = AdmissionFollowUpSchema.parse(JSON.parse(followUp.text));

    for (const item of parsedFollowUp.results) {
      const original = unknownAdmission[item.index];
      if (!original) continue;
      events[original.index] = { ...events[original.index], admission: item.admission };
    }

    evidence = mergeEvidence(evidence, followUp.evidence);
    searchQueries += followUp.queryCount;
    inputTokens += followUp.inputTokens ?? 0;
    outputTokens += followUp.outputTokens ?? 0;
    admissionFollowUps++;
  }

  const eligibility = classifyEligibility(events, entity.type);
  const {
    publishable: publishableEvents,
    held: heldEvents,
    expansionEligible: expansionEligibleEvents,
  } = partitionEvents(events);
  const commercialEntities = commercialEntitySignals(events);

  // Rich Facebook/bio/site/classification enrichment is intentionally behind the FREE eligibility gate.
  // Paid events remain publishable, but never contribute targets here.
  if (eligibility.autoEnrich && expansionEligibleEvents.length) {
    const targets: Array<{ item: EntityEnrichment; target: 'subject' | 'discovered'; index: number }> = [];

    if (needsRichEnrichment(entityEnrichment)) {
      targets.push({ item: entityEnrichment, target: 'subject', index: -1 });
    }

    discoveredEntities.forEach((item, index) => {
      if (relevantToFreeEvents(item, expansionEligibleEvents) && needsRichEnrichment(item)) {
        targets.push({ item, target: 'discovered', index });
      }
    });

    if (targets.length) {
      const followUp = await callGemini(
        options.apiKey,
        model,
        buildEntityEnrichmentFollowUpPrompt(targets.map(({ item }) => item)),
        enrichmentFollowUpResponseSchema,
      );
      const parsedFollowUp = EnrichmentFollowUpSchema.parse(JSON.parse(followUp.text));

      for (const result of parsedFollowUp.results) {
        const original = targets[result.index];
        if (!original) continue;
        if (original.target === 'subject') entityEnrichment = result.enrichment;
        else discoveredEntities[original.index] = result.enrichment;
      }

      evidence = mergeEvidence(evidence, followUp.evidence);
      searchQueries += followUp.queryCount;
      inputTokens += followUp.inputTokens ?? 0;
      outputTokens += followUp.outputTokens ?? 0;
      richEnrichmentFollowUps++;
    }
  }

  return {
    runId: crypto.randomUUID(),
    entity,
    retrievedAt: new Date().toISOString(),
    identityConfidence: parsed.identityConfidence,
    entityEnrichment,
    discoveredEntities,
    events: publishableEvents,
    heldEvents,
    expansionEligibleEvents,
    commercialEntities,
    eligibility,
    evidence,
    metrics: {
      latencyMs: Date.now() - started,
      inputTokens: inputTokens || undefined,
      outputTokens: outputTokens || undefined,
      searchQueries,
      followUpSearches: admissionFollowUps + richEnrichmentFollowUps,
      admissionFollowUps,
      richEnrichmentFollowUps,
    },
  };
}
