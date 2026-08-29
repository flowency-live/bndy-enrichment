import { describe, expect, it } from 'vitest';
import { needsCanonicalHydration, needsCanonicalRemoval } from '../src/bndy-baseline/delta.js';
import { canonicalEvidenceSource } from '../src/bndy-baseline/sources.js';

describe('canonical delta hydration policy', () => {
  it('writes only new, changed or reinstated canonical content', () => {
    expect(needsCanonicalHydration('hash-a', null)).toBe(true);
    expect(needsCanonicalHydration('hash-a', { contentHash: 'hash-a', removed: false })).toBe(false);
    expect(needsCanonicalHydration('hash-b', { contentHash: 'hash-a', removed: false })).toBe(true);
    expect(needsCanonicalHydration('hash-a', { contentHash: 'hash-a', removed: true })).toBe(true);
  });

  it('does not emit the same removal twice', () => {
    expect(needsCanonicalRemoval(null)).toBe(true);
    expect(needsCanonicalRemoval({ contentHash: 'old', removed: false })).toBe(true);
    expect(needsCanonicalRemoval({ contentHash: 'old', removed: true })).toBe(false);
  });

  it('keeps canonical evidence sources event-driven, shadow and disabled until the stream gate', () => {
    expect(canonicalEvidenceSource('artist')).toMatchObject({
      id: 'bndy-canonical-artists', sourceFamily: 'bndy-canonical', sourceRole: 'maintenance',
      scheduleAuthority: 'child', effectiveCadence: 'on-discovery', enabled: false,
      shadow: true, writerAuthority: 'aws',
    });
  });
});
