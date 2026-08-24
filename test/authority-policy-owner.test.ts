import { describe, expect, it } from 'vitest';
import { AuthorityPolicy } from '../src/projection/authority-policy.js';

const policy = new AuthorityPolicy();

describe('owner-managed projection authority', () => {
  it('blocks aggregator mutation of an owner-managed artist profile', () => {
    const result = policy.evaluate({
      predicate: 'hasBio',
      proposedAuthority: 'aggregator',
      ownerManaged: true,
      mutation: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('owner-managed projection blocks aggregator mutation');
  });

  it('allows artist-owned mutation of an owner-managed artist profile', () => {
    const result = policy.evaluate({
      predicate: 'hasBio',
      proposedAuthority: 'artist-owned',
      ownerManaged: true,
      mutation: true,
    });

    expect(result.allowed).toBe(true);
  });

  it('allows venue-owned mutation of an owner-managed venue profile', () => {
    const result = policy.evaluate({
      predicate: 'hasAddress',
      proposedAuthority: 'venue-owned',
      ownerManaged: true,
      mutation: true,
    });

    expect(result.allowed).toBe(true);
  });

  it('blocks lower authority destructive changes to owner-managed projections', () => {
    const result = policy.evaluate({
      predicate: 'hasWebsiteUrl',
      proposedAuthority: 'capture',
      ownerManaged: true,
      destructive: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('owner-managed projection blocks capture destructive change');
  });
});
