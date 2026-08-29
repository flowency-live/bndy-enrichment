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

const IdentityLineSchema = z.object({
  identityConfidence: z.number().min(0).max(1),
  identityReason: z.string().min(1).max(2_000),
});

const FactLineSchema = z.object({
  predicate: ClaimPredicateSchema,
  value: z.union([z.string(), z.boolean()]),
  confidence: z.number().min(0).max(1),
  evidenceText: z.string().min(1).max(2_000),
});

interface TextRange {
  start: number;
  end: number;
}

interface CitationRange extends TextRange {
  url: string;
  title?: string;
}

interface ParsedFactLine extends z.infer<typeof FactLineSchema> {
  segment: TextRange;
  rawSegment: string;
}

interface InteractionResult {
  raw: any;
  text: string;
  citations: CitationRange[];
  queryCount: number;
  inputTokens: number;
  outputTokens: number;
}

function buildEvidenceFirstPrompt(input: {
  entity: CanonicalEntitySnapshot;
  sourceId: string;
  sourceCandidateKey: string;
  requestedPredicates: ClaimPredicate[];
}): string {
  return `Perform one evidence-first Google Search grounding pass for this exact Backline entity.

ENTITY
${JSON.stringify({
    entityType: input.entity.entityType,
    displayName: input.entity.displayName,
    sourceId: input.sourceId,
    sourceCandidateKey: input.sourceCandidateKey,
    currentValues: input.entity.currentValues,
  }, null, 2)}

REQUESTED PREDICATES
${JSON.stringify(input.requestedPredicates)}

SEARCH AND IDENTITY RULES
- Invoke the supplied Google Search tool before returning facts.
- Use one or two focused, non-empty search queries. Do not widen beyond two requested queries.
- Establish that evidence belongs to this exact entity. Name similarity alone is insufficient.
- Same-name artists and generic venue names are hard negatives.
- Abstain when locality, official ownership or a known gig footprint cannot establish identity.
- Do not answer from memory.

FACT RULES
- Return only requested predicates.
- Return only facts directly supported by the live search evidence.
- Do not include evidence URLs in the text. Provider url_citation annotations are the only admissible URLs.
- Artist types: Band, Solo Act, Duo, Trio, Group, DJ, Collective.
- Act types: Originals, Covers, Tribute Act. Return one fact per value.
- Genres: Rock, Rock n Roll, Grunge, Metal, Punk, Alternative, New Wave, Pop, Indie, Britpop, Mod, Blues, R&B, Country, Americana, Folk, Soul, Funk, Motown, Electronic, Dance, Jazz, Classical, Reggae, Latin, Other.
- isAcoustic is boolean and requires positive evidence for true or clear contrary evidence for false.
- If identity is unsafe, return identity confidence below 0.5 and no FACT lines.

EXACT PLAIN-TEXT CONTRACT
- Return one IDENTITY line followed by zero or more FACT lines.
- Use literal TAB characters between fields. Do not use spaces instead of tabs.
- Do not return Markdown, headings, bullets, commentary, blank prose or JSON objects.
- JSON-encode every quoted string field so tabs, newlines and quotes remain escaped on one line.
- IDENTITY format:
IDENTITY<TAB>confidence-number<TAB>"identity reason"
- FACT format:
FACT<TAB>"predicate"<TAB>"string value" or boolean<TAB>confidence-number<TAB>"short evidence statement"
- Attach the provider url_citation for each fact to that exact FACT line. A citation elsewhere will not admit the fact.

Valid shape example:
IDENTITY\t0.99\t"The official venue page and matching Oldham address establish the exact entity."
FACT\t"hasAddress"\t"Example address"\t0.99\t"The official venue page states this address."

Abstention example:
IDENTITY\t0.2\t"Search evidence cannot distinguish the entity safely."`;
}

function safeHttpsUrl(value: string): string {
  const parsed = assertSafeUrl(value);
  if (parsed.protocol !== 'https:') throw new Error(`Citation evidence must use HTTPS: ${value}`);
  return parsed.toString();
}

function citationEndsInSegment(citation: TextRange, segment: TextRange): boolean {
  // Interactions currently emits cumulative citation ranges whose start may be
  // zero while the end lands on the supported fact. Bind by the end offset so
  // a later citation cannot leak backwards into earlier FACT lines.
  return citation.end > segment.start && citation.end <= segment.end;
}

