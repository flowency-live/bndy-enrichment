import { describe, expect, it } from 'vitest';
import { renderQualificationReview } from '../src/enrichment/qualification-review.js';

describe('enrichment qualification review', () => {
  it('shows accepted, quarantined and provider-error outcomes without treating quarantine as evidence', () => {
    const review = renderQualificationReview({
      capturedAt: '2026-08-28T19:07:24.428Z',
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
          sourceCandidateKey: 'artist-a',
          captureStatus: 'captured',
          entity: { entityType: 'artist', displayName: 'Artist A' },
          bundle: {
            identityConfidence: 0.98,
            facts: [{
              predicate: 'hasGenre',
              value: 'Rock',
              confidence: 0.98,
              evidenceUrls: ['https://artist.example/about'],
            }],
            raw: {
              identityReason: 'Exact official identity.',
              evidence: [{ sourceUrl: 'https://artist.example/about' }],
              rejectedFacts: [{
                fact: {
                  predicate: 'hasFacebookUrl',
                  value: 'https://facebook.com/example',
                  confidence: 0.9,
                  evidenceUrls: ['https://facebook.com/example'],
                },
                reason: 'uncaptured citation',
              }],
            },
          },
        },
        {
          caseId: 'grounded-02-venue',
          sourceId: 'source-b',
          sourceCandidateKey: 'venue-b',
          captureStatus: 'error',
          entity: { entityType: 'venue', displayName: 'Venue B' },
          bundle: {
            identityConfidence: 0,
            facts: [],
            raw: { captureError: 'Gemini 503: service unavailable' },
          },
        },
      ],
    });

    expect(review).toContain('Captured cases: 1/2');
    expect(review).toContain('Accepted facts: 1');
    expect(review).toContain('Quarantined facts: 1');
    expect(review).toContain('hasGenre=Rock (0.980)');
    expect(review).toContain('hasFacebookUrl=https://facebook.com/example (0.900) [uncaptured citation]');
    expect(review).toContain('Gemini 503: service unavailable');
    expect(review).toContain('cannot project to canonical BNDY');
  });
});
