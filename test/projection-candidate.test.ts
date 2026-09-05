import { describe, expect, it } from 'vitest';
import type { KnowledgeClaim } from '../src/knowledge/types.js';
import { materialiseEventCandidate } from '../src/projection/candidate.js';

const candidateKey = 'event:test-source:bill-1';

function claim(id: string, predicate: KnowledgeClaim['predicate'], value: unknown, observedAt = '2026-09-05T10:00:00.000Z'): KnowledgeClaim {
  return {
    id, observationId: 'obs-1', sourceId: 'test-source',
    subject: { type: 'event-candidate', key: candidateKey },
    predicate, value, confidence: 1, observedAt, status: 'active',
  };
}

function baseClaims(): KnowledgeClaim[] {
  return [
    claim('c-venue', 'occursAt', { name: 'The Rigger', sourceNativeId: 'venue-1', location: 'Newcastle-under-Lyme' }),
    claim('c-date', 'occursOn', '2026-10-10'),
    claim('c-time', 'startsAt', '19:30'),
  ];
}

describe('materialiseEventCandidate line-ups (ADR-118)', () => {
  it('builds an ordered bill from one hasPerformer Claim per act, headliner first', () => {
    const candidate = materialiseEventCandidate(candidateKey, 'test-source', [
      ...baseClaims(),
      claim('c-p2', 'hasPerformer', { name: 'Deadwax', sourceNativeId: 'a-2', ordinal: 1, headliner: false }),
      claim('c-p1', 'hasPerformer', { name: 'Riskee And The Ridicule', sourceNativeId: 'a-1', ordinal: 0, headliner: true }),
      claim('c-p3', 'hasPerformer', { name: 'Boss Cass', sourceNativeId: 'a-3', ordinal: 2, headliner: false }),
    ]);

    expect(candidate.performers.map((performer) => performer.name)).toEqual(['Riskee And The Ridicule', 'Deadwax', 'Boss Cass']);
    expect(candidate.performers[0]).toMatchObject({ externalId: 'a-1', headliner: true });
    expect(candidate.artistName).toBe('Riskee And The Ridicule');
    expect(candidate.artistExternalId).toBe('a-1');
  });

  it('treats a legacy single hasPerformer Claim without an ordinal as a one-act bill', () => {
    const candidate = materialiseEventCandidate(candidateKey, 'test-source', [
      ...baseClaims(),
      claim('c-p', 'hasPerformer', { name: 'The Test Band', sourceNativeId: 'artist-7', location: 'Stoke-on-Trent' }),
    ]);

    expect(candidate.performers).toEqual([{ name: 'The Test Band', externalId: 'artist-7', location: 'Stoke-on-Trent', headliner: true }]);
    expect(candidate.artistName).toBe('The Test Band');
  });

  it('keeps only the newest Claim per act when the same bill is re-observed', () => {
    const candidate = materialiseEventCandidate(candidateKey, 'test-source', [
      ...baseClaims(),
      claim('c-old', 'hasPerformer', { name: 'Deadwax', ordinal: 1, headliner: false }, '2026-09-01T10:00:00.000Z'),
      claim('c-new', 'hasPerformer', { name: 'Deadwax', ordinal: 1, headliner: false, location: 'Stoke-on-Trent' }, '2026-09-05T10:00:00.000Z'),
      claim('c-head', 'hasPerformer', { name: 'Riskee And The Ridicule', ordinal: 0, headliner: true }),
    ]);

    expect(candidate.performers).toHaveLength(2);
    expect(candidate.performers[1]).toMatchObject({ name: 'Deadwax', location: 'Stoke-on-Trent' });
  });
});
