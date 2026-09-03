import { describe, expect, it } from 'vitest';
import type { KnowledgeClaim } from '../src/knowledge/types.js';
import { materialiseEventCandidate } from '../src/projection/candidate.js';
import { repairOnTheCaseOccursAtClaim } from '../src/repair/onthecase-occurs-at.js';
import { onTheCaseLocationFromAddress } from '../src/sources/adapters/onthecase/html.js';

function claim(overrides: Partial<KnowledgeClaim> = {}): KnowledgeClaim {
  return {
    id: 'claim-original',
    observationId: 'obs-1',
    sourceId: 'onthecase-gig-index',
    subject: { type: 'event-candidate', key: 'event:onthecase-gig-index:onthecase:gig:131412' },
    predicate: 'occursAt',
    value: {
      name: 'Old Fat Ox Holywell',
      sourceNativeId: 'onthecase:venue:6011',
      address: 'Holywell Dene Road, Holywell Whitley Bay',
    },
    confidence: 1,
    evidence: { sourceUrl: 'https://onthecasemusic.co.uk/gigs', evidenceKey: 'raw/onthecase.html' },
    observedAt: '2026-08-31T00:00:00.000Z',
    status: 'active',
    ...overrides,
  };
}

describe('OnTheCase occursAt repair', () => {
  it('derives locality only from structured multi-part addresses', () => {
    expect(onTheCaseLocationFromAddress('Holywell Dene Road, Holywell Whitley Bay')).toBe('Holywell Whitley Bay');
    expect(onTheCaseLocationFromAddress('10 High Street, Newcastle upon Tyne, NE1 1AA')).toBe('Newcastle upon Tyne');
    expect(onTheCaseLocationFromAddress('Single unstructured value')).toBeUndefined();
  });

  it('creates an immutable, provenance-linked OnTheCase repair Claim', () => {
    const original = claim();
    const repaired = repairOnTheCaseOccursAtClaim(original, {
      location: 'Holywell Whitley Bay',
      method: 'event-address-claim',
    }, '2026-09-03T12:00:00.000Z');

    expect(repaired).toMatchObject({
      sourceId: 'onthecase-gig-index',
      observationId: original.observationId,
      value: {
        name: 'Old Fat Ox Holywell',
        sourceNativeId: 'onthecase:venue:6011',
        location: 'Holywell Whitley Bay',
      },
      assertedAt: '2026-09-03T12:00:00.000Z',
    });
    expect(repaired.id).not.toBe(original.id);
    expect(repaired.evidence?.text).toContain('OnTheCase repair v1');
    expect(original.value).not.toHaveProperty('location');
  });

  it('materialises the repaired Claim at the original observation time', () => {
    const original = claim();
    const repaired = repairOnTheCaseOccursAtClaim(original, {
      location: 'Holywell Whitley Bay',
      method: 'event-address-claim',
    }, '2026-09-03T12:00:00.000Z');
    const supporting: KnowledgeClaim[] = [
      claim({ id: 'artist', predicate: 'hasPerformer', value: { name: '3rd Stage Red' } }),
      original,
      repaired,
      claim({ id: 'date', predicate: 'occursOn', value: '2026-09-12' }),
      claim({ id: 'time', predicate: 'startsAt', value: '21:00' }),
    ];

    expect(materialiseEventCandidate(original.subject.key, original.sourceId, supporting).venueLocation)
      .toBe('Holywell Whitley Bay');
  });
});
