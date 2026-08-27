import { describe, expect, it } from 'vitest';
import {
  EnrichmentQualificationFixtureSchema,
  qualifyEnrichmentProvider,
  type EnrichmentQualificationCase,
  type EnrichmentQualificationThresholds,
} from '../src/enrichment/qualification.js';

const thresholds: EnrichmentQualificationThresholds = {
  minCases: 2,
  minArtistCases: 1,
  minVenueCases: 1,
  minArtistParkCases: 0,
  minVenueParkCases: 0,
  maxFalsePositiveIdentityCases: 0,
  maxFalseNegativeIdentityCases: 0,
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

  it('fails closed on a false negative identity, citation, coverage and budget defects', () => {
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
      'false-negative-identities-present',
      'unsafe-facts-present',
      'per-item-budget-violations',
      'requested-predicate-coverage-too-low',
    ]));
  });

  it('requires hard-negative identities to park instead of rewarding confident guesses', () => {
    const artist = sample('artist-ambiguous', 'artist', 'hasWebsiteUrl');
    artist.expectedIdentity = 'park';
    artist.adjudicationNotes = 'The captured results belong to a different artist in another city.';
    artist.bundle.identityConfidence = 0.7;
    artist.bundle.facts = [];
    const venue = sample('venue-match', 'venue', 'hasAddress');
    const report = qualifyEnrichmentProvider([artist, venue], {
      ...thresholds,
      minArtistParkCases: 1,
    });
    expect(report).toMatchObject({
      qualified: true,
      expectedParkCases: 1,
      artistParkCases: 1,
      falsePositiveIdentityCases: 0,
      falseNegativeIdentityCases: 0,
      requestedPredicates: 1,
      requestedPredicateCoverage: 1,
    });
  });

  it('fails a provider that enriches an identity the truth set says is ambiguous', () => {
    const artist = sample('artist-wrong-match', 'artist', 'hasWebsiteUrl');
    artist.expectedIdentity = 'park';
    artist.adjudicationNotes = 'The captured result is a same-name artist with conflicting location evidence.';
    const venue = sample('venue-match', 'venue', 'hasAddress');
    const report = qualifyEnrichmentProvider([artist, venue], {
      ...thresholds,
      minArtistParkCases: 1,
    });
    expect(report.qualified).toBe(false);
    expect(report.falsePositiveIdentityCases).toBe(1);
    expect(report.reasons).toContain('false-positive-identities-present');
  });

  it('does not qualify fixtures that omit auditable usage metrics', () => {
    const artist = sample('artist', 'artist', 'hasWebsiteUrl');
    const venue = sample('venue', 'venue', 'hasAddress');
    delete artist.bundle.usage;
    const report = qualifyEnrichmentProvider([artist, venue], thresholds);
    expect(report.qualified).toBe(false);
    expect(report.reasons).toContain('missing-provider-usage');
  });

  it('rejects a mixed-provider or duplicate-case cohort', () => {
    const artist = sample('duplicate', 'artist', 'hasWebsiteUrl');
    const venue = sample('duplicate', 'venue', 'hasAddress');
    venue.bundle.providerId = 'different-provider';
    const report = qualifyEnrichmentProvider([artist, venue], thresholds);
    expect(report.qualified).toBe(false);
    expect(report.providerIds).toEqual(['different-provider', 'fixture-provider']);
    expect(report.duplicateCaseIds).toEqual(['duplicate']);
    expect(report.reasons).toEqual(expect.arrayContaining(['mixed-provider-cohort', 'duplicate-case-ids']));
  });

  it('requires reviewed metadata and notes for every expected-park fixture case', () => {
    const artist = sample('ambiguous', 'artist', 'hasWebsiteUrl');
    artist.expectedIdentity = 'park';
    artist.bundle.identityConfidence = 0.7;
    expect(() => EnrichmentQualificationFixtureSchema.parse({
      schemaVersion: 1,
      providerId: 'fixture-provider',
      capturedAt: '2026-08-27T13:00:00.000Z',
      adjudicatedAt: '2026-08-27T13:10:00.000Z',
      adjudicatedBy: 'reviewer',
      cases: [artist],
    })).toThrow(/adjudication notes/i);
  });
});
