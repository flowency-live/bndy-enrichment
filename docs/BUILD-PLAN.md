# BNDY Consolidated Build Plan

**Status:** Active execution plan, v1.1
**Date:** 20 August 2026 (v1.0 same day; v1.1 incorporates the independent architecture review, all 18 points accepted)
**Owner:** CTO (Cowork)
**Authority:** This plan executes `docs/TARGET-ARCHITECTURE.md` (the v2 architecture paper, sections 1 to 71). If this plan and that paper conflict, the paper wins on architecture and this plan wins on sequence and scope.

---

## 1. Objective

Move the scheduled source importers off Cowork and into AWS `bndy-enrichment`, in **dual mode**:

1. Every run records immutable Observations and Claims. This builds the intelligence layer substrate.
2. Every run still projects new events, changes and cancellations into existing bndy production records through the canonical APIs, with full enrichment of new artists and venues.

One runtime. One repo. No parallel strategic platform. Exactly one system holds projection authority for a source at any time.

---

## 2. Decisions in force

These are made. Do not reopen them in a PR.

| ID | Decision | Recorded |
|---|---|---|
| D1 | Sources emit claims, not CRUD commands | TARGET-ARCHITECTURE §56 |
| D2 | Existing BNDY APIs remain the only write authority | TARGET-ARCHITECTURE §56 |
| D3 | Venue website is a first-class Gig Source | TARGET-ARCHITECTURE §56 |
| D4 | Graph-ready model now, graph database later | TARGET-ARCHITECTURE §56 |
| D5 | BNDY domain tables remain materialised projections | TARGET-ARCHITECTURE §56 |
| D6 | Raw evidence is retained in S3 | TARGET-ARCHITECTURE §56 |
| D7 | Source authority is predicate-specific. A minimum deterministic AuthorityPolicy ships in WP-05, before any source writes | TARGET-ARCHITECTURE §56, review §9 |
| D8 | Cancellation creates durable knowledge (tombstones, withdrawals) | TARGET-ARCHITECTURE §56 |
| D9 | Source expansion is budget-bounded | TARGET-ARCHITECTURE §56 |
| D10 | `bndy-enrichment` is the single strategic runtime. `bndy-signals` is a donor repo, mined then archived | TARGET-ARCHITECTURE §59 |
| D11 | Port / merge / retire per the matrix | TARGET-ARCHITECTURE §66 |
| D12 | Human handling is exception-only. Review Queue becomes Exception Queue | TARGET-ARCHITECTURE §65 |
| D13 | Cancellation, interim vs target: TARGET is an explicit cancelled state on the Event (WP-17). INTERIM dual-mode behaviour is API delete plus a durable tombstone. Claims and Observations are never deleted. WP-17 later reprojects tombstoned cancellations as status=cancelled | Jason 2026-08-20, review §10 |
| D14 | Wave 1 sources: GigsNews, KLMA Stoke, OnTheCase, ScenicEye (ports) plus insangel (new adapter, deterministic-only). Spider and hourly bv2a-enrichment stay on Cowork for now | Jason, 2026-08-20 |
| D15 | Deploy flow: agents send PRs, Jason merges and deploys locally with `npm run deploy`. GitHub OIDC auto-deploy is WP-13, not a blocker | Jason, 2026-08-20 |
| D16 | Entity identity lives on the canonical bndy entity (google_place_id, externalIds[], nameVariants[]), learned once, shared across all sources. Per-source alias files are bootstrap seeds only | Vault ADR, 2026-06-13 |
| D17 | **The durable knowledge substrate is truth:** immutable Observations, Claims, Resolutions, Tombstones and supporting evidence are durable and must survive projection changes. Artist/Venue/Event product records are materialised projections and may be rebuilt only where stable canonical IDs and external references are preserved. A future graph database is a projection/index of that substrate unless an ADR changes authority. Capture before prune | Vault ADR-022, reworded per review §15 |
| D18 | The Source Registry is the canonical executable source configuration. Entity-level fields such as `venue.gigSource` are read projections only | Review §6, accepted 2026-08-20 |
| D19 | Single-writer cutover: shadow parity first, then one ownership transition per source (`writerAuthority: cowork | aws`). Never both writing production | Review §18, accepted 2026-08-20 |
| D20 | artist+venue+date is the **current BNDY projection sentinel**, not the permanent knowledge-layer identity rule. Candidates and claims always keep sourceEventKey, native ID, time, event URL and festival/stage identity | Review §16, accepted 2026-08-20 |

