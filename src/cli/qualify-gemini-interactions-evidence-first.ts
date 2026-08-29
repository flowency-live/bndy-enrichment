import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import {
  qualificationEntity,
  qualificationPredicates,
  selectEnrichmentQualificationCases,
} from '../enrichment/qualification-cohort.js';
import { canAttemptNextCase, recordCaseSpend, type CohortBudgetState } from '../enrichment/qualification-budget.js';
import type { EnrichmentEvidenceBundle } from '../enrichment/types.js';
import { GroundedEnrichmentCaptureError } from '../google/gemini.js';
import { enrichTrustLoopEntityWithGeminiInteractionsEvidenceFirst } from '../google/gemini-interactions-evidence-first.js';
import { TrustLoopReviewCaseSchema } from '../trust-loop/types.js';

// Approved 20-case Interactions evidence-first qualification capture.
// Authorisation (Jason, 2026-08-29): 20 cases, one model call per case,
// one-to-two searches per case, $1.50 total reserved, zero canonical writes.
// This command captures evidence for human adjudication. It qualifies
// nothing by itself, creates no schedule and activates no provider.

const ManifestSchema = z.object({
  generatedAt: z.string().min(1),
  reviewCases: z.array(TrustLoopReviewCaseSchema),
});

const TOTAL_RESERVED_USD = 1.5;
const PER_CASE_RESERVED_USD = 0.05;

const manifestPath = process.env.TRUST_LOOP_MANIFEST_PATH ?? 'ops/trust-loop-v1-manifest.json';
const outputPath = process.env.ENRICHMENT_QUALIFICATION_PATH
  ?? 'ops/enrichment/gemini-interactions-evidence-first-20-case-unreviewed.json';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY is required');

const manifest = ManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
const cohort = selectEnrichmentQualificationCases(manifest.reviewCases, 10);
if (cohort.length !== 20) throw new Error(`Expected the existing 20-case cohort, got ${cohort.length}`);

let budgetState: CohortBudgetState = { spentEstimatedUsd: 0, attemptedCases: 0 };
const budget = { totalReservedUsd: TOTAL_RESERVED_USD, perCaseReservedUsd: PER_CASE_RESERVED_USD };
const caseResults: unknown[] = [];
let capturedCases = 0;
let errorCases = 0;
let skippedForBudget = 0;
const totals = { searches: 0, modelCalls: 0, inputTokens: 0, outputTokens: 0, admittedFacts: 0, citationCount: 0 };

for (const [index, selected] of cohort.entries()) {
  const caseId = `interactions-evidence-first-q${String(index + 1).padStart(2, '0')}-${selected.candidateType}`;
  if (!canAttemptNextCase(budget, budgetState)) {
    skippedForBudget += 1;
    caseResults.push({
      caseId,
      sourceId: selected.sourceId,
      sourceCandidateKey: selected.candidateKey,
      candidateType: selected.candidateType,
      captureStatus: 'skipped-budget-reserve',
      note: `Attempting this case could breach the $${TOTAL_RESERVED_USD} total reservation`,
    });
    continue;
  }

  if (selected.candidateType !== 'artist' && selected.candidateType !== 'venue') {
    throw new Error(`Qualification cohort must contain only artist and venue cases, got ${selected.candidateType}`);
  }
  const entity = qualificationEntity(selected);
  const requestedPredicates = qualificationPredicates(selected.candidateType);
  let captureStatus: 'captured' | 'error' = 'captured';
  let exactFailure: string | undefined;
  let bundle: EnrichmentEvidenceBundle;
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
    errorCases += 1;
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
  if (captureStatus === 'captured') capturedCases += 1;
  budgetState = recordCaseSpend(budgetState, bundle.usage?.estimatedCost, PER_CASE_RESERVED_USD);

  const raw = bundle.raw && typeof bundle.raw === 'object' ? (bundle.raw as Record<string, unknown>) : {};
  const citationCount = typeof raw.citationCount === 'number' ? raw.citationCount : 0;
  totals.searches += bundle.usage?.searches ?? 0;
  totals.modelCalls += bundle.usage?.modelCalls ?? 0;
  totals.inputTokens += bundle.usage?.inputTokens ?? 0;
  totals.outputTokens += bundle.usage?.outputTokens ?? 0;
  totals.admittedFacts += bundle.facts.length;
  totals.citationCount += citationCount;

  caseResults.push({
    caseId,
    sourceId: selected.sourceId,
    sourceCandidateKey: selected.candidateKey,
    candidateType: selected.candidateType,
    captureStatus,
    exactFailure,
    entity,
    requestedPredicates,
    perCaseReservedCost: PER_CASE_RESERVED_USD,
    estimatedCost: bundle.usage?.estimatedCost ?? null,
    withinPerCaseReserve: bundle.usage ? bundle.usage.estimatedCost <= PER_CASE_RESERVED_USD : null,
    exactlyOneModelCallObserved: bundle.usage?.modelCalls === 1,
    observedWithinRequestedSearches: bundle.usage
      ? bundle.usage.searches >= 0 && bundle.usage.searches <= 2
      : null,
    citationCount,
    admittedFacts: bundle.facts.length,
    allAdmittedFactsHaveProviderSegmentCitations: bundle.facts.every((fact) => fact.evidenceUrls.length > 0),
    bundle,
  });
}

const artifact = {
  schemaVersion: 1,
  providerId: 'gemini-interactions-evidence-first-v1',
  capturedAt: new Date().toISOString(),
  sourceManifestGeneratedAt: manifest.generatedAt,
  purpose: 'Approved 20-case evidence-first qualification capture for human adjudication',
  approval: {
    approvedBy: 'Jason (Product Owner/CTO), chat, 2026-08-29',
    cases: 20,
    modelCallsPerCase: 1,
    searchesPerCase: { minimum: 1, maximum: 2 },
    totalReservedCost: TOTAL_RESERVED_USD,
    zeroWriteBoundary: true,
  },
  reviewStatus: 'unreviewed',
  adapterStatus: 'inactive',
  cases: cohort.length,
  attemptedCases: budgetState.attemptedCases,
  capturedCases,
  errorCases,
  skippedForBudget,
  canonicalWrites: 0,
  scheduleCreated: false,
  providerActivated: false,
  maximumReservedCost: TOTAL_RESERVED_USD,
  estimatedCost: Number(budgetState.spentEstimatedUsd.toFixed(6)),
  actualWithinReservedCost: budgetState.spentEstimatedUsd <= TOTAL_RESERVED_USD,
  totals,
  contract: {
    outputFormat: 'tab-delimited-evidence-first-v1',
    citationBinding: 'fact-line-end-offset',
    hardGates: {
      zeroConfidentFalseMatches: 'adjudicated by human review, not by this capture',
      minimumKnowablePredicateCoverage: 0.8,
    },
  },
  caseResults,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  status: errorCases === 0 && skippedForBudget === 0 ? 'captured' : 'captured-with-exceptions',
  cases: cohort.length,
  attemptedCases: budgetState.attemptedCases,
  capturedCases,
  errorCases,
  skippedForBudget,
  estimatedCost: Number(budgetState.spentEstimatedUsd.toFixed(6)),
  maximumReservedCost: TOTAL_RESERVED_USD,
  canonicalWrites: 0,
}));
