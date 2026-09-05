import { describe, expect, it } from 'vitest';
import { waveOneSources } from '../src/cli/seed-wave1-sources.js';
import { SourceProjectionPolicySchema } from '../src/knowledge/types.js';

describe('KLMA projection policy', () => {
  const klma = waveOneSources(new Date('2026-09-05T12:00:00.000Z')).find((source) => source.id === 'klma-stoke-gig-list');

  it('is live-safe by construction: additive-only, create-only, match-only entities', () => {
    const policy = SourceProjectionPolicySchema.parse(klma?.projectionPolicy);
    expect(policy.mode).toBe('additive-only');
    expect(policy.allowedActions).toEqual(['create']);
    expect(policy.entityCreation).toBe('match-only');
  });

  it('allows every predicate a KLMA event Claim set carries, including its derivedFrom provenance', () => {
    const predicates = klma?.projectionPolicy?.allowedPredicates ?? [];
    for (const predicate of ['hasPerformerName', 'hasPerformer', 'hasVenueName', 'occursAt', 'occursOn', 'startsAt', 'hasEventUrl', 'hasStatus', 'derivedFrom']) {
      expect(predicates).toContain(predicate);
    }
  });
});
