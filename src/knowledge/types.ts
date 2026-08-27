import { z } from 'zod';

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TimeOfDaySchema = z.string().regex(/^\d{2}:\d{2}$/);
const IsoTimestampSchema = z.string().min(1);
const ConfidenceSchema = z.number().min(0).max(1);

export const SourceTypeSchema = z.enum([
  'VENUE_WEBSITE',
  'ARTIST_WEBSITE',
  'ARTIST_FACEBOOK',
  'CURATED_SOURCE',
  'AGGREGATOR',
  'CAPTURE_IMAGE',
  'CAPTURE_URL',
  'TICKETING_SOURCE',
  'MANUAL',
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceModeSchema = z.enum(['delta', 'append-only']);
export type SourceMode = z.infer<typeof SourceModeSchema>;

export const SnapshotSemanticsSchema = z.enum(['complete', 'incremental', 'one_shot']);
export type SnapshotSemantics = z.infer<typeof SnapshotSemanticsSchema>;

export const AuthorityClassSchema = z.enum([
  'owner',
  'artist-owned',
  'venue-owned',
  'official-ticket',
  'curated',
  'aggregator',
  'capture',
]);
export type AuthorityClass = z.infer<typeof AuthorityClassSchema>;

export const WriterAuthoritySchema = z.enum(['cowork', 'aws']);
export type WriterAuthority = z.infer<typeof WriterAuthoritySchema>;

export const ProjectionModeSchema = z.enum(['full', 'additive-only']);
export type ProjectionMode = z.infer<typeof ProjectionModeSchema>;

export const SourceProjectionPolicySchema = z.object({
  mode: ProjectionModeSchema,
  minAcceptedEventsPerRun: z.number().int().nonnegative().optional(),
  maxAcceptedEventsPerRun: z.number().int().positive().optional(),
  maxProjectionActionsPerRun: z.number().int().positive().optional(),
}).refine(
  (policy) => policy.minAcceptedEventsPerRun === undefined
    || policy.maxAcceptedEventsPerRun === undefined
    || policy.minAcceptedEventsPerRun <= policy.maxAcceptedEventsPerRun,
  { message: 'minAcceptedEventsPerRun must not exceed maxAcceptedEventsPerRun' },
);
export type SourceProjectionPolicy = z.infer<typeof SourceProjectionPolicySchema>;

export const RuntimeClassSchema = z.enum(['standard', 'browser']);
export type RuntimeClass = z.infer<typeof RuntimeClassSchema>;

export const SourceHealthSchema = z.enum(['healthy', 'warning', 'failed', 'unknown']);
export type SourceHealth = z.infer<typeof SourceHealthSchema>;

export const ScheduleCadenceSchema = z.enum(['daily', 'twice-daily', 'weekly', 'manual']);
export type ScheduleCadence = z.infer<typeof ScheduleCadenceSchema>;

export const LinkedEntitySchema = z.object({
  type: z.enum(['artist', 'venue', 'event']),
  id: z.string().min(1),
});
export type LinkedEntity = z.infer<typeof LinkedEntitySchema>;

export const SourceThresholdsSchema = z.object({
  venueAutoMatch: ConfidenceSchema.optional(),
  artistAutoMatch: ConfidenceSchema.optional(),
  eventAutoCreate: ConfidenceSchema.optional(),
  socialAutoAttach: ConfidenceSchema.optional(),
}).default({});
export type SourceThresholds = z.infer<typeof SourceThresholdsSchema>;

export const GigSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: SourceTypeSchema,
  url: z.string().url().optional(),
  linkedEntity: LinkedEntitySchema.optional(),
  region: z.string().optional(),
  timezone: z.string().default('Europe/London'),
  cadence: ScheduleCadenceSchema.default('daily'),
  localTime: TimeOfDaySchema.default('05:00'),
  mode: SourceModeSchema,
  snapshotSemantics: SnapshotSemanticsSchema,
  authorityClass: AuthorityClassSchema,
  thresholds: SourceThresholdsSchema,
  adapter: z.string().min(1).optional(),
  runtimeClass: RuntimeClassSchema.default('standard'),
  enabled: z.boolean().default(false),
  shadow: z.boolean().default(true),
  writerAuthority: WriterAuthoritySchema.default('cowork'),
  projectionPolicy: SourceProjectionPolicySchema.optional(),
  health: SourceHealthSchema.default('unknown'),
  nextScanAt: IsoTimestampSchema.optional(),
  lastScheduledAt: IsoTimestampSchema.optional(),
  lastSuccessfulScanAt: IsoTimestampSchema.optional(),
});
export type GigSource = z.infer<typeof GigSourceSchema>;

