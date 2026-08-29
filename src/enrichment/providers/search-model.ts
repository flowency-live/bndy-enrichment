import type { DiscoveryBudget, EntityEnrichmentWorkItem } from '../../knowledge/types.js';
import { assertSafeUrl } from '../../sources/runner/acquisition.js';
import type { EntityEnrichmentProvider } from '../processor.js';
import {
  EnrichmentEvidenceBundleSchema,
  type CanonicalEntitySnapshot,
  type EnrichmentEvidenceBundle,
  type EnrichmentEvidenceFact,
} from '../types.js';

export type EnrichmentSearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

export type EnrichmentSearchResponse = {
  results: EnrichmentSearchResult[];
  usage: {
    estimatedCost: number;
    durationMs: number;
  };
};

export interface EnrichmentSearchClient {
  readonly id: string;
  search(query: string, options: { maxResults: number; deadlineMs: number }): Promise<EnrichmentSearchResponse>;
}

export type EnrichmentReasonerResult = {
  providerRunId: string;
  retrievedAt: string;
  identityConfidence: number;
  facts: EnrichmentEvidenceFact[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    durationMs: number;
  };
  raw: unknown;
};

export interface EnrichmentReasoner {
  readonly id: string;
  analyse(input: {
    entity: CanonicalEntitySnapshot;
    requestedPredicates: NonNullable<EntityEnrichmentWorkItem['requestedPredicates']>;
    searches: Array<{ query: string; results: EnrichmentSearchResult[] }>;
    budget: Pick<DiscoveryBudget, 'maxInputTokens' | 'maxOutputTokens' | 'maxEstimatedCost' | 'deadlineMs'>;
  }): Promise<EnrichmentReasonerResult>;
}

export type SearchModelEnrichmentProviderOptions = {
  id: string;
  maxResultsPerSearch?: number;
};

export class EnrichmentReasonerCaptureError extends Error {
  readonly result: EnrichmentReasonerResult;

  constructor(message: string, result: EnrichmentReasonerResult, cause?: unknown) {
    super(message, { cause });
    this.name = 'EnrichmentReasonerCaptureError';
    this.result = result;
  }
}

export class SearchModelEnrichmentCaptureError extends Error {
  readonly bundle: EnrichmentEvidenceBundle;

  constructor(message: string, bundle: EnrichmentEvidenceBundle, cause?: unknown) {
    super(message, { cause });
    this.name = 'SearchModelEnrichmentCaptureError';
    this.bundle = bundle;
  }
}

function safeHttpsUrl(value: string): string {
  const url = assertSafeUrl(value);
  if (url.protocol !== 'https:') throw new Error('Enrichment search evidence must use HTTPS');
  return url.toString();
}

