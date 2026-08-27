import { z } from 'zod';
import { ClaimPredicateSchema, type ClaimPredicate } from '../knowledge/types.js';
import { assessEnrichmentFacts, SAFE_ENRICHMENT_BUDGET } from './safety.js';
import {
  CanonicalEntitySnapshotSchema,
  EnrichmentEvidenceBundleSchema,
  type CanonicalEntitySnapshot,
  type EnrichmentEvidenceBundle,
} from './types.js';

export type EnrichmentQualificationCase = {
  caseId: string;
  entity: CanonicalEntitySnapshot;
  requestedPredicates: ClaimPredicate[];
  bundle: EnrichmentEvidenceBundle;
  /**
   * Hard-negative cases are expected to abstain by returning identityConfidence
   * below the processor's 0.98 identity threshold. Older fixtures default to a
   * positive match so the contract remains backwards compatible.
   */
  expectedIdentity?: 'match' | 'park';
  adjudicationNotes?: string;
};

export const EnrichmentQualificationCaseSchema = z.object({
  caseId: z.string().min(1),
  entity: CanonicalEntitySnapshotSchema,
  requestedPredicates: z.array(ClaimPredicateSchema).min(1).max(12),
  bundle: EnrichmentEvidenceBundleSchema,
  expectedIdentity: z.enum(['match', 'park']).optional(),
  adjudicationNotes: z.string().min(1).max(2_000).optional(),
}).superRefine((item, context) => {
  if (item.expectedIdentity === 'park' && !item.adjudicationNotes) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['adjudicationNotes'],
      message: 'Expected-park cases require human adjudication notes',
    });
  }
});

export const EnrichmentQualificationFixtureSchema = z.object({
  schemaVersion: z.literal(1),
  providerId: z.string().min(1),
  capturedAt: z.string().datetime(),
  adjudicatedAt: z.string().datetime(),
  adjudicatedBy: z.string().min(1),
  cases: z.array(EnrichmentQualificationCaseSchema).min(1),
}).superRefine((fixture, context) => {
  for (const [index, item] of fixture.cases.entries()) {
    if (item.bundle.providerId !== fixture.providerId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cases', index, 'bundle', 'providerId'],
        message: 'Case providerId must match the fixture providerId',
      });
    }
  }
});
export type EnrichmentQualificationFixture = z.infer<typeof EnrichmentQualificationFixtureSchema>;

export type EnrichmentQualificationThresholds = {
  minCases: number;
  minArtistCases: number;
  minVenueCases: number;
  minArtistParkCases: number;
  minVenueParkCases: number;
  maxFalsePositiveIdentityCases: number;
  maxFalseNegativeIdentityCases: number;
  maxUnsafeFacts: number;
  maxBudgetViolationCases: number;
  maxMissingUsageCases: number;
  minRequestedPredicateCoverage: number;
};

export const DEFAULT_ENRICHMENT_QUALIFICATION_THRESHOLDS: EnrichmentQualificationThresholds = {
  minCases: 20,
  minArtistCases: 5,
  minVenueCases: 5,
  minArtistParkCases: 2,
  minVenueParkCases: 2,
  maxFalsePositiveIdentityCases: 0,
  maxFalseNegativeIdentityCases: 0,
  maxUnsafeFacts: 0,
  maxBudgetViolationCases: 0,
  maxMissingUsageCases: 0,
  minRequestedPredicateCoverage: 0.8,
};

export type EnrichmentQualificationReport = {
  qualified: boolean;
  providerIds: string[];
  duplicateCaseIds: string[];
  cases: number;
  artistCases: number;
  venueCases: number;
  facts: number;
  claimableFacts: number;
  reviewFacts: number;
  unsafeFacts: number;
  identityParkedCases: number;
  expectedMatchCases: number;
  expectedParkCases: number;
  artistParkCases: number;
  venueParkCases: number;
  falsePositiveIdentityCases: number;
  falseNegativeIdentityCases: number;
  missingUsageCases: number;
  budgetViolationCases: number;
  requestedPredicates: number;
  coveredRequestedPredicates: number;
  requestedPredicateCoverage: number;
  totalEstimatedCost: number;
  maximumEstimatedCost: number;
  reasons: string[];
};

function usageOverBudget(bundle: EnrichmentEvidenceBundle): boolean {
  const usage = bundle.usage;
  if (!usage) return false;
  return usage.searches > SAFE_ENRICHMENT_BUDGET.maxSearches
    || usage.fetches > SAFE_ENRICHMENT_BUDGET.maxFetches
    || usage.modelCalls > SAFE_ENRICHMENT_BUDGET.maxModelCalls
    || usage.inputTokens > SAFE_ENRICHMENT_BUDGET.maxInputTokens
    || usage.outputTokens > SAFE_ENRICHMENT_BUDGET.maxOutputTokens
    || usage.estimatedCost > SAFE_ENRICHMENT_BUDGET.maxEstimatedCost
    || usage.durationMs > SAFE_ENRICHMENT_BUDGET.deadlineMs;
}

const UNSAFE_REASONS = new Set([
  'predicate-not-allow-listed',
  'invalid-or-empty-value',
  'no-safe-https-evidence',
]);

