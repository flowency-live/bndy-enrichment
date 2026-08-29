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
import { enrichTrustLoopEntityWithGeminiGenerateContent } from '../google/gemini-generate-content.js';
import { GroundedEnrichmentCaptureError } from '../google/gemini.js';
import { TrustLoopReviewCaseSchema } from '../trust-loop/types.js';

const ManifestSchema = z.object({
  generatedAt: z.string().min(1),
  reviewCases: z.array(TrustLoopReviewCaseSchema),
});

const manifestPath = process.env.TRUST_LOOP_MANIFEST_PATH ?? 'ops/trust-loop-v1-manifest.json';
const outputPath = process.env.ENRICHMENT_VALIDATION_PATH
  ?? 'ops/enrichment/gemini-generatecontent-whittles-oldham-citation-validation-unreviewed.json';
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
  bundle = await enrichTrustLoopEntityWithGeminiGenerateContent({
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
        providerId: 'gemini-generatecontent-grounded-v1',
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
const estimatedCost = bundle.usage?.estimatedCost ?? null;
const maximumReservedCost = 0.05;
const artifact = {
  schemaVersion: 1,
  providerId: 'gemini-generatecontent-grounded-v1',
  capturedAt: new Date().toISOString(),
  sourceManifestGeneratedAt: manifest.generatedAt,
  purpose: 'Validate fact-level citations from GenerateContent groundingMetadata on Whittles Oldham',
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
    caseId: 'generatecontent-grounding-01-venue',
    sourceId: selected.sourceId,
    sourceCandidateKey: selected.candidateKey,
    captureStatus,
    exactFailure,
    entity,
    requestedPredicates,
    bundle,
  },
  contract: {
    modelCallAttempts: 1,
    exactlyOneModelCallRequested: true,
    exactlyOneModelCallObserved: bundle.usage?.modelCalls === 1,
    requestedAtMostTwoSearches: true,
    observedSearches: bundle.usage?.searches ?? null,
    observedAtMostTwoSearches: bundle.usage ? bundle.usage.searches <= 2 : null,
    citationCount: typeof raw.citationCount === 'number' ? raw.citationCount : 0,
    groundingChunkCount: typeof raw.groundingChunkCount === 'number' ? raw.groundingChunkCount : 0,
    groundingSupportCount: typeof raw.groundingSupportCount === 'number' ? raw.groundingSupportCount : 0,
    admittedFacts: bundle.facts.length,
    providerResponseCaptured: raw.providerResponse !== undefined,
    groundingMetadataCaptured: raw.groundingMetadata !== undefined,
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
  citationCount: artifact.contract.citationCount,
  admittedFacts: bundle.facts.length,
  estimatedCost,
  actualWithinReservedCost: artifact.actualWithinReservedCost,
  exactFailure,
  outputPath,
}));