function locationHint(entity: CanonicalEntitySnapshot): string | undefined {
  for (const predicate of ['hasLocation', 'locatedIn', 'hasAddress']) {
    const value = entity.currentValues[predicate];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function quote(value: string): string {
  return `"${value.replaceAll('"', ' ').replaceAll(/\s+/g, ' ').trim()}"`;
}

export function buildEnrichmentQueries(entity: CanonicalEntitySnapshot): string[] {
  const location = locationHint(entity);
  const identity = [quote(entity.displayName), location ? quote(location) : undefined]
    .filter(Boolean)
    .join(' ');
  const context = entity.entityType === 'artist' ? 'music artist band official' : 'live music venue official';
  return [
    `${identity} ${context}`,
    `${identity} music site:facebook.com OR site:instagram.com`,
  ];
}

function assertWithinBudget(bundle: EnrichmentEvidenceBundle, budget: DiscoveryBudget): void {
  const usage = bundle.usage;
  if (!usage) throw new Error('Enrichment provider usage is required');
  if (usage.searches > budget.maxSearches
    || usage.fetches > budget.maxFetches
    || usage.modelCalls > budget.maxModelCalls
    || usage.inputTokens > budget.maxInputTokens
    || usage.outputTokens > budget.maxOutputTokens
    || usage.estimatedCost > budget.maxEstimatedCost
    || usage.durationMs > budget.deadlineMs) {
    throw new Error('Enrichment provider exceeded the reserved per-item budget');
  }
}

function assertMeasuredSearchUsage(usage: EnrichmentSearchResponse['usage']): void {
  if (!usage
    || !Number.isFinite(usage.estimatedCost)
    || usage.estimatedCost < 0
    || !Number.isFinite(usage.durationMs)
    || usage.durationMs < 0) {
    throw new Error('Enrichment search client must report complete non-negative usage');
  }
}

/**
 * Provider-neutral, inactive search plus one-model-call orchestration.
 *
 * Concrete search/model credentials are deliberately outside this class. The
 * provider returns evidence only and is not wired to a Lambda or schedule.
 */
export class SearchModelEnrichmentProvider implements EntityEnrichmentProvider {
  readonly id: string;
  private readonly maxResultsPerSearch: number;

  constructor(
    private readonly searchClient: EnrichmentSearchClient,
    private readonly reasoner: EnrichmentReasoner,
    options: SearchModelEnrichmentProviderOptions,
  ) {
    this.id = options.id;
    this.maxResultsPerSearch = Math.max(1, Math.min(options.maxResultsPerSearch ?? 5, 10));
  }

  async gather(
    entity: CanonicalEntitySnapshot,
    budget: DiscoveryBudget,
    rawRequestedPredicates: EntityEnrichmentWorkItem['requestedPredicates'],
  ): Promise<EnrichmentEvidenceBundle> {
    const requestedPredicates = [...new Set(rawRequestedPredicates ?? [])];
    if (requestedPredicates.length === 0) throw new Error('Enrichment provider requires at least one requested predicate');
    if (budget.maxSearches < 1 || budget.maxModelCalls < 1) {
      throw new Error('Enrichment provider budget does not permit search and reasoning');
    }

    const startedAt = Date.now();
    const queries = buildEnrichmentQueries(entity).slice(0, Math.min(2, budget.maxSearches));
    const searchResponses: Array<{ query: string; results: EnrichmentSearchResult[]; usage: EnrichmentSearchResponse['usage'] }> = [];
    for (const query of queries) {
      const remainingDeadlineMs = budget.deadlineMs - (Date.now() - startedAt);
      if (remainingDeadlineMs <= 0) throw new Error('Enrichment provider exhausted its deadline before search completed');
      const response = await this.searchClient.search(query, {
        maxResults: this.maxResultsPerSearch,
        deadlineMs: remainingDeadlineMs,
      });
      assertMeasuredSearchUsage(response.usage);
      const results = response.results.slice(0, this.maxResultsPerSearch).map((result) => ({
        ...result,
        url: safeHttpsUrl(result.url),
      }));
      searchResponses.push({ query, results, usage: response.usage });

      const searchCost = searchResponses.reduce((total, item) => total + item.usage.estimatedCost, 0);
      if (searchCost >= budget.maxEstimatedCost) {
        throw new Error('Enrichment search consumed the reserved cost before reasoning');
      }
    }

    const searchCost = searchResponses.reduce((total, response) => total + response.usage.estimatedCost, 0);
    const remainingDeadlineMs = budget.deadlineMs - (Date.now() - startedAt);
    if (remainingDeadlineMs <= 0) throw new Error('Enrichment provider exhausted its deadline before reasoning');
    const reasonerInput = {
      entity,
      requestedPredicates,
      searches: searchResponses.map(({ query, results }) => ({ query, results })),
      budget: {
        maxInputTokens: budget.maxInputTokens,
        maxOutputTokens: budget.maxOutputTokens,
        maxEstimatedCost: budget.maxEstimatedCost - searchCost,
        deadlineMs: remainingDeadlineMs,
      },
    };
    let reasoned: EnrichmentReasonerResult;
    let reasonerError: EnrichmentReasonerCaptureError | undefined;
    try {
      reasoned = await this.reasoner.analyse(reasonerInput);
    } catch (error) {
      if (!(error instanceof EnrichmentReasonerCaptureError)) throw error;
      reasoned = error.result;
      reasonerError = error;
    }
    const citedUrls = new Set(searchResponses.flatMap(({ results }) => results.map(({ url }) => url)));
    for (const fact of reasoned.facts) {
      if (!requestedPredicates.includes(fact.predicate)) {
        throw new Error(`Enrichment reasoner returned unrequested predicate: ${fact.predicate}`);
      }
      for (const citation of fact.evidenceUrls.map(safeHttpsUrl)) {
        if (!citedUrls.has(citation)) throw new Error(`Enrichment reasoner returned uncaptured citation: ${citation}`);
      }
    }

    const reportedDuration = searchResponses.reduce((total, response) => total + response.usage.durationMs, 0)
      + reasoned.usage.durationMs;
    const bundle = EnrichmentEvidenceBundleSchema.parse({
      providerId: this.id,
      providerRunId: reasoned.providerRunId,
      retrievedAt: reasoned.retrievedAt,
      identityConfidence: reasoned.identityConfidence,
      facts: reasoned.facts,
      usage: {
        searches: queries.length,
        fetches: 0,
        modelCalls: 1,
        inputTokens: reasoned.usage.inputTokens,
        outputTokens: reasoned.usage.outputTokens,
        estimatedCost: searchCost + reasoned.usage.estimatedCost,
        durationMs: Math.max(Date.now() - startedAt, reportedDuration),
      },
      raw: {
        searchClientId: this.searchClient.id,
        reasonerId: this.reasoner.id,
        searches: searchResponses,
        reasoner: reasoned.raw,
      },
    });
    assertWithinBudget(bundle, budget);
    if (reasonerError) {
      throw new SearchModelEnrichmentCaptureError(reasonerError.message, bundle, reasonerError);
    }
    return bundle;
  }
}
