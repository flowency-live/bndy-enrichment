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

const groundedEnrichmentResponseSchema = {
  type: 'object',
  properties: {
    identityConfidence: { type: 'number', minimum: 0, maximum: 1 },
    identityReason: { type: 'string' },
    facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          predicate: { type: 'string', enum: ClaimPredicateSchema.options },
          value: { type: ['string', 'boolean'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          evidenceUrls: { type: 'array', items: { type: 'string' } },
          evidenceText: { type: 'string' },
        },
        required: ['predicate', 'value', 'confidence', 'evidenceUrls'],
      },
    },
  },
  required: ['identityConfidence', 'identityReason', 'facts'],
};

interface ApiCallResult {
  raw: any;
  text: string;
  evidence: Evidence[];
  queryCount: number;
  inputTokens?: number;
  outputTokens?: number;
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

function extractEvidence(raw: any): { evidence: Evidence[]; queryCount: number } {
  const evidence: Evidence[] = [];
  let queryCount = 0;
  const seen = new Set<string>();

  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'google_search_call') {
      const queries = node?.arguments?.queries;
      queryCount += Array.isArray(queries) ? queries.length : 1;
    }

    const url = node.url ?? node.uri ?? node?.source?.url;
    if (typeof url === 'string' && /^https?:\/\//.test(url) && !seen.has(url)) {
      seen.add(url);
      evidence.push({
        id: `ev_${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}`,
        sourceUrl: url,
        sourceDomain: new URL(url).hostname,
        title: node.title,
        snippet: node.snippet,
        searchQuery: node.query,
        supports: [],
      });
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else walk(value);
    }
  };

  walk(raw);
  return { evidence, queryCount };
}

async function callGemini(apiKey: string, model: string, prompt: string, schema: object): Promise<ApiCallResult> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      tools: [{ type: 'google_search' }],
      response_format: { type: 'text', mime_type: 'application/json', schema },
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

export async function enrichTrustLoopEntityWithGemini(input: {
  entity: CanonicalEntitySnapshot;
  sourceId: string;
  sourceCandidateKey: string;
  requestedPredicates: ClaimPredicate[];
}, options: Pick<GeminiOptions, 'apiKey' | 'model'>): Promise<EnrichmentEvidenceBundle> {
  const startedAt = Date.now();
  const model = options.model ?? 'gemini-3.6-flash';
  const requestedPredicates = [...new Set(input.requestedPredicates)];
  if (requestedPredicates.length === 0) throw new Error('Grounded enrichment requires requested predicates');

  const result = await callGemini(
    options.apiKey,
    model,
    buildTrustLoopEnrichmentPrompt({ ...input, requestedPredicates }),
    groundedEnrichmentResponseSchema,
  );
  const parsed = GroundedEnrichmentResponseSchema.parse(JSON.parse(result.text));
  const capturedUrls = new Set(result.evidence.map((item) => safeHttpsEvidenceUrl(item.sourceUrl)));
  const facts = parsed.facts.map((fact) => {
    if (!requestedPredicates.includes(fact.predicate)) {
      throw new Error(`Grounded enrichment returned unrequested predicate: ${fact.predicate}`);
    }
    const evidenceUrls = fact.evidenceUrls.map(safeHttpsEvidenceUrl);
    for (const url of evidenceUrls) {
      if (!capturedUrls.has(url)) throw new Error(`Grounded enrichment returned uncaptured citation: ${url}`);
    }
    return { ...fact, evidenceUrls };
  });
  const inputTokens = result.inputTokens ?? 0;
  const outputTokens = result.outputTokens ?? 0;
  // Conservative post-free-pool estimate: Gemini 3.6 Flash standard tokens plus
  // Google Search grounding. Qualification records the estimate but performs no billing action.
  const estimatedCost = (inputTokens * 0.75 / 1_000_000)
    + (outputTokens * 3.75 / 1_000_000)
    + (result.queryCount * 0.014);

  return EnrichmentEvidenceBundleSchema.parse({
    providerId: 'gemini-grounded-v1',
    providerRunId: crypto.randomUUID(),
    retrievedAt: new Date().toISOString(),
    identityConfidence: parsed.identityConfidence,
    facts,
    usage: {
      searches: result.queryCount,
      fetches: 0,
      modelCalls: 1,
      inputTokens,
      outputTokens,
      estimatedCost,
      durationMs: Date.now() - startedAt,
    },
    raw: {
      model,
      identityReason: parsed.identityReason,
      response: parsed,
      evidence: result.evidence,
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