export function qualifyEnrichmentProvider(
  rawCases: EnrichmentQualificationCase[],
  thresholds: EnrichmentQualificationThresholds = DEFAULT_ENRICHMENT_QUALIFICATION_THRESHOLDS,
): EnrichmentQualificationReport {
  let artistCases = 0;
  let venueCases = 0;
  let facts = 0;
  let claimableFacts = 0;
  let reviewFacts = 0;
  let unsafeFacts = 0;
  let identityParkedCases = 0;
  let expectedMatchCases = 0;
  let expectedParkCases = 0;
  let artistParkCases = 0;
  let venueParkCases = 0;
  let falsePositiveIdentityCases = 0;
  let falseNegativeIdentityCases = 0;
  let missingUsageCases = 0;
  let budgetViolationCases = 0;
  let requestedPredicates = 0;
  let coveredRequestedPredicates = 0;
  let totalEstimatedCost = 0;
  let maximumEstimatedCost = 0;
  const providerIds = new Set<string>();
  const caseIdCounts = new Map<string, number>();

  for (const inputCase of rawCases) {
    const rawCase = EnrichmentQualificationCaseSchema.parse(inputCase);
    const entity = rawCase.entity;
    const bundle = rawCase.bundle;
    providerIds.add(bundle.providerId);
    caseIdCounts.set(rawCase.caseId, (caseIdCounts.get(rawCase.caseId) ?? 0) + 1);
    const expectedIdentity = rawCase.expectedIdentity ?? 'match';
    const identityParked = bundle.identityConfidence < 0.98;
    if (entity.entityType === 'artist') artistCases += 1;
    else venueCases += 1;
    if (identityParked) identityParkedCases += 1;
    if (expectedIdentity === 'park') {
      expectedParkCases += 1;
      if (entity.entityType === 'artist') artistParkCases += 1;
      else venueParkCases += 1;
      if (!identityParked) falsePositiveIdentityCases += 1;
    } else {
      expectedMatchCases += 1;
      if (identityParked) falseNegativeIdentityCases += 1;
    }
    if (!bundle.usage) missingUsageCases += 1;
    else {
      if (usageOverBudget(bundle)) budgetViolationCases += 1;
      totalEstimatedCost += bundle.usage.estimatedCost;
      maximumEstimatedCost = Math.max(maximumEstimatedCost, bundle.usage.estimatedCost);
    }

    const assessed = assessEnrichmentFacts(entity, bundle);
    const independentlyAssessedFacts = assessEnrichmentFacts(entity, {
      ...bundle,
      identityConfidence: 1,
    });
    facts += assessed.length;
    claimableFacts += assessed.filter((fact) => fact.writeClaim).length;
    reviewFacts += assessed.filter((fact) => fact.review).length;
    unsafeFacts += independentlyAssessedFacts
      .filter((fact) => fact.reason && UNSAFE_REASONS.has(fact.reason)).length;

    if (expectedIdentity === 'match') {
      const suppliedPredicates = new Set(bundle.facts.map((fact) => fact.predicate));
      const requested = [...new Set(rawCase.requestedPredicates)];
      requestedPredicates += requested.length;
      coveredRequestedPredicates += requested.filter((predicate) => suppliedPredicates.has(predicate)).length;
    }
  }

  const requestedPredicateCoverage = requestedPredicates
    ? coveredRequestedPredicates / requestedPredicates
    : 1;
  const reasons: string[] = [];
  const duplicateCaseIds = [...caseIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([caseId]) => caseId)
    .sort();
  if (providerIds.size !== 1) reasons.push('mixed-provider-cohort');
  if (duplicateCaseIds.length > 0) reasons.push('duplicate-case-ids');
  if (rawCases.length < thresholds.minCases) reasons.push('insufficient-total-cases');
  if (artistCases < thresholds.minArtistCases) reasons.push('insufficient-artist-cases');
  if (venueCases < thresholds.minVenueCases) reasons.push('insufficient-venue-cases');
  if (artistParkCases < thresholds.minArtistParkCases) reasons.push('insufficient-artist-park-cases');
  if (venueParkCases < thresholds.minVenueParkCases) reasons.push('insufficient-venue-park-cases');
  if (falsePositiveIdentityCases > thresholds.maxFalsePositiveIdentityCases) reasons.push('false-positive-identities-present');
  if (falseNegativeIdentityCases > thresholds.maxFalseNegativeIdentityCases) reasons.push('false-negative-identities-present');
  if (unsafeFacts > thresholds.maxUnsafeFacts) reasons.push('unsafe-facts-present');
  if (budgetViolationCases > thresholds.maxBudgetViolationCases) reasons.push('per-item-budget-violations');
  if (missingUsageCases > thresholds.maxMissingUsageCases) reasons.push('missing-provider-usage');
  if (requestedPredicateCoverage < thresholds.minRequestedPredicateCoverage) reasons.push('requested-predicate-coverage-too-low');

  return {
    qualified: reasons.length === 0,
    providerIds: [...providerIds].sort(),
    duplicateCaseIds,
    cases: rawCases.length,
    artistCases,
    venueCases,
    facts,
    claimableFacts,
    reviewFacts,
    unsafeFacts,
    identityParkedCases,
    expectedMatchCases,
    expectedParkCases,
    artistParkCases,
    venueParkCases,
    falsePositiveIdentityCases,
    falseNegativeIdentityCases,
    missingUsageCases,
    budgetViolationCases,
    requestedPredicates,
    coveredRequestedPredicates,
    requestedPredicateCoverage,
    totalEstimatedCost,
    maximumEstimatedCost,
    reasons,
  };
}
