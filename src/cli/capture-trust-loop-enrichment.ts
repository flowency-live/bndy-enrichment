import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { enrichTrustLoopEntityWithGemini } from '../google/gemini.js';
import {
  qualificationEntity,
  qualificationPredicates,
  selectEnrichmentQualificationCases,
} from '../enrichment/qualification-cohort.js';
import type { EnrichmentEvidenceBundle } from '../enrichment/types.js';
import { renderQualificationReview } from '../enrichment/qualification-review.js';
import { TrustLoopReviewCaseSchema } from '../trust-loop/types.js';

const ManifestSchema = z.object({
  generatedAt: z.string().min(1),
  reviewCases: z.array(TrustLoopReviewCaseSchema),
});

const manifestPath = process.env.TRUST_LOOP_MANIFEST_PATH ?? 'ops/trust-loop-v1-manifest.json';
const outputPath = process.env.ENRICHMENT_CAPTURE_PATH ?? 'ops/enrichment/gemini-grounded-unreviewed.json';
const reviewPath = process.env.ENRICHMENT_REVIEW_PATH ?? 'ops/enrichment/gemini-grounded-review.md';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY is required');

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
    bundle = await enrichTrustLoopEntityWithGemini({
      entity,
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      requestedPredicates,
    }, {
      apiKey,
      model: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
    });
  } catch (error) {
    captureErrors += 1;
    captureStatus = 'error';
    bundle = {
      providerId: 'gemini-grounded-v1',
      providerRunId: randomUUID(),
      retrievedAt: new Date().toISOString(),
      identityConfidence: 0,
      facts: [],
      raw: { captureError: error instanceof Error ? error.message : String(error) },
    };
  }
  cases.push({
    caseId: `grounded-${String(index + 1).padStart(2, '0')}-${item.candidateType}`,
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
const artifact = {
  schemaVersion: 1,
  providerId: 'gemini-grounded-v1',
  capturedAt,
  sourceManifestGeneratedAt: manifest.generatedAt,
  reviewStatus: 'unreviewed',
  qualificationGate: 'Human adjudication is required before provider activation',
  cases: cases.length,
  artistCases,
  venueCases,
  captureErrors,
  totalEstimatedCost,
  canonicalWrites: 0,
  items: cases,
};

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(reviewPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
await writeFile(reviewPath, renderQualificationReview(artifact), 'utf8');

console.log(JSON.stringify({
  status: captureErrors === 0 ? 'captured' : 'captured-with-errors',
  cases: cases.length,
  artists: artistCases,
  venues: venueCases,
  captureErrors,
  totalEstimatedCost,
  canonicalWrites: 0,
  outputPath,
  reviewPath,
}));