## 3. New ADRs to write

Each ADR is a short file in `bndy-enrichment/docs/adr/`. The owning WP writes it in the same PR as the code.

| ADR | Decision to record | Owning WP |
|---|---|---|
| ADR-101 | Repository consolidation: enrichment canonical, signals donor, supersedes the signals ADR that named bndy-signals the canonical runtime and the ADR-016 bridge | WP-00 |
| ADR-102 | Dual-mode operation: claims always recorded, canonical projection always executed, until the reconciliation layer is proven and made authoritative | WP-05 |
| ADR-103 | Cancellation and tombstones: interim API delete plus durable tombstone; tombstone lifecycle `active | superseded | reinstated`; a fresh explicit artist-owned or venue-owned reinstatement supersedes an active tombstone; never TTL as the primary mechanism (D13, review §11) | WP-05 |
| ADR-104 | Source modes: `mode: delta | append-only` and `snapshotSemantics: complete | incremental | one_shot` both retained, enforced in code | WP-04 |
| ADR-105 | Model provider abstraction and routing: Gemini primary (grounding, multimodal), Bedrock Claude alternate, deterministic first | WP-15 |
| ADR-106 | Entity enrichment on create: newly created artists/venues enqueue an `EntityEnrichmentWorkItem`. The worker reuses the existing Gemini/Google discovery libraries but writes Observations/Claims and projects accepted fields through canonical BNDY APIs. The legacy GoogleDiscoveryWorker may serve only as a flagged temporary bridge (`TEMPORARY_BRIDGE=true`) with a removal criterion in the same WP. It is not a target dependency (review §4) | WP-05 |
| ADR-107 | Exception Queue: exception-only human handling, replaces review-by-default and ParkingLot | WP-14 |
| ADR-108 | Durable knowledge substrate and capture-before-prune (D17) | WP-02 |
| ADR-109 | Minimum deterministic AuthorityPolicy: explicit authority classes (owner, artist-owned, venue-owned, official-ticket, curated, aggregator, capture); destructive rule: a lower-authority source may not delete or withdraw a canonical event while a fresh higher-authority claim still supports it (freshness window defined in the ADR) | WP-05 |
| ADR-110 | Source Registry ownership (D18): registry is command/config truth; entity fields are projections; any config API upserts the registry, never a second store | WP-03 |

---

## 4. Dual mode contract

This is the behaviour every source run must satisfy. It is the heart of the plan.

```text
SourceScanQueue (or BrowserScanQueue)
→ SourceWorker: fetch source
→ store raw snapshot in S3 (immutable Observation, completeness flag)
→ parse + normalise (deterministic, adapter-owned)
→ emit Claims (subject/predicate/value, provenance, confidence)
→ diff against previous complete observation
→ emit ONE ProjectionWorkItem per candidate/event change → ProjectionQueue
→ ProjectionWorker per item:
     resolve artist (find-or-create), venue (find-or-create), event (artist+venue+date sentinel)
     evaluate AuthorityPolicy (ADR-109)
     check tombstones (lifecycle-aware, ADR-103) before any create
     project through canonical APIs:
       new event        → POST /api/events/community
       changed event    → update route (verified by WP-05A)
       cancelled/withdrawn (delta, complete capture, authority passed)
                        → delete/hide route (verified by WP-05A) + write tombstone
       new artist/venue → find-or-create, then EntityEnrichmentWorkItem (ADR-106)
     read back and verify the write
→ ProjectionRun report + metrics
```

Projection message idempotency key: `sourceId + observationId + candidateKey + projectionAction`.

Incomplete observations (`complete: false`):

