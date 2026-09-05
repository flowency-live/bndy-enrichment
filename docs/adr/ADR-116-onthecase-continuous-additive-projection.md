# ADR-116: Continuous Additive-Only Projection for OnTheCase

**Status:** Accepted  
**Date:** 4 September 2026

## Context

The pilot `onthecase-pilot-2026-09-04-v1` ran the live write path for ten named candidates under every containment control. It matched five existing Events, created nothing, created no artist or venue, and refused five ambiguous artists. Canonical already holds every OnTheCase gig at the verified venues, imported nightly by the Cowork runner that Jason paused on 4 September.

Backline's hourly OnTheCase acquisition found eight new gigs on the afternoon of 4 September. With the Cowork runner paused, nothing else will bring new OnTheCase gigs into bndy.

## Decision

In the context of a proven live write path and a paused nightly importer, facing new OnTheCase gigs that would otherwise never reach bndy, we decided to leave the global projection control on with `onthecase-gig-index` live under `mode: additive-only`, `allowedActions: [create]`, `entityCreation: match-only` and no candidate allowlist, and neglected per-run human approval, to achieve new gigs for already-known artists and venues appearing in bndy within the hour, accepting that Backline is now a continuous writer for one source and that ambiguous or unknown entities accumulate as exceptions for human review rather than as records.

## Guards that remain in force

- The runbook refuses to open the global control unless `onthecase-gig-index` is the only live source.
- Artists and venues are never created by projection. A review answer from the canonical matcher is an exception.
- Updates, cancellations and withdrawals are blocked by the additive-only mode.
- Owner-managed Events are protected by the authority policy.
- Every created Event is read back before success is recorded.
- The stop action is unchanged: `close` sets the control off and takes effect on the next message.

## Consequences

- OnTheCase becomes the first source where Backline is the writer of record. The Cowork OnTheCase importer is decommissioned after 48 clean hours.
- Godmode must show created Events and exceptions per hour; the operations route already returns both.
- Any second source goes through its own bounded pilot before joining.
