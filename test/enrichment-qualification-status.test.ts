import { describe, expect, it } from 'vitest';
import { qualificationSummaryFromArtifact } from '../src/enrichment/qualification-status.js';

describe('enrichment qualification status', () => {
  it('publishes an honest failed-capture summary with zero writes', () => {
    const summary = qualificationSummaryFromArtifact({
      schemaVersion: 1,
      providerId: 'gemini-grounded-v1',
      capturedAt: '2026-08-28T16:34:56.273Z',
      reviewStatus: 'unreviewed',
      cases: 2,
      artistCases: 1,
      venueCases: 1,
      captureErrors: 1,
      totalEstimatedCost: 0.12,
      canonicalWrites: 0,
      items: [
        {
          caseId: 'grounded-01-artist',
          sourceId: 'source-a',
          captureStatus: 'captured',
          entity: { entityType: 'artist', displayName: 'Artist A' },
          bundle: {
            identityConfidence: 0.98,
            facts: [{ predicate: 'hasGenre' }],
            raw: {
              identityReason: 'Exact identity match.',
              rejectedFacts: [{ reason: 'uncaptured citation' }],
            },
          },
          canonicalWrites: 0,
        },
        {
          caseId: 'grounded-02-venue',
          sourceId: 'source-b',
          captureStatus: 'error',
          entity: { entityType: 'venue', displayName: 'Venue B' },
          bundle: {
            identityConfidence: 0,
            facts: [],
            raw: { captureError: 'provider timeout' },
          },
          canonicalWrites: 0,
        },
      ],
    }, '2026-08-28T17:05:00.000Z', {
      sourceRunUrl: 'https://github.com/flowency-live/bndy-enrichment/actions/runs/1',
      artifactUrl: 'https://github.com/flowency-live/bndy-enrichment/blob/main/evidence.json',
      reviewUrl: 'https://github.com/flowency-live/bndy-enrichment/blob/main/review.md',
    });

    expect(summary).toMatchObject({
      gateStatus: 'capture-failed',
      reviewStatus: 'unreviewed',
      cases: 2,
      capturedCases: 1,
      captureErrors: 1,
      highConfidenceCases: 1,
      abstainedCases: 0,
      acceptedFacts: 1,
      quarantinedFacts: 1,
      costMeasurement: 'partial-error-path',
      canonicalWrites: 0,
      reviewUrl: 'https://github.com/flowency-live/bndy-enrichment/blob/main/review.md',
    });
    expect(summary.reviewCases).toEqual([
      expect.objectContaining({
        caseId: 'grounded-01-artist',
        displayName: 'Artist A',
        decision: 'review-required',
        acceptedFacts: 1,
        quarantinedFacts: 1,
      }),
      expect.objectContaining({
        caseId: 'grounded-02-venue',
        displayName: 'Venue B',
        decision: 'capture-error',
      }),
    ]);
  });

  it('rejects inconsistent capture totals', () => {
    expect(() => qualificationSummaryFromArtifact({
      schemaVersion: 1,
      providerId: 'gemini-grounded-v1',
      capturedAt: '2026-08-28T16:34:56.273Z',
      reviewStatus: 'unreviewed',
      cases: 2,
      artistCases: 1,
      venueCases: 1,
      captureErrors: 0,
      totalEstimatedCost: 0,
      canonicalWrites: 0,
      items: [],
    })).toThrow(/item count/i);
  });
});