1. Additions supported by positive evidence MAY be claimed and projected.
2. Updates supported by explicit positive evidence MAY be projected.
3. Disappearance MUST NOT produce a ClaimWithdrawal.
4. Cancellation requires an explicit cancellation claim, not absence.
5. The prior complete snapshot remains the cancellation baseline.

Rules that are not negotiable:

1. A write is not trusted until read back.
2. Never create a duplicate venue. Venue resolution delegates to `POST /api/venues/find-or-create` (the L1 to L3.5 ladder, full-address geocoding). Do not reimplement it.
3. Never guess a venue address. Unresolvable venues go to the Exception Queue.
4. Only Jason enables, disables or creates schedules, sources or writer authority, in AWS or in Cowork.
5. Owner-managed records outrank automated claims.
6. Artist bios are verbatim evidence, never generated prose.
7. A lower-authority source never destroys what a fresh higher-authority claim supports (ADR-109).
8. Exactly one writer per source (D19).

---

## 5. Work package index

All packages target `flowency-live/bndy-enrichment` unless stated. Branch naming: `wp-XX-slug`. Every PR: `npm run build && npm run test && npm run check && npm run synth` green, plus the ADR if the package owns one.

| WP | Title | Depends on | Size | Parallel-safe |
|---|---|---|---|---|
| 00 | Docs authority + ADR register | none | S | done |
| 01 | Canonical knowledge types | 00 | M | yes |
| 02 | Knowledge stores (DDB + S3) | 01 | M | after 01 |
| 03 | Source Registry + scheduler + queues (CDK) | 01, 02 | M | after 02 |
| 04 | Source Runner runtime + acquisition router | 01, 02, 03 | L | after 03 |
| 05 | Projection engine + authority policy | 02, 04 | L | after 04 |
| 05A | Canonical Event mutation API preflight (bndy-serverless-api) | none (start immediately) | M | yes |
| 06 | GigsNews adapter port (browser) | 04 | M | yes, with 07-10 |
| 07 | KLMA Stoke adapter port | 04 | M | yes |
| 08 | OnTheCase adapter port (browser) | 04 | M | yes |
| 09 | ScenicEye adapter port (browser) | 04 | M | yes |
| 10 | insangel adapter (new, deterministic-only) | 04 | M | yes |
| 11 | Parity gates + single-writer cutover | 05, 05A, one adapter | M | per source |
| 12 | Observability: metrics, alarms, run reports | 03, 05 | S | yes |
| 13 | GitHub OIDC deploy | none | S | yes |
| 14 | Exception Queue | 02 | M | yes |
| 15 | Intelligence layer: providers, budgets, cache, Extraction/Interpretation/EvidencePack persistence | 01, 02, 05 | L | yes |
| 16 | Venue Gig Source (Fishpond pilot) + registry sync | 03, 04, 05 | L | after wave 1 |
| 17 | Cancelled product state (deferred) | 05 | M | deferred |
| 18 | Capture convergence onto Observation/Claim pipeline | 01, 02, 05, 15 | L | after wave 1 |
| 19 | Storage migration + archive bndy-signals | 18 + all wave 1 live | M | last |

Critical path to first AWS source in production: **00 → 01 → 02 → 03 → 04 → 05 → 06 → 11**, with **05A in parallel from day one** (it gates production cancellation, not development).

---

## 6. Work packages

### WP-00. Docs authority + ADR register

Done 2026-08-20: `docs/TARGET-ARCHITECTURE.md` (authority declaration + §71 corrections), `docs/BUILD-PLAN.md` (this file), migration notice in `bndy-signals/README.md`. Remaining item: `docs/adr/ADR-101-repository-consolidation.md` lands with the first code PR.

### WP-01. Canonical knowledge types

**Goal:** one schema home for the knowledge model.

**Inputs to read:** TARGET-ARCHITECTURE §4, §11, §12, §13, §19, §52, §60, §61, §71; `bndy-signals/src/source-runner/types.ts`; `bndy-signals/src/intelligence/types.ts`; `bndy-enrichment/src/domain/schema.ts`.

**Deliverables:** `src/knowledge/types.ts` + Zod schemas + unit tests:

