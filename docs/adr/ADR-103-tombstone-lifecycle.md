# ADR-103: Event Tombstone Lifecycle

**Status:** Accepted  
**Date:** 21 August 2026

## Context

Source reconciliation must remember destructive knowledge. If an event disappears or is explicitly cancelled, a later weaker source must not recreate it simply because its listing is stale.

The Event API also already has a first-class `cancelled` state. Cancellation therefore must not be modelled as deletion.

## Decision

A destructive projection writes a durable tombstone keyed by canonical artist, venue and date.

Lifecycle states:

- `active`: destructive knowledge currently blocks ordinary recreation;
- `reinstated`: fresh strong positive evidence has legitimately restored the event;
- `superseded`: retained for historical transitions where a later tombstone/claim replaces the prior one.

### Explicit cancellation

An explicit source assertion that an event is cancelled:

1. passes AuthorityPolicy;
2. calls `POST /api/curator/events/{id}/cancel`;
3. verifies `cancelled: true` by read-back;
4. writes an active tombstone with the cancellation Claim as provenance.

The Event remains visible in BNDY as cancelled.

### Withdrawal by absence

Absence may only become a withdrawal under ADR-104 (`delta + complete snapshot + complete observation`). After AuthorityPolicy passes:

1. hide the current Event projection;
2. verify `isPublic: false` by read-back;
3. write a `ClaimWithdrawal`;
4. write an active tombstone.

This is distinct from explicit cancellation.

### Reinstatement

An active tombstone blocks positive recreation from aggregator, curated and capture sources. A fresh positive claim from `owner`, `artist-owned` or `venue-owned` authority may reinstate.

If the canonical Event still exists and is hidden/cancelled, projection restores/uncancels it rather than manufacturing a second Event. The tombstone moves to `reinstated` and records the reinstating Claim.

## Consequences

- cancellation is durable knowledge rather than a destructive data loss;
- stale lower-authority feeds cannot resurrect cancelled gigs;
- legitimate artist/venue corrections can restore an event;
- BNDY can explain both the destructive action and any later reinstatement from retained provenance.
