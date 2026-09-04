# ADR-112: Bounded Projection Claim Window

**Status:** Accepted  
**Date:** 4 September 2026

## Context

Every source observation re-asserts every fact it sees. A gig listed hourly for weeks therefore accumulates thousands of Claims under one event candidate. That history is correct evidence: each observation is testimony.

Projection only needs the latest active Claim per predicate to materialise a candidate. Until now it loaded the complete subject history through the 1,000 Claim safety limit. On 4 September 2026 the first corrected OnTheCase shadow acquisition produced 250 candidates. 238 failed projection with "Claim safety limit exceeded" because their histories predated the schedule pause. Only the 11 new gigs projected.

## Decision

In the context of projection materialisation, facing unbounded per-candidate Claim histories, we decided to read Claims newest-first through a fixed window of 300 and stop, and neglected loading the complete history, to achieve projection cost and latency that do not grow with observation count, accepting that supporting Claims attached to a would-write or a canonical link are the newest 300 rather than the full record.

The complete-history read and its safety limit remain for repair tooling and explicit review. They are no longer on the projection path.

## Consequences

- A candidate with any depth of history projects in one bounded read.
- Would-write records and canonical support links carry at most 300 Claims.
- Withdrawn or superseded Claims inside the window are skipped by the latest-per-predicate rule as before.
- Write-side suppression of unchanged re-assertions is a separate decision and remains open.
