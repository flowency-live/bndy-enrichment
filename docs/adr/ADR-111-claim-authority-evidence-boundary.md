# ADR-111: Claim Authority Evidence Boundary

**Status:** Accepted  
**Date:** 29 August 2026

## Context

Claim V2 in BNDY now separates authentication from authority. A signed-in person can request a relationship with an Artist or Venue and provide manual or machine-verifiable evidence. Backline already has a durable evidence graph for factual claims about Artists, Venues and Events.

Those are related but they are not the same thing.

A statement such as "this venue is in Manchester" is a factual knowledge claim. A statement such as "this BNDY user is authorised to manage this venue" is an access-authority decision about a person. Treating the latter as an ordinary Backline `KnowledgeClaim` would mix identity/permission data into the public factual evidence substrate, encourage accidental projection, and duplicate potentially sensitive free-text evidence.

## Decision

Claim authority evidence remains a distinct domain from factual `KnowledgeClaim` evidence.

Backline may retain a **privacy-minimised authority assertion** for provenance and intelligence, but it must not retain the raw Claim V2 submission.

The Backline authority assertion may contain:

- Claim request ID and evidence revision number;
- canonical entity type and ID;
- opaque BNDY user reference, never email, display name or social identity;
- requested relationship and role;
- verification method;
- lifecycle/outcome status;
- booleans indicating which evidence classes were supplied;
- public supporting URL when the claimant explicitly supplied one;
- verified public Facebook Page identity when Page-control verification exists;
- conflict signal and timestamps.

It must not contain:

- manual free-text explanation;
- official/contact email address;
- authentication tokens or provider credentials;
- reviewer identity;
- private Facebook account identity;
- copied profile data that is not already public entity evidence.

### Separation from factual knowledge

Authority assertions are not written through `ClaimStore`, do not use `KnowledgeClaimSchema`, and are never eligible for canonical fact projection.

An approved or verified authority assertion can later affect Backline weighting as an **authority signal**. For example, facts explicitly supplied by a verified Artist representative can be treated as owner-authority evidence. That future weighting step must reference the authority assertion by ID rather than copying claimant evidence into each factual claim.

### Source of truth

BNDY remains the source of truth for access control and membership. Backline is a provenance/intelligence consumer only. Deleting or revoking a BNDY relationship must not depend on Backline availability.

### Transport

The initial implementation defines the contract and privacy-safe mapper only. Production transport from the Claim API into Backline must be authenticated, idempotent and asynchronous. It must not add latency or a hard dependency to the Claim approval path.

## Consequences

- Claim V2 can contribute high-quality owner/representative authority to Backline without leaking raw claimant evidence into the factual graph.
- Facebook Page control can become a strong authority signal while ordinary Facebook Login remains only an identity signal.
- A person can legitimately hold relationships with many Artists/Venues without creating duplicate identity records in Backline.
- Human-review outcomes remain explainable and auditable without turning Backline into an access-control database.
- Canonical projection remains protected from accidental user-identity writes.
