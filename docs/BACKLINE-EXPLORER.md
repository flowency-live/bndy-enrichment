# Backline Evidence Explorer

**Status:** v1 shipped. Workboard item: "Build the interactive Godmode evidence graph".
**Date:** 27 August 2026
**Pieces:** `src/knowledge/graph-read.ts` (bounded traversal), `src/handlers/backline-admin-api.ts` (read-only admin API, Lambda Function URL), `ops/explorer/backline-explorer.html` (self-contained graph UI).

## 1. What it is

An Obsidian-style bounded graph explorer over the knowledge substrate: Sources produce Observations, Observations assert Claims, Claims are about source-native candidates, candidates resolve to canonical entities, and support links tie claims to entities. Every click expands ONE keyed, indexed, limited neighborhood. There is no scan anywhere; the explorer stays cheap at any substrate size.

## 2. Node ref grammar

```text
source:<sourceId>
obs:<observationId>
claim:<claimId>
candidate:<subjectType>:<subjectKey>    subjectKey may itself contain colons
entity:<entityType>:<entityId>
```

Edges: PRODUCED (source to observation), ASSERTS (observation to claim), ABOUT (claim to candidate), RESOLVES_TO (candidate to entity), SUPPORTS (claim to entity), REFERENCES (candidate to candidate, from source-native IDs inside claim values, e.g. a gig's `occursAt.sourceNativeId` walking to its venue candidate).

## 3. API

Lambda Function URL (stack output `BacklineAdminApiUrl`). GET only, read-only IAM, bearer auth with the existing BNDY service token (timing-safe compare, secret `bndy/mcp-service`). `/health` is open; everything else is authenticated.

```text
GET /health
GET /sources                          known source families, live registry state
GET /graph?node=<ref>&limit=<5..200>  one bounded neighborhood
```

`/sources` deliberately reads the known family IDs by key instead of scanning the table; the registry has no list-all access pattern and this API does not add one.

## 4. Using the explorer

Open `ops/explorer/backline-explorer.html` in a browser. Paste the Function URL and the service token (stored in localStorage). Load sources, expand one, then: single click selects a node and expands it on first visit; double click re-expands; drag nodes; drag the background to pan; wheel to zoom; the side panel shows the raw node data. The "Open" box accepts any node ref, so a candidate key from a run report or probe JSON can be jumped to directly.

## 5. Godmode embedding path (follow-up, not in this change)

The page is dependency-free and iframe-safe. The bndy-backstage embedding is a follow-up: a godmode route serving this page with the Function URL and a server-held token injected, so staff never handle the token. Until then the explorer is an operator tool, same trust level as the ops workflows, and the token stays with operators.

## 6. Safety

Read-only grants only (verified in the synthesized template), no write code paths, bearer required, responses `cache-control: no-store`, bounded limits clamped 5 to 200. Shadow and canonical-write posture are untouched.
