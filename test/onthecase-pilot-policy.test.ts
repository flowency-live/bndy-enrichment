import { describe, expect, it } from 'vitest';
import { ONTHECASE_SOURCES } from '../src/sources/adapters/onthecase/sources.js';
import { SourceProjectionPolicySchema } from '../src/knowledge/types.js';

const EVENT_PREDICATES = [
  'hasPerformerName', 'hasPerformer', 'hasVenueName', 'occursAt', 'occursOn', 'startsAt', 'endsAt',
  'hasTitle', 'hasEventUrl', 'hasTicketUrl', 'hasAdmissionStatus', 'hasPrice', 'hasStatus', 'derivedFrom',
];

describe('OnTheCase gig index projection policy', () => {
  const root = ONTHECASE_SOURCES.find((source) => source.id === 'onthecase-gig-index');

  it('is pilot-safe by construction: additive-only, create-only, match-only entities', () => {
    expect(root?.projectionPolicy).toBeDefined();
    const policy = SourceProjectionPolicySchema.parse(root!.projectionPolicy);
    expect(policy.mode).toBe('additive-only');
    expect(policy.allowedActions).toEqual(['create']);
    expect(policy.entityCreation).toBe('match-only');
    expect(policy.pilotCandidateKeys).toBeUndefined();
  });

  it('allows every predicate an OnTheCase event Claim set can carry and nothing destructive', () => {
    const policy = root!.projectionPolicy!;
    for (const predicate of EVENT_PREDICATES) expect(policy.allowedPredicates).toContain(predicate);
    expect(policy.allowedPredicates).not.toContain('contradicts');
  });

  it('caps a run above the root listing size so the allowlist, not the cap, selects the pilot', () => {
    expect(ONTHECASE_SOURCES.find((source) => source.id === 'onthecase-gig-index')?.projectionPolicy?.maxProjectionActionsPerRun).toBeGreaterThanOrEqual(400);
  });

  it('leaves child and maintenance sources without a live projection policy', () => {
    for (const source of ONTHECASE_SOURCES.filter((item) => item.id !== 'onthecase-gig-index')) {
      expect(source.projectionPolicy).toBeUndefined();
    }
  });
});