- `GigSource` (§52 merged with signals `SourceConfig`): keep `mode` AND `snapshotSemantics`, region/timezone, cadence, localTime, thresholds, authorityClass, linked entity, adapter, health, plus `enabled`, `shadow`, `writerAuthority: 'cowork' | 'aws'`, `runtimeClass: 'standard' | 'browser'`, `nextScanAt`, `lastScheduledAt`
- `SourceObservation` (§52, completeness fields from §19)
- `KnowledgeClaim` (§52), `EventClaimBundle` (§12)
- `EntityCandidate`, `EventCandidate` (ported concepts, simplified per §60; candidates always retain sourceEventKey, native ID, time, event URL, festival/stage identity per D20)
- `Extraction`, `Interpretation` (versioned), `EvidencePack` (types land now, persistence and use owned by WP-15; declared here so no agent invents parallel shapes)
- `EntityResolution` (§52)
- `Tombstone` (ADR-103 lifecycle: status, reason, authorityClass, sourceId, claimId, observationId, supersededAt, supersededByClaimId)
- `ClaimWithdrawal` (§21.2)
- `DiscoveryBudget` (§62)
- `ProjectionRun` (§47), `ProjectionWorkItem` (idempotency key fields), `EntityEnrichmentWorkItem`

**Rules:** plain data, no I/O. Stable source identity ladder from §13. Predicate names from §11.2.

**Acceptance:** types compile, Zod round-trips fixture objects, tests pass.

### WP-02. Knowledge stores

**Goal:** durable observation, claim, tombstone, registry and source state storage.

**Inputs:** TARGET-ARCHITECTURE §10, §20, §28.1, §53, §71C; port `bndy-signals/src/source-runner/storage/DynamoSourceStateStore.ts`, `S3SourceRunStorage.ts`, `S3RunLifecycleStore.ts` with their tests.

**Deliverables:** `src/knowledge/stores/` with:

- `SourceRegistryStore` (`PK SOURCE#<id> SK CONFIG`) plus the due-source GSI: `GSI_SCHEDULE_PK = SOURCE_SCHEDULE`, `GSI_SCHEDULE_SK = <nextScanAt>#<sourceId>`. The dispatcher must query due sources, never scan.
- `SourceStateStore` (`SK STATE`, ported)
- `ObservationStore` (DDB index rows + S3 payloads per §10.1 layout in the existing EvidenceBucket)
- `ClaimStore`, **single-copy design (§71C)**: each Claim stored once at `PK CLAIM#<claimId> SK META`, with `GSI1PK OBS#<observationId>` and `GSI2PK SUBJECT#<subjectType>#<subjectKey>`. Canonical entity support uses lightweight immutable link records (`PK ENTITY#<type>#<id> SK SUPPORT#<claimId>`, holding claimId only). Never a second copy of the Claim. Same principle for Interpretations and EvidencePacks.
- `TombstoneStore` (`PK TOMBSTONE#<artistId>#<venueId>#<date> SK META`, lifecycle fields per ADR-103)

Targets the existing `StateTable`. No new table unless an access pattern fails, and then only by ADR.

**Rules:** S3 objects are immutable. ADR-108 in this PR. Removal policies RETAIN.

**Acceptance:** ported tests pass, new store tests pass against local DynamoDB mock including a due-source query and a claim-support link lookup, `cdk synth` unchanged except IAM grants and the GSI.

### WP-03. Source Registry + scheduler + queues

**Goal:** one registry and one scalable, timezone-correct dispatch model for all source types (ADR-110 in this PR).

**Inputs:** TARGET-ARCHITECTURE §7, §8, §35, §71D, §71E, §71G; review §7, §12; `src/handlers/scan-planner.ts` as the cautionary example (its scheduled rule sends an empty entity list; the dispatcher must enumerate the registry).

**Deliverables:**