function modelTextBlock(raw: any): { text: string; annotations: any[] } | undefined {
  const blocks: Array<{ text: string; annotations: any[] }> = [];
  for (const step of raw?.steps ?? []) {
    if (step?.type !== 'model_output') continue;
    for (const item of step?.content ?? []) {
      if (item?.type !== 'text' || typeof item.text !== 'string') continue;
      blocks.push({ text: item.text, annotations: Array.isArray(item.annotations) ? item.annotations : [] });
    }
  }
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (/^IDENTITY\t/m.test(blocks[index].text)) return blocks[index];
  }
  return blocks.at(-1);
}

function countSearchQueries(raw: any): number {
  let count = 0;
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'google_search_call') {
      const queries = node?.arguments?.queries;
      count += Array.isArray(queries)
        ? queries.filter((query) => typeof query === 'string' && query.trim().length > 0).length
        : 1;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else walk(value);
    }
  };
  walk(raw);
  return count;
}

function extractCitations(text: string, annotations: any[]): CitationRange[] {
  return annotations.flatMap((annotation): CitationRange[] => {
    if (annotation?.type !== 'url_citation' || typeof annotation.url !== 'string') return [];
    const start = annotation.start_index ?? annotation.startIndex;
    const end = annotation.end_index ?? annotation.endIndex;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length) {
      return [];
    }
    try {
      return [{
        start,
        end,
        url: safeHttpsUrl(annotation.url),
        ...(typeof annotation.title === 'string' ? { title: annotation.title } : {}),
      }];
    } catch {
      return [];
    }
  });
}

function parseQuotedString(value: string, label: string): string {
  const parsed = JSON.parse(value);
  if (typeof parsed !== 'string') throw new Error(`${label} must be a JSON-encoded string`);
  return parsed;
}

function parsePlainText(text: string): {
  identity: z.infer<typeof IdentityLineSchema>;
  facts: ParsedFactLine[];
} {
  let identity: z.infer<typeof IdentityLineSchema> | undefined;
  const facts: ParsedFactLine[] = [];
  const linePattern = /[^\r\n]+/g;
  let match: RegExpExecArray | null;
  while ((match = linePattern.exec(text)) !== null) {
    const rawSegment = match[0];
    const fields = rawSegment.split('\t');
    if (fields[0] === 'IDENTITY') {
      if (identity || fields.length !== 3) throw new Error('Plain-text response has an invalid IDENTITY line');
      identity = IdentityLineSchema.parse({
        identityConfidence: Number(fields[1]),
        identityReason: parseQuotedString(fields[2], 'identity reason'),
      });
      continue;
    }
    if (fields[0] === 'FACT') {
      if (fields.length !== 5) throw new Error('Plain-text response has an invalid FACT line');
      const value = JSON.parse(fields[2]);
      const parsed = FactLineSchema.parse({
        predicate: parseQuotedString(fields[1], 'predicate'),
        value,
        confidence: Number(fields[3]),
        evidenceText: parseQuotedString(fields[4], 'evidence text'),
      });
      facts.push({
        ...parsed,
        rawSegment,
        segment: { start: match.index, end: match.index + rawSegment.length },
      });
      continue;
    }
    throw new Error(`Plain-text response contains an unrecognised line: ${rawSegment.slice(0, 80)}`);
  }
  if (!identity) throw new Error('Plain-text response contains no IDENTITY line');
  return { identity, facts };
}

async function callInteractions(
  apiKey: string,
  model: string,
  prompt: string,
  timeoutMs: number,
): Promise<InteractionResult> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      store: false,
      tools: [{ type: 'google_search' }],
    }),
  });
  if (!response.ok) throw new Error(`Gemini Interactions ${response.status}: ${await response.text()}`);
  const raw: any = await response.json();
  const block = modelTextBlock(raw);
  const text = block?.text
    ?? (typeof raw?.output_text === 'string' ? raw.output_text : undefined)
    ?? (typeof raw?.outputText === 'string' ? raw.outputText : undefined);
  if (!text) throw new Error('Gemini Interactions response contained no model text output');
  return {
    raw,
    text,
    citations: extractCitations(text, block?.annotations ?? []),
    queryCount: countSearchQueries(raw),
    inputTokens: raw?.usage?.total_input_tokens ?? raw?.usage?.input_tokens ?? 0,
    outputTokens: raw?.usage?.total_output_tokens ?? raw?.usage?.output_tokens ?? 0,
  };
}

