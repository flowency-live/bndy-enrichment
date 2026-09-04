# Canonical-Write Pilot Packet

**Status:** Executed 4 September 2026, 20:23 to 20:24 UTC. See Outcome.
**Date:** 4 September 2026

## Purpose

Prove that Backline can write a small, named set of Events into canonical bndy through the projection engine with every containment control live, and that the write is verified, explainable and reversible.

## Shape of the pilot

| Control | Setting |
|---|---|
| Source | `onthecase-gig-index`, one manual root-only acquisition, no schedule |
| Actions | `create` only (`mode: additive-only`) |
| Entities | `entityCreation: match-only`. Artist and venue must already exist in canonical. The API is called with `canCreate: false` (ADR-021). |
| Candidates | `pilotCandidateKeys`: 5 to 10 named event candidates. Every other candidate stays a shadow would-write. |
| Window | Global control on for at most 30 minutes, then set explicitly off |
| Concurrency | Unchanged: ProjectionWorker reserved concurrency 2 |
| Writer | `writerAuthority: aws`, `shadow: false` on this one source only |

## Preconditions, all must be true

1. BndyEnrichmentStack deployed at or after bndy-enrichment `main` containing PRs #143, #144 and #145.
2. SourceRunsFunc deployed with the Backline operations route, and the Godmode Operations tab shows OnTheCase would-writes.
3. A second root-only OnTheCase shadow run under a new reconciliation id shows about 250 unchanged, 0 withdrawn, projection items all `shadow`, 0 `failed`.
4. ProjectionDLQ arrivals are 0 over the previous 24 hours.
5. For each chosen candidate, artist and venue resolve to existing canonical records. Verify with the canonical search tools before listing the key.

## Candidate selection

Take candidates from the Operations tab would-write list for `onthecase-gig-index`. Prefer gigs at least 14 days in the future, at venues already in bndy, by artists already in bndy. Record for each:

| Field | Source |
|---|---|
| candidateKey | `event:onthecase-gig-index:onthecase:gig:<id>` from the would-write row |
| Artist name and canonical artist id | Canonical search |
| Venue name and canonical venue id | Canonical search |
| Date, time, event URL | Would-write candidate |
| Supporting Claim count | Would-write row |

## Proposed candidates, verified 4 September 2026

Source: bootstrap run `onthecase-bootstrap-shadow-2026-09-04-v2`, 257 shadow would-writes, zero failures. Artists and venues checked against canonical with the search tools. Confidence is the canonical matcher's score.

| # | Candidate key suffix | Date | Time | Artist (canonical id, confidence) | Venue (canonical id, confidence) |
|---|---|---|---|---|---|
| 1 | onthecase:gig:131396 | 26/09/2026 | 21:00 | Hard River (6dffcb83, 100) | Bebside Inn (b23c91b9, 100) |
| 2 | onthecase:gig:126222 | 26/09/2026 | 21:00 | Perfect Storm (8b725158, 100) | Crown and Cannon (ed1384a2, 100) |
| 3 | onthecase:gig:131457 | 02/10/2026 | 20:00 | Pretty Weeds (f403789c, 100) | Ivy House (705142b8, 100) |
| 4 | onthecase:gig:126224 | 09/10/2026 | 21:00 | Steel Blue (1c0c24cc, 100) | Crown and Cannon (ed1384a2, 100) |
| 5 | onthecase:gig:131462 | 09/10/2026 | 20:00 | A Band Called Horse (a72ac58a, 100) | Ivy House (705142b8, 100) |
| 6 | onthecase:gig:126340 | 16/10/2026 | 21:00 | Rebel Radio (cdedd99b, 100) | Crown and Cannon (ed1384a2, 100) |
| 7 | onthecase:gig:129154 | 24/10/2026 | 20:00 | Wicked Dogz (c03a7bbe, 100) | The Prior (8ab19fad, 100) |
| 8 | onthecase:gig:131459 | 30/10/2026 | 20:00 | Brydon Trio (9638e2c5, 100) | Ivy House (705142b8, 100) |
| 9 | onthecase:gig:126016 | 25/09/2026 | 21:00 | The Flames (b840d474, 100) | The Blacksmiths Arms (10432a06, 80) |
| 10 | onthecase:gig:126486 | 30/10/2026 | 21:00 | Dakota (cb798bf5, 100) | The Blacksmiths Arms (10432a06, 80) |

Full candidate keys are `event:onthecase-gig-index:<suffix>`. Rows 9 and 10 sit at a venue the matcher scores 80; if the canonical API answers review for them, they surface as `unresolved-entity` exceptions and prove the match-only path. Rows 1 to 8 are expected to create.

