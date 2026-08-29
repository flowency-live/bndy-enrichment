import { z } from 'zod';
import type {
  EnrichmentSearchClient,
  EnrichmentSearchResponse,
} from './search-model.js';

const SerpApiGoogleResponseSchema = z.object({
  organic_results: z.array(z.object({
    title: z.string().default('Untitled search result'),
    link: z.string().url(),
    snippet: z.string().optional(),
  })).optional(),
  error: z.string().optional(),
});

export type SerpApiGoogleSearchOptions = {
  apiKey: string;
  id?: string;
  estimatedCostPerSearch?: number;
  location?: string;
  fetchImpl?: typeof fetch;
};

function boundedText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const normalised = value.replaceAll(/\s+/g, ' ').trim();
  return normalised.length > maxLength ? normalised.slice(0, maxLength) : normalised;
}

/**
 * Explicit Google result capture through SerpAPI.
 *
 * SerpAPI executes a normal Google search and returns the organic result URLs
 * and snippets as JSON. This client performs no model call, follows no result
 * URL and never includes its credential in returned evidence.
 */
export class SerpApiGoogleSearchClient implements EnrichmentSearchClient {
  readonly id: string;
  private readonly fetchImpl: typeof fetch;
  private readonly estimatedCostPerSearch: number;
  private readonly location: string;

  constructor(private readonly options: SerpApiGoogleSearchOptions) {
    if (!options.apiKey.trim()) throw new Error('SerpAPI key is required');
    const estimatedCost = options.estimatedCostPerSearch ?? 0;
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
      throw new Error('SerpAPI Google Search estimated cost must be non-negative');
    }
    this.id = options.id ?? 'serpapi-google-search-v1';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.estimatedCostPerSearch = estimatedCost;
    this.location = options.location?.trim() || 'United Kingdom';
  }

  async search(query: string, options: { maxResults: number; deadlineMs: number }): Promise<EnrichmentSearchResponse> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) throw new Error('SerpAPI Google Search query is required');
    if (trimmedQuery.length > 1_024) throw new Error('SerpAPI Google Search query exceeds the safe length');
    const maxResults = Math.max(1, Math.min(Math.floor(options.maxResults), 10));
    const deadlineMs = Math.max(1, Math.floor(options.deadlineMs));
    const startedAt = Date.now();
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('api_key', this.options.apiKey);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', trimmedQuery);
    url.searchParams.set('location', this.location);
    url.searchParams.set('google_domain', 'google.co.uk');
    url.searchParams.set('gl', 'uk');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('num', String(maxResults));
    url.searchParams.set('safe', 'active');
    url.searchParams.set('output', 'json');

    const response = await this.fetchImpl(url, {
      method: 'GET',
      signal: AbortSignal.timeout(deadlineMs),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new Error(`SerpAPI Google Search ${response.status}: ${body}`);
    }

    const parsed = SerpApiGoogleResponseSchema.parse(await response.json());
    if (parsed.error) throw new Error(`SerpAPI Google Search error: ${parsed.error.slice(0, 500)}`);
    return {
      results: (parsed.organic_results ?? [])
        .filter((item) => item.link.startsWith('https://'))
        .slice(0, maxResults)
        .map((item) => ({
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
