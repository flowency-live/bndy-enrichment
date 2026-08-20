# ADR-101: Repository Consolidation

**Status:** Accepted  
**Date:** 20 August 2026

## Context

BNDY currently has overlapping intelligence/source-ingestion capabilities across `bndy-enrichment` and `bndy-signals`.

`bndy-signals` contains valuable implementation work, especially the Source Runner, source adapters, signal/evidence concepts, interpretation types, cost controls and Chromium acquisition support.

`bndy-enrichment` contains the current operational enrichment runtime, Capture ingestion, Gemini/Google grounding, multimodal poster processing and the current production BNDY API client.

Keeping both repositories as strategic runtimes would create duplicate schemas, duplicate source state and competing target architectures.

## Decision

`flowency-live/bndy-enrichment` is the single strategic runtime for BNDY enrichment, source ingestion, observations, claims, reconciliation and future graph capabilities.

`flowency-live/bndy-signals` is a donor/migration repository. Proven concepts, adapters, tests and selected runtime components are ported into `bndy-enrichment` according to `docs/TARGET-ARCHITECTURE.md` and `docs/BUILD-PLAN.md`.

After migration parity is proven and no production dependency remains, `bndy-signals` will be archived/read-only.

The authoritative target architecture is:

```text
bndy-enrichment/docs/TARGET-ARCHITECTURE.md
```

Visual companion material such as `docs/INTELLIGENCE-GRAPH.md` is explanatory only and must not override the target architecture.

## Consequences

- New strategic intelligence/source code is added to `bndy-enrichment` only.
- Shared schemas have one canonical home in `bndy-enrichment`.
- Existing `bndy-signals` source adapters are ported rather than rewritten where practical.
- Separate `bndy-signals` state/evidence infrastructure is retired after validated migration.
- Canonical Artist/Venue/Event mutations continue through BNDY domain APIs.
- Human handling becomes exception-only in the target runtime.

## Supersedes

This ADR supersedes any earlier ADR or design note that names `bndy-signals` as the canonical intelligence runtime or establishes a permanent bridge between two strategic runtimes.