Not selected, because the artist is absent from canonical: GodZZ of Wor, Midnight Echoes, Dust Raisers, Diablo, Trilogy, Proper Boys, Dreadnought, The Lost Boys, Dean Palmer, Hybrids. Those are exactly the events the pilot must not create.

## Registry change for the pilot source

One update to `SOURCE#onthecase-gig-index / CONFIG`:

```json
{
  "shadow": false,
  "writerAuthority": "aws",
  "projectionPolicy": {
    "mode": "additive-only",
    "allowedActions": ["create"],
    "allowedPredicates": ["<every predicate present on the chosen candidates, listed from a live sample at pilot time>"],
    "entityCreation": "match-only",
    "pilotCandidateKeys": ["<5 to 10 keys>"],
    "maxProjectionActionsPerRun": 400
  }
}
```

`maxProjectionActionsPerRun` must exceed the run's item count. The runner fails a whole run above the cap; it does not select from it. Selection is the allowlist's job.

## Global control

Turn on:

```json
{ "pk": "CONTROL#PROJECTION", "sk": "GLOBAL", "canonicalWritesEnabled": true, "updatedAt": "<iso>", "pilotRunId": "<reconciliation id>" }
```

Turn off, explicitly, at the end of the window or on any stop condition:

```json
{ "pk": "CONTROL#PROJECTION", "sk": "GLOBAL", "canonicalWritesEnabled": false, "updatedAt": "<iso>" }
```

The engine reads this record with a consistent read on every item. Off takes effect on the next message.

## Execution

1. Apply the registry change.
2. Turn the global control on. Record the time.
3. Send one root-only message with `reconciliationId: onthecase-pilot-<date>-v1`, `task.kind: gig-index`, `task.fanoutMode: none`.
4. Watch the `PROJECTION_RUN#<observationId>` roll-up until `itemsSeen` equals `expectedItems`.
5. Turn the global control off. Record the time.
6. Restore `shadow: true` and `writerAuthority: cowork` on the source and remove `pilotCandidateKeys`.

## Expected result

| Metric | Expected |
|---|---|
| eventsCreated | equal to the number of allowlisted candidates whose artist and venue matched |
| artistsCreated | 0 |
| venuesCreated | 0 |
| projectionFailures | 0 |
| Exceptions | only `unresolved-entity`, and only for allowlisted candidates whose entity did not match |
| Shadow items | every candidate not on the allowlist, reason `candidate is outside the pilot allowlist` |

Every created Event has been read back by the engine and checked for id, date, venue and artist membership before success is recorded.

## Stop conditions

If any of these occur, set the global control off immediately, then investigate:

- `artistsCreated` or `venuesCreated` greater than 0.
- Any `match-only-violation` exception.
- Any `projectionFailures` greater than 0.
- Any ProjectionDLQ arrival.
- Any write to a candidate not on the allowlist.

## Rollback

Each created Event id is stored on `PROJECTION#onthecase-gig-index#<candidateKey> / STATE` as `eventId`. Hide each through the curator hide endpoint, or delete through the canonical events tools. Record the action against the pilot run id. Backline Claims are retained; only the canonical projection is reversed.

## Approval

| Item | Value |
|---|---|
| Approved by | Jason, in session, 4 September 2026 |
| Date and time | 4 September 2026, about 20:20 UTC |
| Reconciliation id | onthecase-pilot-2026-09-04-v1 |
| Candidate keys | the ten rows above |
| Window start and end | opened about 20:22 UTC, closed 20:24:43 UTC |

## Outcome

| Metric | Expected | Actual |
|---|---|---|
| Items projected | 257 | 257, zero failures |
| Live path taken | 10 | 10 |
| eventsCreated | up to 8 | **0**. All five successes matched Events that Cowork imports had already created between April and August. The canonical API answered 409 and the engine recorded the existing ids. |
| artistsMatched, venuesMatched | | 5 and 5 |
| artistsCreated, venuesCreated | 0 | 0 |
| unresolved-entity exceptions | up to 2 | 5. The canonical artist matcher returned review with "near-tie margin guard" for The Flames, Rebel Radio, Hard River, Pretty Weeds and A Band Called Horse: canonical holds two near-identical artists for each name. |
| incomplete-candidate exceptions | | 3, non-approved gigs with no artist name |
| Shadow, outside allowlist | about 247 | 244 |
| Dead-letter arrivals | 0 | 0 |
| Control after window | off | off, explicit, 20:24:43 UTC |
| Source after window | shadow, cowork | shadow, cowork, allowlist removed |

What the pilot proved: the live write path executes end to end under every containment control, resolves entities match-only, detects an already-existing Event, reads it back and records the mapping, and refuses ambiguous artists instead of creating them. What it did not prove: a brand-new Event creation. The next window must use candidates that do not already exist in canonical.

What it surfaced: five artist names with near-duplicate canonical records. Those belong in the review queue before any BAU write mode.
