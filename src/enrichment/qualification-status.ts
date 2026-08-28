import { z } from 'zod';

const QualificationItemSchema = z.object({
  captureStatus: z.enum(['captured', 'error']),
  entity: z.object({
    entityType: z.enum(['artist', 'venue']),
  }).passthrough(),
  bundle: z.object({
    facts: z.array(z.unknown()).default([]),
    raw: z.object({
      rejectedFacts: z.array(z.unknown()).optional(),
      captureError: z.string().optional(),
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
  links: { sourceRunUrl?: string; artifactUrl?: string } = {},
) {
  const artifact = QualificationArtifactSchema.parse(input);
  const capturedCases = artifact.items.filter((item) => item.captureStatus === 'captured').length;
  const acceptedFacts = artifact.items.reduce((total, item) => total + item.bundle.facts.length, 0);
  const quarantinedFacts = artifact.items.reduce(
    (total, item) => total + (item.bundle.raw?.rejectedFacts?.length ?? 0),
    0,
  );
  const gateStatus: QualificationGateStatus = artifact.captureErrors > 0
    ? 'capture-failed'
    : artifact.reviewStatus === 'unreviewed'
      ? 'awaiting-human-review'
      : 'reviewed';

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
    acceptedFacts,
    quarantinedFacts,
    totalEstimatedCost: artifact.totalEstimatedCost,
    costMeasurement: artifact.captureErrors > 0 ? 'partial-error-path' : 'complete',
    canonicalWrites: 0 as const,
    sourceRunUrl: links.sourceRunUrl,
    artifactUrl: links.artifactUrl,
  };
}