function usage(result: InteractionResult, startedAt: number) {
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

function evidenceFromCitations(citations: CitationRange[], text: string): Evidence[] {
  const byUrl = new Map<string, Evidence>();
  for (const citation of citations) {
    if (byUrl.has(citation.url)) continue;
    byUrl.set(citation.url, {
      id: `ev_${crypto.createHash('sha1').update(citation.url).digest('hex').slice(0, 12)}`,
      sourceUrl: citation.url,
      sourceDomain: new URL(citation.url).hostname,
      title: citation.title,
      snippet: text.slice(citation.start, citation.end),
      supports: [],
    });
  }
  return [...byUrl.values()];
}

function failureBundle(
  providerRunId: string,
  model: string,
  result: InteractionResult,
  startedAt: number,
  captureError: string,
): EnrichmentEvidenceBundle {
  return EnrichmentEvidenceBundleSchema.parse({
    providerId: 'gemini-interactions-evidence-first-v1',
    providerRunId,
    retrievedAt: new Date().toISOString(),
    identityConfidence: 0,
    facts: [],
    usage: usage(result, startedAt),
    raw: {
      model,
      transport: 'interactions',
      outputContract: 'tab-delimited-evidence-first-v1',
      captureError,
      responseText: result.text,
      queryCount: result.queryCount,
      citationCount: result.citations.length,
      citations: result.citations,
      evidence: evidenceFromCitations(result.citations, result.text),
      providerResponse: result.raw,
      rejectedFacts: [],
    },
  });
}

export async function enrichTrustLoopEntityWithGeminiInteractionsEvidenceFirst(input: {
  entity: CanonicalEntitySnapshot;
  sourceId: string;
  sourceCandidateKey: string;
  requestedPredicates: ClaimPredicate[];
}, options: { apiKey: string; model?: string }): Promise<EnrichmentEvidenceBundle> {
  const startedAt = Date.now();
  const model = options.model ?? 'gemini-3.6-flash';
  const providerRunId = crypto.randomUUID();
  const requestedPredicates = [...new Set(input.requestedPredicates)];
  if (requestedPredicates.length === 0) throw new Error('Evidence-first grounding requires requested predicates');

  const result = await callInteractions(
    options.apiKey,
    model,
    buildEvidenceFirstPrompt({ ...input, requestedPredicates }),
    60_000,
  );
  if (result.queryCount < 1 || result.queryCount > 2) {
    const message = `Gemini Interactions evidence-first failed closed: observed ${result.queryCount} Google Search queries, expected one or two`;
    throw new GroundedEnrichmentCaptureError(
      message,
      failureBundle(providerRunId, model, result, startedAt, message),
    );
  }

  let parsed: ReturnType<typeof parsePlainText>;
  try {
    parsed = parsePlainText(result.text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Gemini Interactions evidence-first output failed the plain-text contract: ${detail}`;
    throw new GroundedEnrichmentCaptureError(
      message,
      failureBundle(providerRunId, model, result, startedAt, message),
      error,
    );
  }

  const rejectedFacts: Array<Record<string, unknown>> = [];
  const facts = parsed.facts.flatMap((fact) => {
    if (!requestedPredicates.includes(fact.predicate)) {
      rejectedFacts.push({ fact, reason: `unrequested predicate: ${fact.predicate}` });
      return [];
    }
    const supportingCitations = result.citations
      .filter((citation) => citationEndsInSegment(citation, fact.segment));
    if (supportingCitations.length === 0) {
      rejectedFacts.push({
        fact,
        reason: 'no provider url_citation ends within the exact FACT output segment',
      });
      return [];
    }
    return [{
      predicate: fact.predicate,
      value: fact.value,
      confidence: fact.confidence,
      evidenceUrls: [...new Set(supportingCitations.map((citation) => citation.url))],
      evidenceText: fact.evidenceText,
    }];
  });

  return EnrichmentEvidenceBundleSchema.parse({
    providerId: 'gemini-interactions-evidence-first-v1',
    providerRunId,
    retrievedAt: new Date().toISOString(),
    identityConfidence: facts.length > 0 ? parsed.identity.identityConfidence : 0,
    facts,
    usage: usage(result, startedAt),
    raw: {
      model,
      transport: 'interactions',
      outputContract: 'tab-delimited-evidence-first-v1',
      identityReason: parsed.identity.identityReason,
      rawIdentityConfidence: parsed.identity.identityConfidence,
      responseText: result.text,
      queryCount: result.queryCount,
      citationCount: result.citations.length,
      citations: result.citations,
      evidence: evidenceFromCitations(result.citations, result.text),
      providerResponse: result.raw,
      rejectedFacts,
      admittedFactSegments: parsed.facts
        .filter((fact) => result.citations
          .some((citation) => citationEndsInSegment(citation, fact.segment)))
        .map((fact) => ({ predicate: fact.predicate, segment: fact.segment, text: fact.rawSegment })),
    },
  });
}
