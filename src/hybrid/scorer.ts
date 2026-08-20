/**
 * Claude Haiku confidence scorer for validating Facebook page matches.
 * Cost: ~$0.00025 per validation (Haiku input: $0.25/M, output: $1.25/M)
 *
 * Given search results and a candidate Facebook URL, determines if
 * the page belongs to the artist we're searching for.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { OrganicResult } from '../serpapi/client.js';

export interface ScorerOptions {
  apiKey: string;
  model?: string;
}

const ValidationResultSchema = z.object({
  isMatch: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  extractedBio: z.string().optional(),
  genres: z.array(z.string()).optional(),
  artistType: z.string().optional(),
  actTypes: z.array(z.string()).optional(),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

const VALIDATION_PROMPT = `You are validating whether a Facebook page belongs to a specific grassroots music artist/band.

Artist to find:
- Name: {{NAME}}
- Location: {{LOCATION}}

Candidate Facebook URL: {{FB_URL}}

Search results context:
{{SEARCH_RESULTS}}

Analyze the search results to determine if this Facebook page belongs to the artist we're looking for.

Consider:
1. Does the page name match or closely match the artist name?
2. Is the location consistent (UK grassroots music scene)?
3. Do search snippets mention music, gigs, performances?
4. Are there any red flags (wrong country, different entity, business page, etc.)?

Respond with JSON only:
{
  "isMatch": boolean,
  "confidence": number (0.0-1.0),
  "reason": "brief explanation",
  "extractedBio": "any bio/description found in snippets (optional)",
  "genres": ["genre1", "genre2"] (if mentioned in snippets),
  "artistType": "Band|Solo Act|Duo|etc" (if determinable),
  "actTypes": ["Originals"|"Covers"|"Tribute Act"] (if determinable)
}`;

export async function validateFacebookMatch(
  artistName: string,
  town: string | undefined,
  candidateFbUrl: string,
  searchResults: OrganicResult[],
  options: ScorerOptions
): Promise<ValidationResult> {
  const client = new Anthropic({ apiKey: options.apiKey });

  const resultsContext = searchResults
    .slice(0, 8) // Limit context
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.link}\n   ${r.snippet ?? ''}`)
    .join('\n\n');

  const prompt = VALIDATION_PROMPT
    .replace('{{NAME}}', artistName)
    .replace('{{LOCATION}}', town ?? 'UK')
    .replace('{{FB_URL}}', candidateFbUrl)
    .replace('{{SEARCH_RESULTS}}', resultsContext);

  const response = await client.messages.create({
    model: options.model ?? 'claude-3-5-haiku-latest',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Haiku');
  }

  // Extract JSON from response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      isMatch: false,
      confidence: 0,
      reason: 'Failed to parse Haiku response',
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return ValidationResultSchema.parse(parsed);
  } catch (err) {
    return {
      isMatch: false,
      confidence: 0,
      reason: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

const ENRICHMENT_PROMPT = `Extract enrichment data for a grassroots music artist from these search results.

Artist: {{NAME}}
Location: {{LOCATION}}

Search results:
{{SEARCH_RESULTS}}

Extract whatever information you can find. Respond with JSON only:
{
  "bio": "brief bio/description if found (max 280 chars)",
  "genres": ["genre1", "genre2"],
  "artistType": "Band|Solo Act|Duo|Trio|Group|DJ|Collective",
  "actTypes": ["Originals", "Covers", "Tribute Act"],
  "confidence": number (0.0-1.0 based on how sure you are this is the right artist),
  "notes": "any relevant observations"
}

Valid genres: Rock, Rock n Roll, Grunge, Metal, Punk, Alternative, New Wave, Pop, Indie, Britpop, Mod, Blues, R&B, Country, Americana, Folk, Soul, Funk, Motown, Electronic, Dance, Jazz, Classical, Reggae, Latin, Other

Only include fields you have evidence for. If unsure, omit.`;

const EnrichmentResultSchema = z.object({
  bio: z.string().optional(),
  genres: z.array(z.string()).optional(),
  artistType: z.string().optional(),
  actTypes: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  notes: z.string().optional(),
});

export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

export async function extractEnrichment(
  artistName: string,
  town: string | undefined,
  searchResults: OrganicResult[],
  options: ScorerOptions
): Promise<EnrichmentResult> {
  const client = new Anthropic({ apiKey: options.apiKey });

  const resultsContext = searchResults
    .slice(0, 10)
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.link}\n   ${r.snippet ?? ''}`)
    .join('\n\n');

  const prompt = ENRICHMENT_PROMPT
    .replace('{{NAME}}', artistName)
    .replace('{{LOCATION}}', town ?? 'UK')
    .replace('{{SEARCH_RESULTS}}', resultsContext);

  const response = await client.messages.create({
    model: options.model ?? 'claude-3-5-haiku-latest',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Haiku');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { confidence: 0 };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return EnrichmentResultSchema.parse(parsed);
  } catch {
    return { confidence: 0 };
  }
}
