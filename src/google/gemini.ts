import crypto from 'node:crypto';
import { DiscoveryResponseSchema, type DiscoveryResult, type Evidence, type SearchEntity } from '../domain/schema.js';
import { buildDiscoveryPrompt } from './prompt.js';

export interface GeminiOptions {
  apiKey: string;
  model?: string;
  horizonDays?: number;
}

const responseSchema = {
  type: 'object',
  properties: {
    identityConfidence: { type: 'number', minimum: 0, maximum: 1 },
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
          notes: { type: ['string', 'null'] },
        },
        required: ['artistName', 'venueName', 'eventDate', 'timezone', 'cancelled', 'confidence', 'sourceUrls'],
      },
    },
  },
  required: ['identityConfidence', 'events'],
};

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
      const id = `ev_${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}`;
      evidence.push({
        id,
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

export async function discoverWithGemini(entity: SearchEntity, options: GeminiOptions): Promise<DiscoveryResult> {
  const started = Date.now();
  const model = options.model ?? 'gemini-3.6-flash';
  const horizonDays = options.horizonDays ?? 90;

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': options.apiKey,
    },
    body: JSON.stringify({
      model,
      input: buildDiscoveryPrompt(entity, horizonDays),
      tools: [{ type: 'google_search' }],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: responseSchema,
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const raw: any = await res.json();
  const text = extractOutputText(raw);
  if (!text) throw new Error('Gemini response contained no model text output');

  const parsed = DiscoveryResponseSchema.parse(JSON.parse(text));
  const extracted = extractEvidence(raw);

  return {
    runId: crypto.randomUUID(),
    entity,
    retrievedAt: new Date().toISOString(),
    events: parsed.events,
    evidence: extracted.evidence,
    metrics: {
      latencyMs: Date.now() - started,
      inputTokens: raw?.usage?.total_input_tokens ?? raw?.usage?.input_tokens ?? raw?.usageMetadata?.promptTokenCount,
      outputTokens: raw?.usage?.total_output_tokens ?? raw?.usage?.output_tokens ?? raw?.usageMetadata?.candidatesTokenCount,
      searchQueries: extracted.queryCount,
    },
  };
}
