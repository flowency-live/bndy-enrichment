# ADR-109: Wave-One Authority Policy

**Status:** Accepted  
**Date:** 21 August 2026

## Context

BNDY stores claims from multiple sources. A single global source score is too crude: an artist-owned page is strongest for artist facts, a venue-owned page is strongest for venue facts, and both are strong for event existence/status.

Before scheduled sources can write production, destructive actions need a deterministic rule that prevents a weaker source from removing an event still supported by fresh stronger evidence.

## Decision

Wave one uses a deterministic predicate-specific `AuthorityPolicy`. Learned source reliability is deferred.

Base authority classes are:

```text
owner
artist-owned
venue-owned
official-ticket
curated
aggregator
capture
```

Predicate-specific adjustments give artist-owned sources the highest non-owner authority for artist profile facts and venue-owned sources the highest non-owner authority for venue profile facts. For event facts, venue-owned and artist-owned are both strong, followed by official ticketing, curated, aggregator and capture evidence.

### Destructive rule

For cancellation, withdrawal or other destructive projection:

> A source may not destructively change a canonical Event while a fresh active claim with strictly higher predicate authority still supports it.

Wave-one freshness is 30 days. This is deterministic configuration, not learned reliability.

### Owner-managed Event rule

An Event carrying `membershipId` or `verifiedByArtist: true` is owner-managed for projection purposes. Source-driven mutation or destruction is blocked unless the proposed source authority is `owner` or `artist-owned`.

A lower-authority source may still match/support the existing Event without mutating it. Its Claims are retained and linked as provenance.

### Tombstones

An active tombstone blocks positive projection from lower authority classes. Reinstatement requires `owner`, `artist-owned` or `venue-owned` positive evidence, as defined by ADR-103.

## Consequences

- no scheduled source can silently override stronger fresh evidence;
- owner-managed Events remain protected even though the current MCP Event API has no record-level owner gate;
- policy is explainable and testable;
- learned reliability can later influence corroboration without being required for safe wave-one writes.
