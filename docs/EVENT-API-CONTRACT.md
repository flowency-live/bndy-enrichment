# Canonical Event Mutation Contract

**Verified by:** `bndy-serverless-api` WP-05A PR #6, merged 20 August 2026.  
**Consumer:** `bndy-enrichment` ProjectionWorker.

## Service authentication

Mutation routes use:

```http
Authorization: Bearer <MCP_SERVICE_TOKEN>
```

Secret: `bndy/mcp-service` (`token` field).

## Routes

| Operation | Route | Projection use |
|---|---|---|
| Create | `POST /api/events/community` | canonical create / duplicate sentinel |
| Read | `GET /api/events/{id}/mcp` | mandatory read-back verification |
| Read external id | `GET /api/events/by-external-id?source=&id=` | recovery fallback only; current implementation scans |
| Update | `PUT /api/events/{id}/mcp` | event field/externalId updates |
| Delete | `DELETE /api/events/{id}/mcp` | available but not normal reconciliation behaviour |
| Cancel | `POST /api/curator/events/{id}/cancel` | explicit cancellation Claim |
| Uncancel | `POST /api/curator/events/{id}/uncancel` | authorised reinstatement |
| Hide | `POST /api/curator/events/{id}/hide` | qualified source withdrawal |
| Restore | `POST /api/curator/events/{id}/restore` | authorised reinstatement |

The lifecycle routes accept either curator/staff cookie auth or the MCP bearer. An invalid bearer returns 401 and never falls through to cookie auth.

## Create contract

Required:

```text
venueId
date
startTime
artistId / artistIds[] (unless open mic)
```

Projection sends:

```text
source = <GigSource.id>
externalIds = [{source:<GigSource.id>, id:<sourceEventKey>}]
```

`201` returns the created event id. `409` duplicate responses return `existingEventId`; ProjectionWorker treats that as a successful canonical match, not an error.

The existing artist+venue+date sentinel remains a **product projection constraint**, not universal event identity.

## Update contract

`PUT /api/events/{id}/mcp` accepts event identity/details including artist, venue, date/time, title, ticket fields, event URL and `externalIds`. Identity changes re-run duplicate enforcement.

ProjectionWorker MUST merge its source external id with existing `externalIds`; it must not replace another source's provenance.

## Cancellation versus withdrawal

These are deliberately different.

### Explicit source cancellation

```text
Claim: hasStatus = cancelled
→ AuthorityPolicy
→ POST .../cancel
→ read back cancelled=true
→ active tombstone
```

The Event remains visible as cancelled.

### Absence from a qualifying complete snapshot

```text
ADR-104 withdrawal
→ AuthorityPolicy
→ POST .../hide
→ read back isPublic=false
→ ClaimWithdrawal + active tombstone
```

Absence is not represented as explicit cancellation.

## Owner-managed protection

The API currently has no record-level MCP owner lock. An Event with `membershipId != null` or `verifiedByArtist: true` can technically be mutated by MCP.

Therefore ProjectionWorker MUST enforce ADR-109 before source-driven mutation/destruction. A lower-authority source may support/match an owner-managed Event but must not mutate it.

## Read-back rule

Every successful write is verified with `GET /api/events/{id}/mcp`.

- create/update: expected id, artist, venue and date must match;
- cancel: `cancelled === true`;
- hide: `isPublic === false`;
- restore/uncancel: state is re-read before projection completes.

A verification failure fails that SQS message only. It retries independently and can reach ProjectionDLQ without replaying other items.
