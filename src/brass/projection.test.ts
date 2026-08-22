import { describe, expect, it } from 'vitest';
import { buildBrassBandProjection } from './projection.js';
import type { BrassBandIdentityCandidate } from './types.js';
import type { ResolvedBrassBand } from './resolve-band.js';

const candidate: BrassBandIdentityCandidate = {
  canonicalName: 'KNDS Fairey',
  aliases: [],
  regions: ['North West'],
  confidence: 0.9,
  observations: [{
    observedName: 'KNDS Fairey',
    normalisedName: 'knds fairey',
    conductorName: 'Phil Chalk',
    section: 'Championship',
    region: 'North West',
    year: 2026,
    sourceId: '4br-test',
    sourceUrl: 'https://example.test/result',
    sourceKind: 'contest_result',
    observedAt: '2026-03-01T00:00:00Z',
    evidenceText: '2. KNDS Fairey (Phil Chalk)',
  }],
};

const resolved: ResolvedBrassBand = {
  officialName: 'KNDS Fairey Band',
  officialWebsite: 'https://example.test/fairey',
  town: 'Stockport',
  county: 'Greater Manchester',
  country: 'United Kingdom',
  aliases: [{
    name: 'Fairey Band',
    type: 'former_official',
    confidence: 0.96,
    evidenceUrls: ['https://example.test/history'],
  }],
  identityConfidence: 0.97,
  evidenceUrls: ['https://example.test/fairey', 'https://example.test/history'],
};

describe('brass projection', () => {
  it('projects a resolved identity to a brass-only canonical Artist without contest facts leaking', () => {
    const projection = buildBrassBandProjection(candidate, resolved);
    expect(projection.publishable).toBe(true);
    expect(projection.record.publicationScopes).toEqual(['brass']);
    expect(projection.record.discoveryScopes).toEqual(['brass']);
    expect(projection.record.performerKind).toBe('brass_band');
    expect(projection.record.name_variants).toContain('KNDS Fairey');
    expect(projection.record.name_variants).toContain('Fairey Band');
    expect(JSON.stringify(projection.record)).not.toContain('Phil Chalk');
    expect(JSON.stringify(projection.record)).not.toContain('Championship');
  });

  it('uses the existing embedded Acts model for Productions', () => {
    const projection = buildBrassBandProjection(candidate, resolved, [{
      name: 'The Planets',
      productionKind: 'themed_concert',
      description: 'A themed concert programme.',
      websiteUrl: 'https://example.test/fairey/planets',
    }]);
    expect(projection.record.acts).toHaveLength(1);
    expect(projection.record.acts[0]).toMatchObject({
      name: 'The Planets',
      actKind: 'production',
      productionKind: 'themed_concert',
      publicationScopes: ['brass'],
      isDefault: true,
    });
  });

  it('holds weak identity resolution instead of making it writeable', () => {
    const projection = buildBrassBandProjection(candidate, {
      ...resolved,
      identityConfidence: 0.72,
      officialWebsite: undefined,
      town: undefined,
      evidenceUrls: [],
    });
    expect(projection.publishable).toBe(false);
    expect(projection.record.needs_review).toBe(true);
    expect(projection.holdReasons).toContain('identity_confidence_below_0.90');
    expect(projection.holdReasons).toContain('official_website_not_resolved');
    expect(projection.holdReasons).toContain('band_location_not_resolved');
  });
});