- CDK: `SourceScanQueue` + DLQ, `BrowserScanQueue` + DLQ, `ProjectionQueue` + DLQ (all: batch 1, max receives 3, DLQ retention 14 days; visibility 15 min for scan queues, 5 min for projection), `SourceDispatcher` Lambda, one EventBridge **tick every 15 minutes**.
- `src/handlers/source-dispatcher.ts`: query the due-source GSI for `nextScanAt <= now`, enqueue `{sourceId, reason, requestedAt}` to the queue matching the source `runtimeClass`, atomically advance `nextScanAt` (timezone-aware from `timezone` + `cadence` + `localTime`; BST/GMT correct by construction).
- Manual scan: admin-invokable enqueue of `{sourceId, reason: "manual"}`. Never synchronous scan execution.
- Seed script for wave 1 CONFIG records: `enabled: false`, `shadow: true`, `writerAuthority: "cowork"`, schedules mirroring today's Cowork local times, `runtimeClass: "browser"` for GigsNews, OnTheCase, ScenicEye.

**Rules:** dispatcher never scans a table and never performs acquisition. Sources seed disabled. Only Jason flips `enabled`, `shadow`, `writerAuthority`.

**Acceptance:** dispatcher test enumerates a fixture registry via the GSI, routes standard vs browser correctly, advances `nextScanAt` across a BST/GMT boundary correctly. Synth shows three queues + tick + Lambda.

### WP-04. Source Runner runtime + acquisition router

**Goal:** the generic run orchestration in `SourceWorker` (standard) and `BrowserSourceWorker` (Chromium, 2048 MB+), consuming their queues.

**Inputs:** TARGET-ARCHITECTURE §61, §63, §71G; port from `bndy-signals/src/source-runner/`: `runner.ts` (+tests), `adapter/SourceAdapter.ts` (+tests), `diff/diffEvents.ts` (+tests), `normalisation/` (+tests), `config/loadSourceConfig.ts`, `runtime/createDependencies.ts`. Do NOT port `lambda/*-handler.ts` (retired pattern).

**Deliverables:**

- `src/sources/runner/` orchestration: load_config, start_run, fetch_source, store_snapshot, parse_source, store_normalised, load_previous, diff_events, store_diff, persist_state, generate_report, complete_run.
- Output seam: normalised items → Observation + Claims (WP-01 types, WP-02 stores) → **one `ProjectionWorkItem` per candidate/event change onto `ProjectionQueue`** (review §3). The runner never projects in-process.
- `src/handlers/source-worker.ts` + `src/handlers/browser-source-worker.ts`. Chromium (`@sparticuz/chromium` + `puppeteer-core`) bundles ONLY into the browser worker.
- `SnapshotSemantics` + `mode` enforcement (ADR-104 in this PR), including the incomplete-observation rules from section 4.

**Rules:** dependency injection retained. Fetch layer keeps SSRF guards (§45): http/https only, no private IPs, response caps, timeouts.

**Acceptance:** ported runner tests pass. A fixture adapter runs end to end against mocked stores and produces Observation, Claims, diff, ProjectionWorkItems and a run report. An incomplete fixture capture produces additions but zero withdrawals.

### WP-05. Projection engine + authority policy

**Goal:** `ProjectionWorker` turns work items into bndy production records, with authority checks, tombstones, enrichment and verification. Per-item isolation by construction: one SQS message = one item = its own retry and DLQ path.

**Inputs:** TARGET-ARCHITECTURE §14, §15, §21, §22, §37, §38, §71A; review §9, §11; port `bndy-signals/src/source-runner/bndy-client/` (BndyWriteClient, HttpBndyWriteClient, applyWrites, all tests) and `resolution/` (resolveArtist, resolveVenue, resolveEntities, tests); reuse `bndy-enrichment/src/bndy/client.ts` auth; WP-05A findings for event mutation routes.

**Deliverables:** `src/projection/`:

- `src/handlers/projection-worker.ts` consuming `ProjectionQueue`, idempotent on `sourceId + observationId + candidateKey + projectionAction`.
- Event clustering: artist+venue+date sentinel (D20 wording: projection constraint, not knowledge identity).
- Artist resolution → `POST /api/artists/find-or-create`. Venue resolution → `POST /api/venues/find-or-create`. Never reimplement the ladders.
- `AuthorityPolicy.evaluate({predicate, proposedClaim, existingSupportingClaims, ownerManaged, tombstone})` with the explicit authority classes and the destructive rule (ADR-109 in this PR). No learned reliability in wave 1.
- Tombstone policy (ADR-103 in this PR): active tombstone + no stronger fresh claim → block create; active tombstone + fresh explicit artist-owned/venue-owned reinstatement → supersede and permit.
- Cancellation/withdrawal (delta + complete + authority passed): delete/hide via the WP-05A-verified route, write tombstone, record ClaimWithdrawal.
- Enrichment on create (ADR-106 in this PR): emit `EntityEnrichmentWorkItem`; the enrichment worker reuses `src/google/gemini.ts` discovery but writes Observations/Claims and projects accepted fields through canonical APIs. If the legacy GoogleDiscoveryQueue is used to ship GigsNews faster, it runs behind `TEMPORARY_BRIDGE=true` with its removal criterion stated in the ADR.
- Read-back verification on every write. A failed verification fails that message only.
- 409/DUPLICATE_EVENT resolves to the existing event. `externalIds.source` carries the source id.
- `ProjectionRun` report aggregation per run. Unresolvable items → Exception record (WP-14 store; stub interface until it lands).

**WP-05 does NOT own:** raw fetching, source parsing, model-specific code, direct DynamoDB domain mutation, legacy Google enrichment writes as target behaviour.

**Acceptance:** ported bndy-client and resolution tests pass. New tests cover: per-item retry does not replay the run; tombstone blocks recreate; reinstatement supersedes; incomplete capture never cancels; lower-authority withdrawal against a fresh venue-owned claim is refused; verification failure isolates one message; new artist emits an enrichment item.

### WP-05A. Canonical Event mutation API preflight

**Repo:** `bndy-serverless-api`. **Starts immediately, in parallel.** Gates production use of WP-05, not its development.

**Goal:** the Event write contract is verified fact, not assumption. Known evidence: the BUILD-008 survey found artist DELETE sits behind `requireAuth` with no service route (the delete-401 gap). Events likely share the gap.

**Deliverables:**

1. Documented contract for Event create/read/update/delete-or-hide with service auth: routes, payloads, duplicate response, owner-managed protection, externalIds mutation, read-back route. Lives at `bndy-enrichment/docs/EVENT-API-CONTRACT.md`.
2. Missing service-authenticated update/delete support added to `bndy-serverless-api` behind the `requireStaffOrMcp` gate pattern (already built for groups), with owner-managed safeguards and tests.
3. Integration contract tests the projection engine can run against a mock.

**Rules:** respect the serverless-api deploy guardrails (validate + verify-routes). Jason deploys.

**Acceptance:** every operation in the section 4 contract has a named, tested route. No source enables production cancellation before this merges and deploys.

### WP-06 to WP-09. Adapter ports (GigsNews, KLMA Stoke, OnTheCase, ScenicEye)

One WP per source. Identical template. Parallel-safe, separate PRs.

**Inputs:** `bndy-signals/src/source-runner/sources/<source>/` (adapter, config, fetch, parse, normalise, rules, aliases, all tests), `bndy-signals/test/fixtures/` for that source; the Cowork task prompt for the source in TASK-PROMPTS-v4 (quirks and thresholds); recent RUN-REPORTs in `data/normalized/<slug>/` for expected shape.

