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

The consumer is delivered in explicit safety stages:

1. **Evidence-only processor:** one canonical entity per item, hard per-item budget caps, daily provider reservation, immutable raw evidence, canonical-subject Claims, no canonical writes.
2. **Provider qualification:** fixture and sampled live runs prove identity matching, safe abstention, citation quality, conflict rates and cost before scheduling. The default cohort contains at least 20 cases, including at least five Artists, five Venues and two deliberately ambiguous cases of each entity type. A provider fails if it enriches any expected-park identity or parks any expected match. Predicate coverage is measured only for expected matches, so the gate never rewards fabricating facts for an ambiguous identity.
3. **Prioritised planner:** selects entities attached to upcoming gigs and explicit quality gaps, with separate daily Artist/Venue/provider budgets. It must query an indexed due set rather than scan the corpus.
4. **Human sanity gate:** every identity below 0.98 is parked, all owner-managed fields and conflicts require review, and a sample of otherwise clean runs is reviewed before projection is considered.
5. **Controlled projection:** remains a later decision and uses canonical APIs with read-back. It is not enabled by deploying the worker.

Initial per-entity ceilings are one entity, three searches, six fetches, one non-expensive model call, 12,000 input tokens, 2,000 output tokens, an estimated cost of 0.03 and a 60-second deadline. Lower item budgets are honoured; higher requested budgets are capped.

Initial daily provider ceilings are 20 entities, 60 searches, 120 fetches, 20 model calls, 240,000 input tokens, 40,000 output tokens and estimated cost 0.60. DynamoDB reserves all counters and the work-item idempotency record in one transaction before any provider call. Failed attempts keep their reservation, and a retry resumes the same item without spending the budget twice. Budget exhaustion is a terminal parked outcome for that item; a later planner run may create a new item on a later day.

The first external provider seam uses at most two identity-and-location searches followed by one cheap reasoning call. It accepts only requested predicates and HTTPS citations returned by those searches, records the complete search/reasoner payload and measured usage, and fails if the reserved item budget is exceeded. The seam has no credentials, Lambda or schedule until a concrete provider passes the adversarial qualification cohort and sampled live review.

## Migration

`GoogleDiscoveryWorker` remains a legacy runtime until its migration package replaces its direct-write path. The new `EntityEnrichmentQueue` is the strategic seam; newly migrated source projection emits only the new work item.

## Consequences

- event projection latency and retries are isolated from AI/search latency;
- expensive model work can be budgeted and retried independently;
- the same evidence/claim model applies to source ingestion and entity enrichment;
- removal of the legacy Google direct-write path does not change ProjectionWorker.
