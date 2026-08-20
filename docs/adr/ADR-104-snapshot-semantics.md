# ADR-104: Snapshot Semantics and Incomplete Captures

**Status:** Accepted  
**Date:** 20 August 2026

## Context

A source may be configured as a complete snapshot, incremental feed or one-shot capture, and a particular acquisition may itself be incomplete because pagination, rendering or network capture did not finish. Treating those concepts as the same thing creates false cancellations.

## Decision

`GigSource.snapshotSemantics` describes what the source normally means:

- `complete`: a complete successful capture may prove absence;
- `incremental`: absence is not evidence of cancellation;
- `one_shot`: absence is expected and never evidence of cancellation.

`SourceObservation.complete` describes the quality/completeness of one concrete capture.

`GigSource.mode` is an additional policy:

- `delta`: a qualifying complete snapshot may produce withdrawals from absence;
- `append-only`: absence never produces a withdrawal.

Therefore an absence may create a withdrawal/cancellation work item only when all three are true:

```text
source.mode = delta
AND source.snapshotSemantics = complete
AND observation.complete = true
```

For `observation.complete = false`:

- additions supported by positive evidence MAY produce Claims and projection work;
- updates supported by positive evidence MAY produce Claims and projection work;
- disappearance MUST NOT produce a ClaimWithdrawal or cancellation work item;
- explicit positive cancellation evidence may still be represented as a Claim and handled by the projection policy;
- the last prior complete observation remains the cancellation baseline.

When the next complete capture arrives, its absence comparison uses the last prior complete normalised snapshot, not an intervening incomplete capture.

## Consequences

- degraded/paginated captures can still add useful knowledge;
- missing pages cannot cancel gigs;
- a sequence of incomplete runs does not move the destructive baseline;
- source configuration and capture quality remain separate concepts;
- future explicit cancellation Claims are not blocked merely because the wider capture was incomplete.
