import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import {
  enrichTrustLoopEntityWithGemini,
  GroundedEnrichmentCaptureError,
} from '../google/gemini.js';
import {
  qualificationEntity,
  qualificationPredicates,
  selectEnrichmentQualificationCases,
} from '../enrichment/qualification-cohort.js';
import type { EnrichmentEvidenceBundle } from '../enrichment/types.js';
import { TrustLoopReviewCaseSchema } from '../trust-loop/types.js';

const ManifestSchema = z.object({
  generatedAt: z.string().min(1),
  reviewCases: z.array(TrustLoopReviewCaseSchema),
});

const manifestPath = process.env.TRUST_LOOP_MANIFEST_PATH ?? 'ops/trust-loop-v1-manifest.json';
const outputPath = process.env.ENRICHMENT_DIAGNOSTIC_PATH
  ?? 'ops/enrichment/gemini-native-citation-diagnostic-unreviewed.json';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY is required');

const manifest = ManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const cohort = selectEnrichmentQualificationCases(manifest.reviewCases, 10);
if (cohort.length !== 20) throw new Error(`Expected the existing 20-case cohort, got ${cohort.length}`);

const selected = cohort[0];
if (!selected) throw new Error('The diagnostic cohort is empty');
const entity = qualificationEntity(selected);
const requestedPredicates = qualificationPredicates(entity.entityType);
let captureStatus: 'captured' | 'error' = 'captured';
let bundle: EnrichmentEvidenceBundle;
try {
  bundle = await enrichTrustLoopEntityWithGemini({
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
  bundle = error instanceof GroundedEnrichmentCaptureError
    ? error.bundle
    : {
        providerId: 'gemini-grounded-v1',
        providerRunId: randomUUID(),
        retrievedAt: new Date().toISOString(),
        identityConfidence: 0,
        facts: [],
        raw: { captureError: error instanceof Error ? error.message : String(error) },
      };
}

const raw = bundle.raw && typeof bundle.raw === 'object'
  ? bundle.raw as Record<string, unknown>
  : {};
const captureError = typeof raw.captureError === 'string' ? raw.captureError : undefined;
const artifact = {
  schemaVersion: 1,
  providerId: 'gemini-grounded-v1',
  capturedAt: new Date().toISOString(),
  sourceManifestGeneratedAt: manifest.generatedAt,
  purpose: 'Verify Gemini structured output plus Google Search returns provider citation annotations',
  reviewStatus: 'unreviewed',
  cases: 1,
  canonicalWrites: 0,
  case: {
    caseId: `diagnostic-01-${selected.candidateType}`,
    sourceId: selected.sourceId,
    sourceCandidateKey: selected.candidateKey,
    captureStatus,
    entity,
    requestedPredicates,
    bundle,
  },
  contract: {
    exactlyOneModelCall: bundle.usage?.modelCalls === 1,
    requestedAtMostTwoSearches: true,
    observedSearches: bundle.usage?.searches ?? null,
    observedAtMostTwoSearches: bundle.usage ? bundle.usage.searches <= 2 : false,
    citationCount: typeof raw.citationCount === 'number' ? raw.citationCount : 0,
    providerResponseCaptured: raw.providerResponse !== undefined,
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  status: captureStatus,
  cases: 1,
  canonicalWrites: 0,
  modelCalls: bundle.usage?.modelCalls ?? 0,
  searches: bundle.usage?.searches ?? null,
  citationCount: artifact.contract.citationCount,
  captureError,
  outputPath,
}));
