import { describe, expect, it } from 'vitest';
import { applyReviewedLocationClaim, reviewedLocationClaimFor } from './reviewed-location-claims.js';
import type { BrassBandProjectionPackage } from './projection.js';

function projection(name: string): BrassBandProjectionPackage {
  return {
    projectionVersion: 2,
    entityType: 'artist',
    edition: 'brass',
    proposedId: 'test',
    record: {
      name,
      artist_type: 'band',
      performerKind: 'brass_band',
      publicationScopes: ['brass'],
      discoveryScopes: ['brass'],
      location: 'Scotland',
      websiteUrl: undefined,
      name_variants: [],
      names: [],
      acts: [],
      domainProfiles: { brass: { organisationType: 'brass_band', country: 'United Kingdom', postcode: 'KA12 0PU', sourceRefs: ['https://weak.test'] } },
      source: 'bndy-brass-intelligence',
      ai_created: true,
      needs_review: false,
    },
    provenance: { identityConfidence: 0.98, sourceUrls: ['https://weak.test'], observationSourceIds: ['test'], generatedAt: '2026-08-22T00:00:00Z' },
    publishable: true,
    holdReasons: [],
    enrichmentFlags: [],
  };
}

describe('reviewed Band location claims', () => {
  it('replaces a weaker Irvine location with its reviewed Band Hall claim', () => {
    const next = applyReviewedLocationClaim(projection('Irvine & Dreghorn Community Brass'));
    expect(next.record.location).toBe('Dreghorn, North Ayrshire');
    expect(next.record.domainProfiles.brass.postcode).toBe('KA11 4AQ');
    expect(next.provenance.sourceUrls).toContain('https://www.idbrass.com/about-us');
  });

  it('uses current Whitburn Band Hall evidence rather than an unrelated postcode', () => {
    const next = applyReviewedLocationClaim(projection('Whitburn Band'));
    expect(next.record.domainProfiles.brass.postcode).toBe('EH47 0PX');
    expect(next.record.location).toBe('Whitburn, West Lothian');
  });

  it('leaves an unreviewed Band unchanged', () => {
    const original = projection('Some Other Band');
    expect(applyReviewedLocationClaim(original)).toEqual(original);
    expect(reviewedLocationClaimFor('Some Other Band')).toBeUndefined();
  });
});
