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

function escaped(value: unknown): string {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function markdownFacts(bundle: EnrichmentEvidenceBundle): string {
  if (bundle.facts.length === 0) return 'No facts returned';
  return bundle.facts.map((fact) => `${fact.predicate}=${escaped(fact.value)} (${fact.confidence.toFixed(3)})`).join('; ');
}

const reviewLines = [
  '# Backline grounded-enrichment qualification review',
  '',
  `Captured: ${capturedAt}`,
  '',
  'This is a bounded 20-case provider qualification cohort, not the full Backline corpus. It contains 10 artists and 10 venues selected from the live Trust Loop review set. No canonical writes occurred.',
  '',
  `Capture errors: ${captureErrors}. Estimated cost: $${totalEstimatedCost.toFixed(4)}.`,
  '',
  '| Case | Type | Source | Entity | Identity confidence | Proposed facts | Human identity | Human notes |',
  '|---|---|---|---|---:|---|---|---|',
  ...cases.map((item) => {
    const entity = item.entity as ReturnType<typeof qualificationEntity>;
    const bundle = item.bundle as EnrichmentEvidenceBundle;
    return `| ${item.caseId} | ${entity.entityType} | ${escaped(item.sourceId)} | ${escaped(entity.displayName)} | ${bundle.identityConfidence.toFixed(3)} | ${escaped(markdownFacts(bundle))} | match / park | |`;
  }),
  '',
  '## Review instructions',
  '',
  'For every case, confirm `match` only if the evidence definitely belongs to the exact artist or venue. Mark `park` for ambiguity, a same-name entity, weak locality or an unproven official link. Any confident false identity, wrong official URL or unsupported classification fails qualification.',
  '',
  ...cases.flatMap((item) => {
    const entity = item.entity as ReturnType<typeof qualificationEntity>;
    const bundle = item.bundle as EnrichmentEvidenceBundle;
    const raw = bundle.raw as { identityReason?: string; captureError?: string };
    const evidenceUrls = [...new Set(bundle.facts.flatMap((fact) => fact.evidenceUrls))];
    return [
      `### ${item.caseId}: ${entity.displayName}`,
      '',
      `- Source: ${item.sourceId} / ${item.sourceCandidateKey}`,
      `- Provider identity confidence: ${bundle.identityConfidence.toFixed(3)}`,
      `- Provider reasoning: ${escaped(raw.identityReason ?? raw.captureError ?? 'None returned')}`,
      `- Proposed facts: ${markdownFacts(bundle)}`,
      `- Evidence: ${evidenceUrls.length ? evidenceUrls.map((url) => `[link](${url})`).join(', ') : 'none'}`,
      '- Human identity decision: [ ] match  [ ] park',
      '- Human fact decision: [ ] all supported  [ ] corrections required',
      '- Human notes:',
      '',
    ];
  }),
].join('\n');

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(reviewPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
await writeFile(reviewPath, `${reviewLines}\n`, 'utf8');

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
