import { describe, expect, it } from 'vitest';
import type { KnowledgeClaim } from '../src/knowledge/types.js';
import { materialiseEventCandidate } from '../src/projection/candidate.js';
import {
  latestActiveStringClaim,
  occursAtMissingVenueLocation,
  repairOccursAtClaim,
} from '../src/repair/lemonrock-occurs-at.js';

function claim(overrides: Partial<KnowledgeClaim> = {}): KnowledgeClaim {
  return {
    id: 'claim-original',
    observationId: 'obs-1',
    sourceId: 'lemonrock-gig-hydration',
    subject: { type: 'event-candidate', key: 'event:lemonrock-gig-hydration:lemonrock:gig:123' },
    predicate: 'occursAt',
    value: { name: 'The Example Arms', sourceNativeId: 'lemonrock:venue:example-arms' },
    confidence: 1,
    evidence: { sourceUrl: 'https://www.lemonrock.com/gig.php?id=123', evidenceKey: 'raw/123.html' },
    observedAt: '2026-08-30T20:00:00.000Z',
    status: 'active',
    ...overrides,
  };
}

describe('Lemonrock occursAt repair', () => {
  it('creates an immutable, provenance-linked repair Claim', () => {
    const original = claim();
    const repaired = repairOccursAtClaim(original, {
      location: 'Manchester',
      method: 'venue-claim-join',
      supportingClaimId: 'claim-venue-location',
      confidence: 0.9,
    }, '2026-09-02T09:00:00.000Z');

    expect(occursAtMissingVenueLocation(original)).toBe(true);
    expect(repaired).toMatchObject({
      observationId: original.observationId,
      sourceId: original.sourceId,
      value: { name: 'The Example Arms', sourceNativeId: 'lemonrock:venue:example-arms', location: 'Manchester' },
      confidence: 0.9,
      observedAt: original.observedAt,
      assertedAt: '2026-09-02T09:00:00.000Z',
      status: 'active',
    });
    expect(repaired.id).not.toBe(original.id);
    expect(repaired.evidence?.text).toContain('claim-venue-location');
    expect(original.value).not.toHaveProperty('location');
  });

  it('selects the newest active source location Claim', () => {
    const older = claim({ id: 'older', predicate: 'hasLocation', value: 'Old Town' });
    const newer = claim({ id: 'newer', predicate: 'hasLocation', value: 'New Town', observedAt: '2026-09-01T10:00:00.000Z' });
    expect(latestActiveStringClaim([older, newer], 'hasLocation')?.id).toBe('newer');
  });

  it('materialises the repaired Claim when observation timestamps are equal', () => {
    const original = claim();
    const repaired = repairOccursAtClaim(original, {
      location: 'Manchester',
      method: 'gig-evidence-replay',
    }, '2026-09-02T09:00:00.000Z');
    const supporting: KnowledgeClaim[] = [
      claim({ id: 'artist', predicate: 'hasPerformer', value: { name: 'Example Band' } }),
      original,
      repaired,
      claim({ id: 'date', predicate: 'occursOn', value: '2026-09-20' }),
      claim({ id: 'time', predicate: 'startsAt', value: '20:00' }),
    ];

    expect(materialiseEventCandidate(original.subject.key, original.sourceId, supporting).venueLocation).toBe('Manchester');
  });
});
