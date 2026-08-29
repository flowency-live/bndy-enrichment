import { z } from 'zod';
import type {
  EnrichmentSearchClient,
  EnrichmentSearchResponse,
} from './search-model.js';

const GoogleSearchResponseSchema = z.object({
  items: z.array(z.object({
    title: z.string().default('Untitled search result'),
    link: z.string().url(),
    snippet: z.string().optional(),
  })).optional(),
});

export type GoogleProgrammableSearchOptions = {
  apiKey: string;
  engineId: string;
  id?: string;
  estimatedCostPerSearch?: number;
  fetchImpl?: typeof fetch;
};

function boundedText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const normalised = value.replaceAll(/\s+/g, ' ').trim();
  return normalised.length > maxLength ? normalised.slice(0, maxLength) : normalised;
}

/**
 * Explicit Google result capture for the split Trust Loop provider.
 *
 * This client performs one priced search request per call. It does not invoke
 * Gemini, follow result URLs or persist credentials in the returned evidence.
 */
export class GoogleProgrammableSearchClient implements EnrichmentSearchClient {
  readonly id: string;
  private readonly fetchImpl: typeof fetch;
  private readonly estimatedCostPerSearch: number;

  constructor(private readonly options: GoogleProgrammableSearchOptions) {
    if (!options.apiKey.trim()) throw new Error('Google Programmable Search API key is required');
    if (!options.engineId.trim()) throw new Error('Google Programmable Search engine ID is required');
    const estimatedCost = options.estimatedCostPerSearch ?? 0.005;
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      throw new Error('Google Programmable Search estimated cost must be non-negative');
    }
    this.id = options.id ?? 'google-programmable-search-v1';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.estimatedCostPerSearch = estimatedCost;
  }

  async search(query: string, options: { maxResults: number; deadlineMs: number }): Promise<EnrichmentSearchResponse> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) throw new Error('Google Programmable Search query is required');
    if (trimmedQuery.length > 1_024) throw new Error('Google Programmable Search query exceeds the safe length');
    const maxResults = Math.max(1, Math.min(Math.floor(options.maxResults), 10));
    const deadlineMs = Math.max(1, Math.floor(options.deadlineMs));
    const startedAt = Date.now();
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', this.options.apiKey);
    url.searchParams.set('cx', this.options.engineId);
    url.searchParams.set('q', trimmedQuery);
    url.searchParams.set('num', String(maxResults));
    url.searchParams.set('safe', 'active');
    url.searchParams.set('gl', 'uk');

    const response = await this.fetchImpl(url, {
      method: 'GET',
      signal: AbortSignal.timeout(deadlineMs),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new Error(`Google Programmable Search ${response.status}: ${body}`);
    }

    const parsed = GoogleSearchResponseSchema.parse(await response.json());
    return {
      results: (parsed.items ?? []).slice(0, maxResults).map((item) => ({
        title: boundedText(item.title, 300) ?? 'Untitled search result',
        url: item.link,
        snippet: boundedText(item.snippet, 1_000),
      })),
      usage: {
        estimatedCost: this.estimatedCostPerSearch,
        durationMs: Date.now() - startedAt,
      },
    };
  }
}
