import { describe, expect, it } from 'vitest';
import {
  qualifyEnrichmentProvider,
  type EnrichmentQualificationCase,
  type EnrichmentQualificationThresholds,
} from '../src/enrichment/qualification.js';

const thresholds: EnrichmentQualificationThresholds = {
  minCases: 2,
  minArtistCases: 1,
  minVenueCases: 1,
  maxIdentityParkedCases: 0,
  maxUnsafeFacts: 0,
  maxBudgetViolationCases: 0,
  maxMissingUsageCases: 0,
  minRequestedPredicateCoverage: 1,
};

function sample(
  caseId: string,
  entityType: 'artist' | 'venue',
  predicate: 'hasWebsiteUrl' | 'hasAddress',
): EnrichmentQualificationCase {
  return {
    caseId,
    entity: {
      entityType,
      entityId: `${entityType}-1`,
      displayName: `Example ${entityType}`,
      currentValues: {},
      ownerManagedPredicates: predicate === 'hasAddress' ? ['hasAddress'] : [],
      attachedToUpcomingGig: true,
    },
    requestedPredicates: [predicate],
    bundle: {
      providerId: 'fixture-provider',
      providerRunId: `run-${caseId}`,
      retrievedAt: '2026-08-27T12:00:00.000Z',
      identityConfidence: 0.999,
      facts: [{
        predicate,
        value: predicate === 'hasWebsiteUrl' ? 'https://example.test' : '1 High Street, Stoke-on-Trent',
        confidence: 0.999,
        evidenceUrls: ['https://source.example.test/profile'],
      }],
      usage: {
        searches: 1,
        fetches: 2,
        modelCalls: 1,
        inputTokens: 2_000,
        outputTokens: 300,
        estimatedCost: 0.005,
        durationMs: 2_500,
      },
      raw: { fixture: caseId },
    },
  };
}

describe('entity enrichment provider qualification', () => {
  it('qualifies a balanced, cited, budget-safe fixture cohort', () => {
    const report = qualifyEnrichmentProvider([
      sample('artist', 'artist', 'hasWebsiteUrl'),
      sample('venue', 'venue', 'hasAddress'),
    ], thresholds);
    expect(report).toMatchObject({
      qualified: true,
      cases: 2,
      artistCases: 1,
      venueCases: 1,
      unsafeFacts: 0,
      identityParkedCases: 0,
      budgetViolationCases: 0,
      requestedPredicateCoverage: 1,
      reviewFacts: 1,
      totalEstimatedCost: 0.01,
    });
    expect(report.reasons).toEqual([]);
  });

  it('fails closed on identity, citation, coverage and budget defects', () => {
    const broken = sample('broken', 'artist', 'hasWebsiteUrl');
    broken.bundle.identityConfidence = 0.9;
    broken.bundle.facts = [{
      predicate: 'hasBio',
      value: 'A biography with an unsafe citation.',
      confidence: 0.99,
      evidenceUrls: ['http://unsafe.example.test/profile'],
    }];
    broken.bundle.usage!.searches = 4;
    const venue = sample('venue', 'venue', 'hasAddress');
    const report = qualifyEnrichmentProvider([broken, venue], thresholds);
    expect(report.qualified).toBe(false);
    expect(report.reasons).toEqual(expect.arrayContaining([
      'identity-park-rate-too-high',
      'unsafe-facts-present',
      'per-item-budget-violations',
      'requested-predicate-coverage-too-low',
    ]));
  });

  it('does not qualify fixtures that omit auditable usage metrics', () => {
    const artist = sample('artist', 'artist', 'hasWebsiteUrl');
    const venue = sample('venue', 'venue', 'hasAddress');
    delete artist.bundle.usage;
    const report = qualifyEnrichmentProvider([artist, venue], thresholds);
    expect(report.qualified).toBe(false);
    expect(report.reasons).toContain('missing-provider-usage');
  });
});
