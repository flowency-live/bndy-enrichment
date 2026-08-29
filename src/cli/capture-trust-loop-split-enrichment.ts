import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { GeminiStructuredEnrichmentReasoner } from '../enrichment/providers/gemini-structured-reasoner.js';
import { GoogleProgrammableSearchClient } from '../enrichment/providers/google-programmable-search.js';
import { SerpApiGoogleSearchClient } from '../enrichment/providers/serpapi-google-search.js';
import {
  SearchModelEnrichmentCaptureError,
  SearchModelEnrichmentProvider,
  type EnrichmentSearchClient,
} from '../enrichment/providers/search-model.js';
import {
  qualificationEntity,
  qualificationPredicates,
  selectEnrichmentQualificationCases,
} from '../enrichment/qualification-cohort.js';
import { renderQualificationReview } from '../enrichment/qualification-review.js';
import { SAFE_ENRICHMENT_BUDGET } from '../enrichment/safety.js';
import type { EnrichmentEvidenceBundle } from '../enrichment/types.js';
import { TrustLoopReviewCaseSchema } from '../trust-loop/types.js';

const ManifestSchema = z.object({
  generatedAt: z.string().min(1),
  reviewCases: z.array(TrustLoopReviewCaseSchema),
});

const searchProvider = process.env.ENRICHMENT_SEARCH_PROVIDER ?? 'google-pse';
if (!['google-pse', 'serpapi-google'].includes(searchProvider)) {
  throw new Error(`Unsupported ENRICHMENT_SEARCH_PROVIDER: ${searchProvider}`);
}
const isSerpApiGoogle = searchProvider === 'serpapi-google';
const providerId = isSerpApiGoogle
  ? 'serpapi-google-gemini-structured-v1'
  : 'google-pse-gemini-structured-v1';
const outputStem = isSerpApiGoogle
  ? 'serpapi-google-gemini-structured'
  : 'google-pse-gemini-structured';
const manifestPath = process.env.TRUST_LOOP_MANIFEST_PATH ?? 'ops/trust-loop-v1-manifest.json';
const outputPath = process.env.ENRICHMENT_CAPTURE_PATH
  ?? `ops/enrichment/${outputStem}-unreviewed.json`;
const reviewPath = process.env.ENRICHMENT_REVIEW_PATH
  ?? `ops/enrichment/${outputStem}-review.md`;
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) throw new Error('GEMINI_API_KEY is required');

const estimatedSearchCost = Number(isSerpApiGoogle
  ? process.env.SERPAPI_ESTIMATED_COST_PER_QUERY ?? '0'
  : process.env.GOOGLE_SEARCH_ESTIMATED_COST_PER_QUERY ?? '0.005');
if (!Number.isFinite(estimatedSearchCost) || estimatedSearchCost < 0) {
  throw new Error('Search estimated cost per query must be a non-negative number');
}

let searchClient: EnrichmentSearchClient;
if (isSerpApiGoogle) {
  const serpApiKey = process.env.SERPAPI_KEY;
  if (!serpApiKey) throw new Error('SERPAPI_KEY is required');
  searchClient = new SerpApiGoogleSearchClient({
    apiKey: serpApiKey,
    estimatedCostPerSearch: estimatedSearchCost,
  });
} else {
  const googleSearchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!googleSearchApiKey) throw new Error('GOOGLE_SEARCH_API_KEY is required');
  if (!googleSearchEngineId) throw new Error('GOOGLE_SEARCH_ENGINE_ID is required');
  searchClient = new GoogleProgrammableSearchClient({
    apiKey: googleSearchApiKey,
    engineId: googleSearchEngineId,
    estimatedCostPerSearch: estimatedSearchCost,
  });
}

const provider = new SearchModelEnrichmentProvider(
  searchClient,
  new GeminiStructuredEnrichmentReasoner({
    apiKey: geminiApiKey,
    model: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
  }),
  { id: providerId, maxResultsPerSearch: 5 },
);

