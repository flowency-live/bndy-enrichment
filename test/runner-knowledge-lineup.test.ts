import { describe, expect, it } from 'vitest';
import type { SourceObservation } from '../src/knowledge/types.js';
import { buildKnowledge } from '../src/sources/runner/knowledge.js';
import type { NormalisedSourceEvent } from '../src/sources/runner/types.js';

const observation: SourceObservation = {
  id: 'obs-1',
  sourceId: 'test-source',
  sourceUrl: 'https://example.test/list',
  observedAt: '2026-09-05T10:00:00.000Z',
  enumerationMethod: 'fixture',
  evidenceKey: 'evidence/obs-1',
  itemCount: 1,
  complete: true,
};

function bill(): NormalisedSourceEvent {
  return {
    sourceEventKey: 'rigger-2026-10-10',
    artistName: 'Riskee And The Ridicule',
    performers: [
      { name: 'Riskee And The Ridicule', externalId: 'a-1', headliner: true },
      { name: 'Deadwax', externalId: 'a-2' },
      { name: 'Boss Cass', externalId: 'a-3', location: 'Stoke-on-Trent' },
    ],
    venueName: 'The Rigger',
    venueLocation: 'Newcastle-under-Lyme',
    date: '2026-10-10',
    startTime: '19:30',
  };
}

describe('buildKnowledge line-ups (ADR-118)', () => {
  it('writes one hasPerformer Claim per act carrying its bill position, and one hasPerformerName for the headliner', () => {
    const knowledge = buildKnowledge(observation, [bill()]);

    const performers = knowledge.claims.filter((claim) => claim.predicate === 'hasPerformer').map((claim) => claim.value);
    expect(performers).toEqual([
      { name: 'Riskee And The Ridicule', sourceNativeId: 'a-1', ordinal: 0, headliner: true },
      { name: 'Deadwax', sourceNativeId: 'a-2', ordinal: 1, headliner: false },
      { name: 'Boss Cass', sourceNativeId: 'a-3', location: 'Stoke-on-Trent', ordinal: 2, headliner: false },
    ]);
    expect(knowledge.claims.filter((claim) => claim.predicate === 'hasPerformerName').map((claim) => claim.value)).toEqual(['Riskee And The Ridicule']);
  });

  it('produces an artist candidate for every act on the bill, not only the headliner', () => {
    const knowledge = buildKnowledge(observation, [bill()]);

    const artists = knowledge.candidates.filter((candidate) => 'entityType' in candidate && candidate.entityType === 'artist');
    expect(artists.map((candidate) => candidate.candidateKey).sort()).toEqual(['a-1', 'a-2', 'a-3']);
  });

  it('keeps a single-act event exactly as before: one hasPerformer without bill position', () => {
    const knowledge = buildKnowledge(observation, [{ ...bill(), performers: undefined }]);

    const performers = knowledge.claims.filter((claim) => claim.predicate === 'hasPerformer').map((claim) => claim.value);
    expect(performers).toEqual([{ name: 'Riskee And The Ridicule' }]);
  });
});
