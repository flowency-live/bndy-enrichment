# ADR-108: Durable Knowledge Substrate and Capture-Before-Prune

**Status:** Accepted  
**Date:** 20 August 2026

## Context

BNDY is moving from importer-oriented state into a durable evidence and claim model. Artist, Venue and Event records remain operational product projections, but they are not sufficient to explain why BNDY believes a fact, how that belief changed, or which source asserted it.

A future graph database may make traversal and inference easier, but it must not become the only copy of evidence or silently replace the durable knowledge record.

## Decision

The durable knowledge substrate is the system of record for enrichment/source knowledge:

- immutable raw source evidence in the existing EvidenceBucket;
- immutable SourceObservations;
- single-copy KnowledgeClaims;
- durable resolutions and canonical-support links;
- lifecycle-aware Tombstones;
- later, versioned Extractions, Interpretations and EvidencePacks using the same single-copy principle.

Artist, Venue and Event domain records are materialised product projections of that knowledge and continue to be mutated only through canonical BNDY APIs.

Claims are stored once at `CLAIM#<claimId>` and are reached through GSIs and lightweight support-link records. Access patterns must never be implemented by duplicating Claim payloads into multiple partitions.

Raw evidence objects are immutable. S3 writes use a write-once key and conditional creation. Dynamo knowledge records that represent historical evidence or claims use conditional creation where applicable.

The existing StateTable and EvidenceBucket are retained. A new knowledge database requires a separate ADR proving an access-pattern need.

A future Neptune graph is initially a projection/index over this substrate, not an authority replacement.

## Capture-before-prune rule

Before any legacy evidence/state path is removed, all knowledge required to explain or reconstruct the current projection must first exist in the durable substrate or be explicitly declared non-authoritative and disposable.

## Consequences

- historical source evidence survives product projection changes;
- BNDY can later re-run interpretation against old evidence with better models;
- graph visualisation and Neptune projection can be rebuilt from durable records;
- canonical product records remain fast and operationally simple;
- storage growth is intentional and controlled through evidence lifecycle policy, not destructive loss of provenance.
