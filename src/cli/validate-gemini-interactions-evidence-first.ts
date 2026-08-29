import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import {
  qualificationEntity,
  qualificationPredicates,
  selectEnrichmentQualificationCases,
} from '../enrichment/qualification-cohort.js';
import type { EnrichmentEvidenceBundle } from '../enrichment/types.js';
import { GroundedEnrichmentCaptureError } from '../google/gemini.js';
import { enrichTrustLoopEntityWithGeminiInteractionsEvidenceFirst } from '../google/gemini-interactions-evidence-first.js';
import { TrustLoopReviewCaseSchema } from '../trust-loop/types.js';

const ManifestSchema = z.object({
  generatedAt: z.string().min(1),
  reviewCases: z.array(TrustLoopReviewCaseSchema),
});

const manifestPath = process.env.TRUST_LOOP_MANIFEST_PATH ?? 'ops/trust-loop-v1-manifest.json';
const outputPath = process.env.ENRICHMENT_VALIDATION_PATH
  ?? 'ops/enrichment/gemini-interactions-evidence-first-whittles-oldham-unreviewed.json';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY is required');

const manifest = ManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const cohort = selectEnrichmentQualificationCases(manifest.reviewCases, 10);
if (cohort.length !== 20) throw new Error(`Expected the existing 20-case cohort, got ${cohort.length}`);
const selected = cohort.find((item) => item.displayName?.trim().toLowerCase() === 'whittles oldham');
if (!selected) throw new Error('Whittles Oldham is not present in the existing Backline qualification cohort');
if (selected.candidateType !== 'venue') throw new Error('Whittles Oldham must be the existing venue cohort case');

const entity = qualificationEntity(selected);
const requestedPredicates = qualificationPredicates('venue');
let captureStatus: 'captured' | 'error' = 'captured';
let bundle: EnrichmentEvidenceBundle;
let exactFailure: string | undefined;
try {
  bundle = await enrichTrustLoopEntityWithGeminiInteractionsEvidenceFirst({
    entity,
    sourceId: selected.sourceId,
    sourceCandidateKey: selected.candidateKey,
    requestedPredicates,
  }, {
    apiKey,
    model: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
  });
} catch (error) {
  captureStatus = 'error';
  exactFailure = error instanceof Error ? error.message : String(error);
  bundle = error instanceof GroundedEnrichmentCaptureError
    ? error.bundle
    : {
        providerId: 'gemini-interactions-evidence-first-v1',
        providerRunId: randomUUID(),
        retrievedAt: new Date().toISOString(),
        identityConfidence: 0,
        facts: [],
        raw: { captureError: exactFailure },
      };
}

const raw = bundle.raw && typeof bundle.raw === 'object'
  ? bundle.raw as Record<string, unknown>
  : {};
const maximumReservedCost = 0.05;
const estimatedCost = bundle.usage?.estimatedCost ?? null;
const citationCount = typeof raw.citationCount === 'number' ? raw.citationCount : 0;
const artifact = {
  schemaVersion: 1,
  providerId: 'gemini-interactions-evidence-first-v1',
  capturedAt: new Date().toISOString(),
  sourceManifestGeneratedAt: manifest.generatedAt,
  purpose: 'Validate exact-segment url_citation admission with deterministic Interactions output on Whittles Oldham',
  reviewStatus: 'unreviewed',
  adapterStatus: 'inactive',
  cases: 1,
  canonicalWrites: 0,
  scheduleCreated: false,
  providerActivated: false,
  maximumReservedCost,
  estimatedCost,
  actualWithinReservedCost: estimatedCost === null ? null : estimatedCost <= maximumReservedCost,
  case: {
    caseId: 'interactions-evidence-first-01-venue',
    sourceId: selected.sourceId,
    sourceCandidateKey: selected.candidateKey,
    captureStatus,
    exactFailure,
    entity,
    requestedPredicates,
    bundle,
  },
  contract: {
    outputFormat: 'tab-delimited-evidence-first-v1',
    modelCallAttempts: 1,
    exactlyOneModelCallRequested: true,
    exactlyOneModelCallObserved: bundle.usage?.modelCalls === 1,
    requestedSearches: { minimum: 1, maximum: 2 },
    observedSearches: bundle.usage?.searches ?? null,
    observedWithinRequestedSearches: bundle.usage
      ? bundle.usage.searches >= 1 && bundle.usage.searches <= 2
      : null,
    citationCount,
    admittedFacts: bundle.facts.length,
    allAdmittedFactsHaveProviderSegmentCitations: bundle.facts.length > 0
      && bundle.facts.every((fact) => fact.evidenceUrls.length > 0),
    providerResponseCaptured: raw.providerResponse !== undefined,
    canonicalWrites: 0,
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  status: captureStatus,
  case: entity.displayName,
  canonicalWrites: 0,
  modelCallAttempts: 1,
  observedModelCalls: bundle.usage?.modelCalls ?? null,
  searches: bundle.usage?.searches ?? null,
  citationCount,
  admittedFacts: bundle.facts.length,
  estimatedCost,
  actualWithinReservedCost: artifact.actualWithinReservedCost,
  exactFailure,
  outputPath,
}));
