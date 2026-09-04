# ADR-114: Testimony Checkpoints

**Status:** Accepted  
**Date:** 4 September 2026

## Context

Every observation re-asserted every fact it saw. On 4 September the repeat OnTheCase root run wrote 2,514 Claims for 250 gigs that had not changed since the previous run. Lemonrock hydration wrote about 50,000 Claims a day, most of them for gigs already known, and queued a projection item for every one. The table, the ProjectionWorker invocations and the cost all grew with observation count, not with new information.

Backline is required to run at the lowest AWS cost that preserves the evidence model.

## Decision

In the context of hourly re-observation of stable sources, facing Claim and projection volume that grows with every run, we decided to record a per-candidate testimony checkpoint (source, fingerprint, last projected observation) and to write Claims and projection work only when an event's fingerprint differs from what the same source last asserted, and neglected a Claim TTL, to achieve Claim and projection volume proportional to change rather than to polling, accepting that an unchanged gig now accrues an observation count on its candidate instead of a fresh Claim set per run.

## Rules

- A re-observation is: same source, same candidate, same event fingerprint as the stored checkpoint.
- A re-observation writes one update to the candidate row: last observation id, last observed at, observation count. Nothing else.
- A re-observation never queues projection work when the checkpoint records a prior projection. If it was never projected, it is projected once and the checkpoint records it.
- Fresh testimony, first sight or changed fingerprint, behaves exactly as before and stores the fingerprint.
- Testimony from another source is never suppressed by this source's checkpoint.
- The Observation and raw evidence are still stored for every run. The evidence trail is intact; only duplicate Claims are avoided.
- `projectionBootstrap` runs are exempt from projection skipping.

## Consequences

- Stable sources drop to a handful of Claims per run. The first run after deployment writes one more full Claim set to seed fingerprints.
- Run reports and metrics carry `reobservedUnchanged` and `projectionSkipped` so Godmode can show the saving.
- Entity profile testimony from hydration pages is not yet checkpointed. That is a smaller volume and a separate change.