export const SourceObservationSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  observedAt: IsoTimestampSchema,
  sourceUrl: z.string().url().optional(),
  captureHash: z.string().min(1).optional(),
  evidenceKey: z.string().min(1).optional(),
  enumerationMethod: z.string().min(1),
  complete: z.boolean(),
  paginationComplete: z.boolean().optional(),
  captureStable: z.boolean().optional(),
  itemCount: z.number().int().nonnegative(),
  futureItemCount: z.number().int().nonnegative().optional(),
  httpStatus: z.number().int().min(100).max(599).optional(),
  contentType: z.string().optional(),
  structuralFingerprint: z.string().optional(),
});
export type SourceObservation = z.infer<typeof SourceObservationSchema>;

export const ClaimSubjectTypeSchema = z.enum([
  'artist-candidate',
  'venue-candidate',
  'event-candidate',
  'artist',
  'venue',
  'event',
  'festival',
  'source',
]);
export type ClaimSubjectType = z.infer<typeof ClaimSubjectTypeSchema>;

export const ClaimSubjectSchema = z.object({
  type: ClaimSubjectTypeSchema,
  key: z.string().min(1),
});
export type ClaimSubject = z.infer<typeof ClaimSubjectSchema>;

export const ClaimPredicateSchema = z.enum([
  'hasName',
  'hasNameVariant',
  'hasFacebookUrl',
  'hasWebsiteUrl',
  'hasInstagramUrl',
  'hasLocation',
  'hasArtistType',
  'hasActType',
  'hasGenre',
  'hasBio',
  'hasAddress',
  'hasGooglePlaceId',
  'locatedIn',
  'hasPerformer',
  'hasPerformerName',
  'occursAt',
  'hasVenueName',
  'occursOn',
  'startsAt',
  'endsAt',
  'hasTitle',
  'hasAdmissionStatus',
  'hasPrice',
  'hasTicketUrl',
  'hasEventUrl',
  'hasStatus',
  'performsAt',
  'resolvesTo',
  'reportedBy',
  'derivedFrom',
  'contradicts',
  'supersedes',
]);
export type ClaimPredicate = z.infer<typeof ClaimPredicateSchema>;

export const ClaimEvidenceSchema = z.object({
  sourceUrl: z.string().url().optional(),
  evidenceKey: z.string().optional(),
  rawItemId: z.string().optional(),
  text: z.string().optional(),
  selector: z.string().optional(),
  contentHash: z.string().optional(),
}).optional();
export type ClaimEvidence = z.infer<typeof ClaimEvidenceSchema>;

export const ClaimStatusSchema = z.enum(['active', 'withdrawn', 'superseded', 'rejected']);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

export const KnowledgeClaimSchema = z.object({
  id: z.string().min(1),
  observationId: z.string().min(1),
  sourceId: z.string().min(1),
  subject: ClaimSubjectSchema,
  predicate: ClaimPredicateSchema,
  value: z.unknown(),
  confidence: ConfidenceSchema,
  evidence: ClaimEvidenceSchema,
  assertedAt: IsoTimestampSchema.optional(),
  observedAt: IsoTimestampSchema,
  status: ClaimStatusSchema.default('active'),
});
export type KnowledgeClaim = z.infer<typeof KnowledgeClaimSchema>;

export const EventClaimBundleSchema = z.object({
  sourceEventKey: z.string().min(1),
  claims: z.array(KnowledgeClaimSchema).min(1),
  sourceEventUrl: z.string().url().optional(),
  sourceNativeId: z.string().min(1).optional(),
  extractionConfidence: ConfidenceSchema,
});
export type EventClaimBundle = z.infer<typeof EventClaimBundleSchema>;

export const EntityCandidateTypeSchema = z.enum(['artist', 'venue', 'event', 'festival']);
export type EntityCandidateType = z.infer<typeof EntityCandidateTypeSchema>;

export const EntityCandidateSchema = z.object({
  candidateKey: z.string().min(1),
  entityType: EntityCandidateTypeSchema,
  sourceId: z.string().min(1),
  sourceNativeId: z.string().optional(),
  displayName: z.string().optional(),
  observedAt: IsoTimestampSchema,
  supportingClaimIds: z.array(z.string()).default([]),
  confidence: ConfidenceSchema,
});
export type EntityCandidate = z.infer<typeof EntityCandidateSchema>;