const manifest = ManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const selected = selectEnrichmentQualificationCases(manifest.reviewCases, 10);
const artistCases = selected.filter((item) => item.candidateType === 'artist').length;
const venueCases = selected.filter((item) => item.candidateType === 'venue').length;
if (selected.length !== 20 || artistCases !== 10 || venueCases !== 10) {
  throw new Error(`Expected a 10 artist and 10 venue cohort, got ${artistCases} artists and ${venueCases} venues`);
}

const capturedAt = new Date().toISOString();
const cases: Array<Record<string, unknown>> = [];
let captureErrors = 0;

for (const [index, item] of selected.entries()) {
  const entity = qualificationEntity(item);
  const requestedPredicates = qualificationPredicates(entity.entityType);
  let bundle: EnrichmentEvidenceBundle;
  let captureStatus: 'captured' | 'error' = 'captured';
  try {
    bundle = await provider.gather(entity, SAFE_ENRICHMENT_BUDGET, requestedPredicates);
  } catch (error) {
    captureErrors += 1;
    captureStatus = 'error';
    bundle = error instanceof SearchModelEnrichmentCaptureError
      ? error.bundle
      : {
          providerId,
          providerRunId: randomUUID(),
          retrievedAt: new Date().toISOString(),
          identityConfidence: 0,
          facts: [],
          raw: { captureError: error instanceof Error ? error.message : String(error) },
        };
  }
  cases.push({
    caseId: `split-${String(index + 1).padStart(2, '0')}-${item.candidateType}`,
    sourceId: item.sourceId,
    sourceCandidateKey: item.candidateKey,
    captureStatus,
    entity,
    requestedPredicates,
    bundle,
    review: {
      expectedIdentity: null,
      adjudicationNotes: null,
      reviewedBy: null,
      reviewedAt: null,
      factJudgements: bundle.facts.map((fact) => ({
        predicate: fact.predicate,
        value: fact.value,
        status: null,
        note: null,
      })),
    },
    canonicalWrites: 0,
  });
  console.log(JSON.stringify({
    case: index + 1,
    total: selected.length,
    type: item.candidateType,
    sourceId: item.sourceId,
    displayName: entity.displayName,
    captureStatus,
    identityConfidence: bundle.identityConfidence,
    facts: bundle.facts.length,
  }));
}

const totalEstimatedCost = cases.reduce((total, item) => {
  const bundle = item.bundle as EnrichmentEvidenceBundle;
  return total + (bundle.usage?.estimatedCost ?? 0);
}, 0);
const measuredUsageCases = cases.filter((item) => {
  const bundle = item.bundle as EnrichmentEvidenceBundle;
  return bundle.usage !== undefined;
}).length;
const costMeasurement = measuredUsageCases === cases.length
  ? 'complete'
  : measuredUsageCases === 0
    ? 'unavailable'
    : 'partial';
const artifact = {
  schemaVersion: 1,
  providerId,
  capturedAt,
  sourceManifestGeneratedAt: manifest.generatedAt,
  reviewStatus: 'unreviewed',
  qualificationGate: 'Human adjudication is required before provider activation',
  architecture: isSerpApiGoogle
    ? 'two explicit SerpAPI Google result sets followed by one stateless schema-constrained Gemini call'
    : 'two explicit Google Programmable Search result sets followed by one stateless schema-constrained Gemini call',
  cases: cases.length,
  artistCases,
  venueCases,
  captureErrors,
  totalEstimatedCost,
  costMeasurement,
  measuredUsageCases,
  canonicalWrites: 0,
  items: cases,
};

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(reviewPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
await writeFile(reviewPath, renderQualificationReview(artifact), 'utf8');

console.log(JSON.stringify({
  status: captureErrors === 0 ? 'captured' : 'captured-with-errors',
  providerId,
  cases: cases.length,
  artists: artistCases,
  venues: venueCases,
  captureErrors,
  totalEstimatedCost,
  costMeasurement,
  measuredUsageCases,
  canonicalWrites: 0,
  outputPath,
  reviewPath,
}));
