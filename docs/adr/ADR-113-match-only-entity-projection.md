# ADR-113: Match-Only Entity Projection Policy

**Status:** Accepted  
**Date:** 4 September 2026

## Context

Event projection resolves its artist and venue through the canonical find-or-create endpoints. Those endpoints create a record when no confident match exists. The first canonical-write pilot must add events only for artists and venues that already exist, and must never create either as a side effect.

The canonical API already supports this boundary. ADR-021 in bndy-serverless-api defines `canCreate: false`, which answers `action: 'review'` instead of creating. Until now the projection client sent no flag and turned any review answer into a generic error, which SQS retried into the dead-letter queue.

## Decision

In the context of the additive-only canonical-write pilot, facing implicit artist and venue creation inside event projection, we decided to add an `entityCreation: 'match-only'` projection policy that sends `canCreate: false` and records a review answer as a handled `unresolved-entity` exception, and neglected a separate lookup endpoint or a per-entity-type projection switch, to achieve a pilot that can only ever write events against already-resolved entities with the matching logic kept in one place, accepting that unmatched events surface as exceptions for a human rather than as canonical records.

## Consequences

- Default policy is unchanged: `canCreate: true` is sent explicitly and entity creation still happens for sources that allow it.
- A review answer is a decision, not a fault. It never retries and never reaches the dead-letter queue.
- If the canonical API ever creates an entity despite `canCreate: false`, projection records a `match-only-violation` exception and does not proceed.
- The pilot source policy is `mode: additive-only`, `allowedActions: [create]`, `entityCreation: match-only`.
