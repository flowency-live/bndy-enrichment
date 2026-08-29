import { z } from 'zod';

const QualificationItemSchema = z.object({
  caseId: z.string().min(1),
  sourceId: z.string().min(1),
  captureStatus: z.enum(['captured', 'error']),
  entity: z.object({
    entityType: z.enum(['artist', 'venue']),
    displayName: z.string().min(1),
  }).passthrough(),
  bundle: z.object({
    identityConfidence: z.number().min(0).max(1),
    facts: z.array(z.unknown()).default([]),
    raw: z.object({
      rejectedFacts: z.array(z.unknown()).optional(),
      captureError: z.string().optional(),
      identityReason: z.string().optional(),
      reasoner: z.object({
        captureError: z.string().optional(),
        identityReason: z.string().optional(),
      }).passthrough().optional(),
    }).passthrough().optional(),
  }).passthrough(),
  canonicalWrites: z.literal(0),
}).passthrough();

const QualificationArtifactSchema = z.object({
  schemaVersion: z.number().int().positive(),
  providerId: z.string().min(1),
  capturedAt: z.string().min(1),
  reviewStatus: z.string().min(1),
  cases: z.number().int().positive(),
  artistCases: z.number().int().nonnegative(),
  venueCases: z.number().int().nonnegative(),
  captureErrors: z.number().int().nonnegative(),
  totalEstimatedCost: z.number().nonnegative(),
  costMeasurement: z.enum(['complete', 'partial', 'unavailable']).optional(),
  measuredUsageCases: z.number().int().nonnegative().optional(),
  canonicalWrites: z.literal(0),
  items: z.array(QualificationItemSchema),
}).superRefine((artifact, context) => {
  if (artifact.items.length !== artifact.cases) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Qualification item count does not match cases',
      path: ['items'],
    });
  }
  if (artifact.artistCases + artifact.venueCases !== artifact.cases) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Artist and Venue counts do not match cases',
      path: ['artistCases'],
    });
  }
  const measuredErrors = artifact.items.filter((item) => item.captureStatus === 'error').length;
  if (measuredErrors !== artifact.captureErrors) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Capture error count does not match item statuses',
      path: ['captureErrors'],
    });
  }
});

export type QualificationGateStatus = 'capture-failed' | 'awaiting-human-review' | 'reviewed';

export function qualificationSummaryFromArtifact(
  input: unknown,
  publishedAt = new Date().toISOString(),
  links: { sourceRunUrl?: string; artifactUrl?: string; reviewUrl?: string } = {},
) {
  const artifact = QualificationArtifactSchema.parse(input);
  const capturedCases = artifact.items.filter((item) => item.captureStatus === 'captured').length;
  const acceptedFacts = artifact.items.reduce((total, item) => total + item.bundle.facts.length, 0);
  const quarantinedFacts = artifact.items.reduce(
    (total, item) => total + (item.bundle.raw?.rejectedFacts?.length ?? 0),
    0,
  );
  const highConfidenceCases = artifact.items.filter(
    (item) => item.captureStatus === 'captured' && item.bundle.identityConfidence >= 0.9,
  ).length;
  const abstainedCases = artifact.items.filter(
    (item) => item.captureStatus === 'captured'
      && item.bundle.identityConfidence < 0.5
      && item.bundle.facts.length === 0
      && (item.bundle.raw?.rejectedFacts?.length ?? 0) === 0,
  ).length;
  const reviewCases = artifact.items.map((item) => {
    const acceptedFactsForCase = item.bundle.facts.length;
    const quarantinedFactsForCase = item.bundle.raw?.rejectedFacts?.length ?? 0;
    const decision = item.captureStatus === 'error'
      ? 'capture-error'
      : item.bundle.identityConfidence < 0.5
        && acceptedFactsForCase === 0
        && quarantinedFactsForCase === 0
        ? 'abstained'
        : 'review-required';
    return {
      caseId: item.caseId,
      sourceId: item.sourceId,
      entityType: item.entity.entityType,
      displayName: item.entity.displayName,
      captureStatus: item.captureStatus,
      identityConfidence: item.bundle.identityConfidence,
      acceptedFacts: acceptedFactsForCase,
      quarantinedFacts: quarantinedFactsForCase,
      decision,
      reason: (
        item.bundle.raw?.captureError
        ?? item.bundle.raw?.identityReason
        ?? item.bundle.raw?.reasoner?.captureError
        ?? item.bundle.raw?.reasoner?.identityReason
      )?.slice(0, 500),
    };
  });
  const gateStatus: QualificationGateStatus = artifact.captureErrors > 0
    ? 'capture-failed'
    : artifact.reviewStatus === 'unreviewed'
      ? 'awaiting-human-review'
      : 'reviewed';
  const inferredCostMeasurement = artifact.items.every((item) => item.bundle.usage !== undefined)
    ? 'complete'
    : artifact.items.some((item) => item.bundle.usage !== undefined)
      ? 'partial'
      : 'unavailable';

  return {
    schemaVersion: 1,
    providerId: artifact.providerId,
    capturedAt: artifact.capturedAt,
    publishedAt,
    gateStatus,
    reviewStatus: artifact.reviewStatus,
    cases: artifact.cases,
    artistCases: artifact.artistCases,
    venueCases: artifact.venueCases,
    capturedCases,
    captureErrors: artifact.captureErrors,
    highConfidenceCases,
    abstainedCases,
    acceptedFacts,
    quarantinedFacts,
    totalEstimatedCost: artifact.totalEstimatedCost,
    costMeasurement: artifact.costMeasurement ?? inferredCostMeasurement,
    canonicalWrites: 0 as const,
    sourceRunUrl: links.sourceRunUrl,
    artifactUrl: links.artifactUrl,
    reviewUrl: links.reviewUrl,
    reviewCases,
  };
}
