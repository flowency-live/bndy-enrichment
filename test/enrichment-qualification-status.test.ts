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
          captureStatus: 'captured',
          entity: { entityType: 'artist' },
          bundle: {
            facts: [{ predicate: 'hasGenre' }],
            raw: {
              rejectedFacts: [{ reason: 'uncaptured citation' }],
            },
          },
          canonicalWrites: 0,
        },
        {
          captureStatus: 'error',
          entity: { entityType: 'venue' },
          bundle: {
            facts: [],
            raw: { captureError: 'provider timeout' },
          },
          canonicalWrites: 0,
        },
      ],
    }, '2026-08-28T17:05:00.000Z');

    expect(summary).toMatchObject({
      gateStatus: 'capture-failed',
      reviewStatus: 'unreviewed',
      cases: 2,
      capturedCases: 1,
      captureErrors: 1,
      acceptedFacts: 1,
      quarantinedFacts: 1,
      costMeasurement: 'partial-error-path',
      canonicalWrites: 0,
    });
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