**Deliverables:** `src/sources/adapters/<source>/` implementing the WP-04 `SourceAdapter` contract, with all tests and fixtures ported. Source CONFIG document for the registry (schedule mirrors today's Cowork local time; mode and snapshotSemantics copied from the signals config; `runtimeClass: "browser"` for GigsNews, OnTheCase, ScenicEye).

**Rules:** port, do not rewrite (D11). Parsing quirks stay in the adapter. `aliases.ts` stays as bootstrap seed only (D16); on match, attach externalId + nameVariant to the canonical entity through the projection layer, never grow the alias file. Browser sources acquire only inside the browser worker.

**Acceptance:** all ported tests green, including golden tests. A dry run against a stored fixture snapshot produces the same normalised output as bndy-signals at its tip.

### WP-10. insangel adapter (new, deterministic-only)

**Inputs:** the Cowork insangel task prompt (TASK-PROMPTS-v4), recent `data/normalized/insangel/<date>/` snapshots and RUN-REPORTs as fixtures.

**Deliverables:** `src/sources/adapters/insangel/` with fetch, parse, normalise, config, tests, fixtures from real snapshots.

**Rules:** wave 1 is deterministic-only (review §19, option A). If the acquisition ladder proves AI extraction is required, this WP stops and re-scopes with a WP-15 dependency. The adapter never calls Gemini directly.

**Acceptance:** fixture-driven tests reproduce a known-good Cowork run's normalised output.

### WP-11. Parity gates + single-writer cutover (per source)

**Goal:** prove parity, then one ownership transition. Never two production writers (D19).

**Deliverables:**

- `shadow: true` behaviour: full pipeline runs, observations and claims persist, ProjectionWorker writes a would-write report instead of calling the APIs.
- **Gate A, fixture parity:** feed the AWS adapter and the bndy-signals/Cowork implementation the same stored raw snapshot. Compare normalised records, added/unchanged/withdrawn candidates, exception equivalents, identity inputs. Exact match required except intentional documented changes.
- **Gate B, live parity:** both systems run close together in time; compare fetched evidence hashes plus outputs. Classify every difference: INPUT_DIFFERENCE, EXPECTED_RULE_CHANGE, IDENTITY_DIFFERENCE, PROJECTION_DIFFERENCE, DEFECT. Three consecutive runs with no unexplained material difference.
- **Cutover, one transition per source, all flips Jason-only:** gates passed → in one window Jason disables the Cowork schedule and sets `writerAuthority: "aws"`, `shadow: false` → first live run → verify read-backs. Rollback: set `writerAuthority: "cowork"`, `shadow: true`, re-enable Cowork. If a confidence period is wanted, Cowork may run shadow (no writes), never live.
- Checklist per source under `docs/cutover/`.

**Acceptance:** GigsNews (first) passes both gates; cutover checklist executed; zero dual-writer runs in the log.

### WP-12. Observability

**Deliverables:** CloudWatch metrics from §41 with dimensions sourceId/sourceType/adapter/mode/runtimeClass; alarms: any DLQ depth > 0 (three DLQs now), consecutive source failures ≥ 2, ProjectionFailures > 0, zero-items-where-historically-nonzero (warning, §42, §43); run reports queryable per §47.

**Acceptance:** synth shows alarms; a forced failure in test fires the DLQ alarm.

### WP-13. GitHub OIDC deploy

Unchanged from v1.0. Manual-approval-gated deploy on merge to main; the one-time IAM role setup documented for Jason to execute. Until then D15 stands.

### WP-14. Exception Queue

Unchanged from v1.0 in substance: `ExceptionStore` (DDB), written by projection and resolution failures with evidence links (claims, observation, attempted resolution, reason); CLI list/resolve; ADR-107. Godmode surface deferred until real volume.

**Acceptance:** an unresolvable venue in a test run lands as one exception record with evidence links.

### WP-15. Intelligence layer foundations

**Goal:** the model runtime plus the knowledge objects the reconciliation and inference layers grow on. **This WP owns the persistence and versioning of Extraction, Interpretation and EvidencePack** (types from WP-01); it must land before WP-18 Capture convergence.

**Inputs:** TARGET-ARCHITECTURE §62, §63, §64; port from `bndy-signals/src/intelligence/` (llm-resolve, gather-evidence, gather-candidates, resolver + tests) and the budget/cache concepts; existing `src/google/gemini.ts`.

**Deliverables:** `src/models/` and `src/knowledge/`:

- Provider abstraction: `GeminiProvider` (grounding + multimodal), `BedrockClaudeProvider`, `DeterministicProvider` (ADR-105). Routing per §63; deterministic tiers 0 to 3 before any model call.
- `DiscoveryBudget` enforcement on every model-using job. Interpretation cache keyed on content hash + prompt version + model version.
- Extraction/Interpretation/EvidencePack persistence (single-copy + link-record pattern from WP-02).
- Intelligence pass: unresolved cases get one budgeted AI resolution attempt; safe additive high-confidence results auto-apply through the ProjectionQueue; the rest go to the Exception Queue (§64).

**Rules:** blanket never-auto-create is retired (§64). Auto-create still passes every projection rule: authority, tombstones, venue rule.

**Acceptance:** ported resolver tests pass under the provider abstraction. A budget-exhausted job stops cleanly and reports.

### WP-16. Venue Gig Source (Fishpond pilot) + registry sync

Spans three repos. The registry-sync rule is the addition (D18/ADR-110): `PUT /api/venues/{venueId}/gig-source` in `bndy-serverless-api` calls one canonical source-management path that **upserts the Source Registry record**; `venue.gigSource` becomes a read projection (sourceId, enabled, url, health, lastSuccessfulScanAt) refreshed from the registry. Godmode editor (`bndy-backstage`) per §6.2. Generic acquisition in `bndy-enrichment` (JSON-LD → embedded JSON → DOM → AI fallback per §9); `VENUE_WEBSITE` sources resolve the venue by linkage (§14.3).

**Acceptance:** The Fishpond scanned nightly through the standard pipeline, gigs projected and verified; config edited in godmode round-trips through the registry only. Then 5 to 10 venues on different stacks (§49 Stage 2).

### WP-17. Cancelled product state (deferred)

Event `status: cancelled` in API and app. Projection switches from delete+tombstone to status change per §21.1 and D13, and **reprojects existing tombstoned cancellations as status=cancelled**. Requires a Jason decision to activate.

### WP-18. Capture convergence

**Depends on:** 01, 02, 05, 15. Required before archive: §69 criterion 3 says Capture, venue scans and curated scans emit one Observation/Claim model.

**Deliverables:** `CAPTURE_URL` and `CAPTURE_IMAGE` become sources producing Observation → Extraction → Interpretation → Claims, projected through the shared ProjectionQueue/Worker. Reuse the proven Facebook URL and poster discovery behaviour; do NOT rewrite discovery prompts while migrating.

**Acceptance:** known successful Facebook fixtures and poster fixtures produce the same canonical artist/event outputs as the current processor; Capture notes/status behaviour stays compatible; the old direct Capture projection path is removed only after parity.

### WP-19. Storage migration + archive bndy-signals

Migrate needed state from `bndy-signals-*` stores into the enrichment model (§68 Phase 5, capture-before-prune). Archive `bndy-signals` only when all §68 Phase 8 criteria and all §69 acceptance criteria hold, including WP-18.

---

## 7. Agent PR contract

Every work package is buildable in isolation by one agent. Each PR must contain:

1. The code and its tests. `npm run build`, `npm run test`, `npm run check`, `npm run synth` all green.
2. The ADR the package owns, if any.
3. No schedule enabled, no source enabled, no writer-authority flip, no deploy, no IAM change in the live account.
4. No writes to bndy production from tests. Integration tests mock the API client (the ported `HttpBndyWriteClient.test.ts` shows the pattern).
5. No new storage keys, queues or config fields beyond those specified in WP-01/02/03. A needed addition is a question back to the CTO, not an invention.
6. A three-line PR summary: what changed, what proves it, what is not covered.

Jason reviews, merges and deploys (D15). The CTO session reviews architecture-significant PRs before merge on request.

## 8. Sequence to first value

| Step | What | Who |
|---|---|---|
| 1 | WP-00 docs landed | CTO, done |
| 2 | WP-01; WP-05A starts in parallel | agents A + B |
| 3 | WP-02, then WP-03 | agent A or C |
| 4 | WP-04, then WP-05 | agent A or B |
| 5 | WP-06 to WP-10 in parallel; WP-12, WP-14 alongside | five agents |
| 6 | WP-11 GigsNews: Gate A, Gate B, Jason single-writer cutover | CTO runs gates, Jason flips |
| 7 | Repeat WP-11 per source; WP-15 starts | rolling |
| 8 | WP-16 Fishpond pilot; WP-18 Capture convergence; WP-19 last | after wave 1 |

The Cowork fleet stays scheduled and authoritative for each source until that source completes its WP-11 cutover. One writer per source, always.
