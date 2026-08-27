import { z } from 'zod';
import { ClaimPredicateSchema, DiscoveryBudgetSchema, EntityEnrichmentWorkItemSchema } from '../knowledge/types.js';

export const CanonicalEntitySnapshotSchema = z.object({
  entityType: z.enum(['artist', 'venue']),
  entityId: z.string().min(1),
  displayName: z.string().min(1),
  currentValues: z.record(z.string(), z.unknown()).default({}),
  ownerManagedPredicates: z.array(ClaimPredicateSchema).default([]),
  attachedToUpcomingGig: z.boolean().default(false),
});
export type CanonicalEntitySnapshot = z.infer<typeof CanonicalEntitySnapshotSchema>;

export const EnrichmentEvidenceFactSchema = z.object({
  predicate: ClaimPredicateSchema,
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
  evidenceUrls: z.array(z.string().url()).min(1),
  evidenceText: z.string().max(2_000).optional(),
});
export type EnrichmentEvidenceFact = z.infer<typeof EnrichmentEvidenceFactSchema>;

export const EnrichmentEvidenceBundleSchema = z.object({
  providerId: z.string().min(1),
  providerRunId: z.string().min(1),
  retrievedAt: z.string().datetime(),
  identityConfidence: z.number().min(0).max(1),
  facts: z.array(EnrichmentEvidenceFactSchema).max(50),
  raw: z.unknown(),
});
export type EnrichmentEvidenceBundle = z.infer<typeof EnrichmentEvidenceBundleSchema>;

export const EnrichmentControlStartSchema = z.enum(['started', 'resume', 'complete', 'budget-exhausted']);
export type EnrichmentControlStart = z.infer<typeof EnrichmentControlStartSchema>;

export const EnrichmentOutcomeSchema = z.object({
  itemId: z.string().min(1),
  status: z.enum(['completed', 'parked', 'idempotent', 'budget-exhausted']),
  reason: z.string().optional(),
  observationId: z.string().optional(),
  claimsWritten: z.number().int().nonnegative().default(0),
  protectedFacts: z.number().int().nonnegative().default(0),
  conflictingFacts: z.number().int().nonnegative().default(0),
  factsNeedingReview: z.number().int().nonnegative().default(0),
  canonicalWrites: z.literal(0),
});
export type EnrichmentOutcome = z.infer<typeof EnrichmentOutcomeSchema>;

export const ValidatedEnrichmentInputSchema = z.object({
  item: EntityEnrichmentWorkItemSchema,
  budget: DiscoveryBudgetSchema,
});

export const EntityEnrichmentCandidateSchema = z.object({
  entityType: z.enum(['artist', 'venue']),
  entityId: z.string().min(1),
  displayName: z.string().min(1),
  identityState: z.enum(['resolved', 'unresolved', 'conflicted']),
  missingPredicates: z.array(ClaimPredicateSchema).default([]),
  ownerManagedPredicates: z.array(ClaimPredicateSchema).default([]),
  attachedToUpcomingGig: z.boolean().default(false),
  upcomingGigCount: z.number().int().nonnegative().default(0),
  sourceCount: z.number().int().nonnegative().default(0),
  activeConflictCount: z.number().int().nonnegative().default(0),
  lastEnrichedAt: z.string().datetime().optional(),
  lastAttemptAt: z.string().datetime().optional(),
});
export type EntityEnrichmentCandidate = z.infer<typeof EntityEnrichmentCandidateSchema>;