export const EventCandidateSchema = z.object({
  candidateKey: z.string().min(1),
  sourceId: z.string().min(1),
  sourceEventKey: z.string().min(1),
  sourceNativeId: z.string().optional(),
  artistName: z.string().optional(),
  venueName: z.string().optional(),
  date: IsoDateSchema.optional(),
  startTime: TimeOfDaySchema.optional(),
  eventUrl: z.string().url().optional(),
  title: z.string().optional(),
  festivalIdentity: z.string().optional(),
  stageIdentity: z.string().optional(),
  supportingClaimIds: z.array(z.string()).default([]),
  confidence: ConfidenceSchema,
  observedAt: IsoTimestampSchema,
});
export type EventCandidate = z.infer<typeof EventCandidateSchema>;

export const ExtractionSchema = z.object({
  id: z.string().min(1),
  observationId: z.string().min(1),
  extractor: z.enum(['deterministic', 'ocr', 'model']),
  extractorVersion: z.string().min(1),
  method: z.string().min(1),
  confidence: ConfidenceSchema.optional(),
  output: z.unknown(),
  warnings: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  createdAt: IsoTimestampSchema,
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export const InterpretationProviderSchema = z.enum([
  'deterministic',
  'gemini',
  'bedrock',
  'openai',
  'other',
]);
export type InterpretationProvider = z.infer<typeof InterpretationProviderSchema>;

export const InterpretationStatusSchema = z.enum(['success', 'partial', 'failed']);
export type InterpretationStatus = z.infer<typeof InterpretationStatusSchema>;

export const InterpretationSchema = z.object({
  id: z.string().min(1),
  observationId: z.string().min(1),
  extractionId: z.string().optional(),
  provider: InterpretationProviderSchema,
  modelName: z.string().optional(),
  promptVersion: z.string().optional(),
  interpretationVersion: z.string().min(1),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  estimatedCostUSD: z.number().nonnegative().optional(),
  status: InterpretationStatusSchema,
  uncertainties: z.array(z.string()).default([]),
  output: z.unknown(),
  createdAt: IsoTimestampSchema,
});
export type Interpretation = z.infer<typeof InterpretationSchema>;

export const EvidencePackStatusSchema = z.enum(['active', 'contradicted', 'superseded', 'resolved']);
export type EvidencePackStatus = z.infer<typeof EvidencePackStatusSchema>;

export const EvidencePackSchema = z.object({
  id: z.string().min(1),
  proposition: z.string().min(1),
  observationIds: z.array(z.string()).default([]),
  interpretationIds: z.array(z.string()).default([]),
  claimIds: z.array(z.string()).min(1),
  candidateIds: z.array(z.string()).default([]),
  sourceIds: z.array(z.string()).min(1),
  sourceCount: z.number().int().positive(),
  corroborationStrength: ConfidenceSchema,
  corroborationReasoning: z.string().optional(),
  status: EvidencePackStatusSchema.default('active'),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
});
export type EvidencePack = z.infer<typeof EvidencePackSchema>;

export const EntityResolutionStatusSchema = z.enum(['resolved', 'rejected', 'superseded']);
export type EntityResolutionStatus = z.infer<typeof EntityResolutionStatusSchema>;

export const EntityResolutionSchema = z.object({
  candidateType: EntityCandidateTypeSchema,
  candidateKey: z.string().min(1),
  canonicalEntityId: z.string().min(1),
  method: z.string().min(1),
  confidence: ConfidenceSchema,
  supportingClaimIds: z.array(z.string()).default([]),
  status: EntityResolutionStatusSchema.default('resolved'),
  resolvedAt: IsoTimestampSchema,
});
export type EntityResolution = z.infer<typeof EntityResolutionSchema>;

export const TombstoneStatusSchema = z.enum(['active', 'superseded', 'reinstated']);
export type TombstoneStatus = z.infer<typeof TombstoneStatusSchema>;

export const TombstoneSchema = z.object({
  id: z.string().min(1),
  eventFingerprint: z.string().min(1),
  canonicalEventId: z.string().optional(),
  artistId: z.string().min(1),
  venueId: z.string().min(1),
  date: IsoDateSchema,
  status: TombstoneStatusSchema,
  reason: z.string().min(1),
  authorityClass: AuthorityClassSchema,
  sourceId: z.string().min(1),
  claimId: z.string().min(1),
  observationId: z.string().min(1),
  createdAt: IsoTimestampSchema,
  supersededAt: IsoTimestampSchema.optional(),
  supersededByClaimId: z.string().optional(),
});
export type Tombstone = z.infer<typeof TombstoneSchema>;

export const ClaimWithdrawalReasonSchema = z.enum([
  'absent-from-complete-snapshot',
  'explicit-retraction',
  'superseded',
  'source-correction',
]);
export type ClaimWithdrawalReason = z.infer<typeof ClaimWithdrawalReasonSchema>;

export const ClaimWithdrawalSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  observationId: z.string().min(1),
  priorClaimId: z.string().min(1),
  sourceEventKey: z.string().optional(),
  reason: ClaimWithdrawalReasonSchema,
  createdAt: IsoTimestampSchema,
});
export type ClaimWithdrawal = z.infer<typeof ClaimWithdrawalSchema>;

