# ADR-106: Entity Enrichment Work Items

**Status:** Accepted  
**Date:** 21 August 2026

## Context

The legacy Google discovery worker can write review metadata directly into BNDY domain tables. That is useful as-built behaviour but is not the target write path. New entity creation during projection still needs enrichment without coupling the ProjectionWorker to model calls or resurrecting direct DynamoDB domain writes.

## Decision

When projection creates a canonical Artist or Venue it emits one `EntityEnrichmentWorkItem` to `EntityEnrichmentQueue`.

The work item identifies:

- entity type and canonical entity id;
- reason;
- source and observation provenance;
- optional discovery budget.

Projection does not call Gemini, search or enrichment inline. It completes the canonical event projection independently.

The target enrichment consumer will:

1. gather evidence through WP-15 provider/routing;
2. persist Observations, Extractions/Interpretations and Claims;
3. reconcile accepted facts;
4. project accepted changes through canonical BNDY APIs.

It must not directly mutate `bndy-artists` or `bndy-venues` as target behaviour.

## Migration

`GoogleDiscoveryWorker` remains a legacy runtime until its migration package replaces its direct-write path. The new `EntityEnrichmentQueue` is the strategic seam; newly migrated source projection emits only the new work item.

## Consequences

- event projection latency and retries are isolated from AI/search latency;
- expensive model work can be budgeted and retried independently;
- the same evidence/claim model applies to source ingestion and entity enrichment;
- removal of the legacy Google direct-write path does not change ProjectionWorker.
