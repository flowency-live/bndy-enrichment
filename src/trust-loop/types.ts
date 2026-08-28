import { z } from 'zod';
import { EntityCandidateTypeSchema, EntityResolutionSchema, type KnowledgeClaim, type ParsedEntityResolution } from '../knowledge/types.js';
import type { IndexedCandidate } from '../knowledge/stores/candidate-store.js';

export type CandidateEvidence = {
  candidate: IndexedCandidate;
  claims: KnowledgeClaim[];
};

export type ResolutionCase = {
  candidate: CandidateEvidence;
  canonicalHypotheses: CandidateEvidence[];
  corroboratingCandidates: CandidateEvidence[];
  classifiedAt: string;
};

export const EnrichmentFieldStateSchema = z.enum([
  'confirmed',
  'candidate-only',
  'canonical-only',
  'attempted-no-official-presence',
  'missing',
  'conflicted',
]);
export type EnrichmentFieldState = z.infer<typeof EnrichmentFieldStateSchema>;

export const TrustLoopEnrichmentAssessmentSchema = z.object({
  candidateKey: z.string().min(1),
  canonicalEntityId: z.string().min(1).optional(),
  eligible: z.boolean(),
  fields: z.record(z.string(), EnrichmentFieldStateSchema),
  confirmedOfficialLinks: z.array(z.string()).default([]),
  wrongLinkIncidents: z.number().int().nonnegative().default(0),
  evidenceClaimIds: z.array(z.string()).default([]),
});
export type TrustLoopEnrichmentAssessment = z.infer<typeof TrustLoopEnrichmentAssessmentSchema>;

export const TrustLoopReviewCaseSchema = z.object({
  candidateType: EntityCandidateTypeSchema,
  candidateKey: z.string().min(1),
  sourceId: z.string().min(1),
  displayName: z.string().optional(),
  artistName: z.string().optional(),
  venueName: z.string().optional(),
  date: z.string().optional(),
  status: z.enum(['resolved', 'unresolved', 'conflicted']),
  canonicalEntityId: z.string().optional(),
  canonicalHypotheses: z.array(z.object({
    canonicalEntityId: z.string().min(1),
    displayName: z.string().optional(),
    artistName: z.string().optional(),
    venueName: z.string().optional(),
    date: z.string().optional(),
  })).default([]),
  supportingClaimIds: z.array(z.string()).default([]),
  decisionReasoning: z.array(z.string()).default([]),
});
export type TrustLoopReviewCase = z.infer<typeof TrustLoopReviewCaseSchema>;

export const TrustLoopRunSchema = z.object({
  id: z.string().min(1),
  startedAt: z.string().min(1),
  completedAt: z.string().min(1),
  sourceIds: z.array(z.string()).min(1),
  candidateLimit: z.number().int().positive(),
  candidatesSeen: z.number().int().nonnegative(),
  candidatesClassified: z.number().int().nonnegative(),
  classifications: z.object({
    resolved: z.number().int().nonnegative(),
    unresolved: z.number().int().nonnegative(),
    conflicted: z.number().int().nonnegative(),
  }),
  entityTypes: z.record(EntityCandidateTypeSchema, z.number().int().nonnegative()),
  noSilentDrops: z.boolean(),
  canonicalWrites: z.literal(0),
  enrichment: z.object({
    eligibleArtists: z.number().int().nonnegative(),
    assessedArtists: z.number().int().nonnegative(),
    classificationCoverage: z.number().min(0).max(1),
    genreCoverage: z.number().min(0).max(1),
    officialLinkCoverage: z.number().min(0).max(1),
    attemptedNoOfficialPresence: z.number().int().nonnegative(),
    parkedOrConflicted: z.number().int().nonnegative(),
    wrongLinkIncidents: z.number().int().nonnegative(),
  }),
  acceptance: z.object({
    completeClassification: z.boolean(),
    zeroWrongLinks: z.boolean(),
    traceableDecisions: z.boolean(),
    reviewedKnownAnswerSetPassed: z.boolean(),
  }),
  status: z.enum(['passed', 'needs-review', 'failed']),
  decisions: z.array(EntityResolutionSchema),
  reviewCases: z.array(TrustLoopReviewCaseSchema),
  enrichmentAssessments: z.array(TrustLoopEnrichmentAssessmentSchema),
});
export type TrustLoopRun = z.infer<typeof TrustLoopRunSchema>;

export type TrustLoopDecision = ParsedEntityResolution;