export const DiscoveryBudgetSchema = z.object({
  maxDepth: z.number().int().nonnegative(),
  maxEntities: z.number().int().positive(),
  maxSearches: z.number().int().nonnegative(),
  maxFetches: z.number().int().nonnegative(),
  maxModelCalls: z.number().int().nonnegative(),
  maxInputTokens: z.number().int().nonnegative(),
  maxOutputTokens: z.number().int().nonnegative(),
  maxEstimatedCost: z.number().nonnegative(),
  allowExpensiveModel: z.boolean(),
  deadlineMs: z.number().int().positive(),
});
export type DiscoveryBudget = z.infer<typeof DiscoveryBudgetSchema>;

export const ProjectionActionSchema = z.enum([
  'create',
  'update',
  'cancel',
  'withdraw',
  'reconcile',
]);
export type ProjectionAction = z.infer<typeof ProjectionActionSchema>;

export const ProjectionWorkItemSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  observationId: z.string().min(1),
  candidateKey: z.string().min(1),
  entityType: z.enum(['artist', 'venue', 'event']),
  action: ProjectionActionSchema,
  idempotencyKey: z.string().min(1),
  claimIds: z.array(z.string()).min(1),
  runId: z.string().min(1).optional(),
  runItemCount: z.number().int().positive().optional(),
  runOrdinal: z.number().int().positive().optional(),
  createdAt: IsoTimestampSchema,
});
export type ProjectionWorkItem = z.infer<typeof ProjectionWorkItemSchema>;

export const EntityEnrichmentReasonSchema = z.enum(['created', 'source-discovery', 'manual', 'retry']);
export type EntityEnrichmentReason = z.infer<typeof EntityEnrichmentReasonSchema>;

export const EntityEnrichmentWorkItemSchema = z.object({
  id: z.string().min(1),
  entityType: z.enum(['artist', 'venue']),
  entityId: z.string().min(1),
  reason: EntityEnrichmentReasonSchema,
  sourceId: z.string().optional(),
  observationId: z.string().optional(),
  requestedPredicates: z.array(ClaimPredicateSchema).max(12).optional(),
  budget: DiscoveryBudgetSchema.optional(),
  createdAt: IsoTimestampSchema,
});
export type EntityEnrichmentWorkItem = z.infer<typeof EntityEnrichmentWorkItemSchema>;

export const ProjectionRunStatusSchema = z.enum(['started', 'success', 'partial', 'failed']);
export type ProjectionRunStatus = z.infer<typeof ProjectionRunStatusSchema>;

export const ProjectionRunSchema = z.object({
  runId: z.string().min(1),
  sourceId: z.string().min(1),
  observationId: z.string().min(1),
  startedAt: IsoTimestampSchema,
  completedAt: IsoTimestampSchema.optional(),
  status: ProjectionRunStatusSchema,
  counts: z.object({
    itemsSeen: z.number().int().nonnegative().default(0),
    claims: z.number().int().nonnegative().default(0),
    artistsCreated: z.number().int().nonnegative().default(0),
    artistsMatched: z.number().int().nonnegative().default(0),
    venuesCreated: z.number().int().nonnegative().default(0),
    venuesMatched: z.number().int().nonnegative().default(0),
    eventsCreated: z.number().int().nonnegative().default(0),
    eventsUpdated: z.number().int().nonnegative().default(0),
    eventsCancelled: z.number().int().nonnegative().default(0),
    projectionFailures: z.number().int().nonnegative().default(0),
  }),
  errors: z.array(z.string()).default([]),
});
export type ProjectionRun = z.infer<typeof ProjectionRunSchema>;
