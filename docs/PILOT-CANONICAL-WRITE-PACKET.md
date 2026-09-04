# Canonical-Write Pilot Packet

**Status:** Draft for human approval. Nothing in this document is authorised until Jason signs the approval block.
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
| Approved by | |
| Date and time | |
| Reconciliation id | |
| Candidate keys | |
| Window start and end | |
