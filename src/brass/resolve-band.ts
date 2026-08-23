import { z } from 'zod';
import type { BrassBandIdentityCandidate } from './types.js';

const ResolvedBandSchema = z.object({
  officialName: z.string().min(1),
  officialWebsite: z.string().url().optional(),
  town: z.string().optional(),
  county: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().default('United Kingdom'),
  aliases: z.array(z.object({
    name: z.string().min(1),
    type: z.enum(['former_official', 'common', 'sponsored', 'alternate']),
    confidence: z.number().min(0).max(1),
    evidenceUrls: z.array(z.string().url()),
  })).default([]),
  identityConfidence: z.number().min(0).max(1),
  evidenceUrls: z.array(z.string().url()).default([]),
  notes: z.string().optional(),
});

export type ResolvedBrassBand = z.infer<typeof ResolvedBandSchema>;

const responseSchema = {
  type: 'object',
  properties: {
    officialName: { type: 'string' },
    officialWebsite: { type: 'string' },
    town: { type: 'string' },
    county: { type: 'string' },
    postcode: { type: 'string' },
    country: { type: 'string' },
    aliases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['former_official', 'common', 'sponsored', 'alternate'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          evidenceUrls: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'type', 'confidence', 'evidenceUrls'],
      },
    },
    identityConfidence: { type: 'number', minimum: 0, maximum: 1 },
    evidenceUrls: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['officialName', 'country', 'aliases', 'identityConfidence', 'evidenceUrls'],
};

function outputText(raw: any): string | undefined {
  if (typeof raw?.output_text === 'string') return raw.output_text;
  if (typeof raw?.outputText === 'string') return raw.outputText;
  const texts: string[] = [];
  for (const step of raw?.steps ?? []) {
    if (step?.type !== 'model_output') continue;
    for (const item of step?.content ?? []) if (item?.type === 'text' && typeof item.text === 'string') texts.push(item.text);
  }
  return texts.at(-1);
}

function prompt(candidate: BrassBandIdentityCandidate): string {
  const observations = candidate.observations.slice(0, 12).map((observation) =>
    `- ${observation.year} ${observation.region ?? 'UK'}: "${observation.observedName}" (${observation.sourceUrl})`
  ).join('\n');
  return `You are resolving the canonical identity of a UK brass band for bndy Brass.\n\nObserved contest identity:\n${candidate.canonicalName}\n\nEvidence observations:\n${observations}\n\nUse Google Search. Prefer the band's own current official website, then official association/contest sources. Determine the current official name, official website, home town/base, county and postcode where confidently supported. Identify former sponsored/official names and common names ONLY when sources support that they are the same continuing band. Do not merge similarly named different bands. Do not infer a permanent musical director. Do not return section/ranking as a permanent property. Evidence URLs must support the identity claims. If uncertain, keep identityConfidence below 0.85 and explain briefly in notes.`;
}

export async function resolveBrassBandIdentity(candidate: BrassBandIdentityCandidate, options: { apiKey: string; model?: string }): Promise<ResolvedBrassBand> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': options.apiKey },
    body: JSON.stringify({
      model: options.model ?? 'gemini-3.6-flash',
      input: prompt(candidate),
      tools: [{ type: 'google_search' }],
      response_format: { type: 'text', mime_type: 'application/json', schema: responseSchema },
    }),
  });
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`);
  const raw = await response.json();
  const text = outputText(raw);
  if (!text) throw new Error('Gemini identity resolution returned no model output');
  return ResolvedBandSchema.parse(JSON.parse(text));
}
