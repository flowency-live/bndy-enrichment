# ADR-110: Source Registry Ownership

**Status:** Accepted  
**Date:** 20 August 2026

## Context

BNDY has both executable source configuration and entity-level convenience fields such as a Venue gig-source reference. If both can independently own fields such as URL, enabled state, schedule, mode or health, the platform immediately recreates a two-sources-of-truth problem.

Source scheduling also cannot be modelled correctly as one fixed UTC cron because source schedules are local-time schedules and must remain stable across BST/GMT changes.

## Decision

The Source Registry in the enrichment knowledge substrate is the canonical command/configuration truth for every Gig Source.

A source CONFIG record owns:

- source identity and adapter;
- URL / linked entity;
- timezone, cadence and local time;
- mode and snapshot semantics;
- runtime class;
- authority class and thresholds;
- enabled/shadow/writerAuthority;
- nextScanAt and scheduling health/state references.

Entity-level fields such as `venue.gigSource` are read projections/references only. They may expose sourceId, URL or health for product UX, but they do not independently control execution.

Any future configuration API must upsert the Source Registry through one canonical source-management path and only then update any read projection. It must never write the same executable configuration independently into a Venue or Artist record.

Scheduling uses one EventBridge tick and a due-source GSI. The dispatcher queries `nextScanAt <= now`, routes the source to the queue implied by `runtimeClass`, and compare-and-swap advances `nextScanAt` using the source timezone, cadence and local time.

Manual scans enqueue work. They do not synchronously acquire a source and they do not alter the recurring schedule.

Only an authorised operator changes `enabled`, `shadow` or `writerAuthority`. Bootstrap source records are disabled, shadowed and Cowork-owned.

## Consequences

- all source types share one scalable scheduling model;
- UK local schedules remain stable across BST/GMT;
- browser acquisition remains isolated from standard workers;
- adding Venue-owned Gig Sources does not create a second scheduler/config store;
- a future source-management UI has one write target;
- source configuration can be projected into entity UX without becoming authority there.
