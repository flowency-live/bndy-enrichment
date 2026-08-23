import { describe, expect, it } from 'vitest';
import { consolidateBrassBandProjections } from './consolidate-projections.js';
import type { BrassBandProjectionPackage } from './projection.js';

function projection(id: string, overrides: Partial<BrassBandProjectionPackage> = {}): BrassBandProjectionPackage {
  const base: BrassBandProjectionPackage = {
    projectionVersion: 2,
    entityType: 'artist',
    edition: 'brass',
    proposedId: id,
    record: {
      name: 'Example Brass Band',
      artist_type: 'band',
      performerKind: 'brass_band',
      publicationScopes: ['brass'],
      discoveryScopes: ['brass'],
      location: 'North West',
      websiteUrl: undefined,
      name_variants: ['Example Band'],
      names: [{ name: 'Example Brass Band', nameType: 'current_official', sourceUrls: ['https://a.test'], confidence: 0.95 }],
      acts: [],
      domainProfiles: { brass: { organisationType: 'brass_band', country: 'United Kingdom', sourceRefs: ['https://a.test'] } },
      source: 'bndy-brass-intelligence',
      ai_created: true,
      needs_review: false,
    },
    provenance: { identityConfidence: 0.95, sourceUrls: ['https://a.test'], observationSourceIds: ['area-a'], generatedAt: '2026-08-22T00:00:00Z' },
    publishable: true,
    holdReasons: [],
    enrichmentFlags: ['precise_band_location_not_resolved'],
  };
  return { ...base, ...overrides, record: { ...base.record, ...(overrides.record ?? {}) }, provenance: { ...base.provenance, ...(overrides.provenance ?? {}) } };
}

describe('consolidateBrassBandProjections', () => {
  it('collapses duplicate official identities and retains evidence and aliases', () => {
    const a = projection('a');
    const b = projection('b', {
      record: {
        ...projection('b').record,
        location: 'L16 8NQ',
        websiteUrl: 'https://band.test',
        name_variants: ['Historic Sponsor Band'],
        names: [{ name: 'Historic Sponsor Band', nameType: 'alternate', sourceUrls: ['https://b.test'], confidence: 0.97 }],
        domainProfiles: { brass: { organisationType: 'brass_band', postcode: 'L16 8NQ', officialWebsiteUrl: 'https://band.test', country: 'United Kingdom', sourceRefs: ['https://b.test'] } },
      },
      provenance: { identityConfidence: 0.98, sourceUrls: ['https://b.test'], observationSourceIds: ['area-b'], generatedAt: '2026-08-22T00:00:00Z' },
    });

    const result = consolidateBrassBandProjections([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].record.location).toBe('L16 8NQ');
    expect(result[0].record.name_variants).toEqual(expect.arrayContaining(['Example Band', 'Historic Sponsor Band']));
    expect(result[0].provenance.sourceUrls).toEqual(expect.arrayContaining(['https://a.test', 'https://b.test']));
    expect(result[0].provenance.observationSourceIds).toEqual(expect.arrayContaining(['area-a', 'area-b']));
  });

  it('does not merge distinct official names', () => {
    const first = projection('a');
    const second = projection('b', { record: { ...projection('b').record, name: 'Another Brass Band' } });
    expect(consolidateBrassBandProjections([first, second])).toHaveLength(2);
  });
});
