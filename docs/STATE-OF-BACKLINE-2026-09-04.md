# State of Backline

**Status date:** 2026-09-04  
**Purpose:** Authoritative recovery and delivery checkpoint for the next Backline owner or agent.  
**Scope:** Backline application, data, source acquisition, projection safety, Godmode visibility and the route to controlled canonical writes. This is not an infrastructure deployment instruction.

## Executive position

Backline is intact and substantially operational as a **shadow intelligence layer**. It can acquire source material, retain immutable evidence, create Observations and atomic Claims, resolve candidates against canonical BNDY entities, queue projections and expose bounded graph and convergence data to Godmode.

The canonical BNDY corpus was successfully re-hydrated into Backline on 2026-09-01. Canonical projection remains default-off and fail-closed. Legacy Signals schedules are disabled. Canonical table streams remain disabled.

The immediate delivery route is no longer historical DLQ repair. Old delivery failures remain quarantined. The critical path is:

1. prove one fresh source run through the corrected pipeline in shadow mode;
2. make its new intelligence unmistakably visible in Godmode;
3. prove a second clean run and then restore that source's shadow BAU cadence;
4. repeat the proof for Lemonrock;
5. onboard Fizgig and Live Band Photos as source-native shadow feeds;
6. run a separately approved, additive-only canonical-write pilot.

Do not delete Backline Claims to resolve the historical DLQ. Claims are retained testimony and provenance. Delivery failures are a separate operational concern.

## What is running and proven

### Production safety

- `BndyEnrichmentStack` was reported `UPDATE_COMPLETE` and `IN_SYNC` in the 2026-08-31 production audit.
- The `CONTROL#PROJECTION / GLOBAL` record is absent. Code therefore returns `false`; canonical writes are disabled by default.
- Projection fails closed if the control cannot be read.
- All 39 catalogued sources were reported with `shadow=true`.
- Canonical DynamoDB streams are disabled.
- Legacy Signals source and intelligence schedules are disabled.
- No subsequent operation recorded in this checkpoint authorised canonical writes.

### Canonical convergence

The write-to-Backline delta hydration `canonical-delta-write-2026-09-01-v1` completed successfully against baseline `bndy-baseline-2026-08-24-v1`:

| Metric | Result |
| --- | ---: |
| Canonical records scanned | 17,716 |
| Unchanged checkpoints backfilled | 13,117 |
| Inserted into Backline | 2,494 |
| Modified in Backline | 2,105 |
| Confirmed removals represented | 66 |
| Claims created | 169,053 |
| Errors | 0 |

This means Backline reflected the manually cleaned canonical corpus as of that run. It does not mean later canonical changes are automatically ingested because the streams are still disabled.

### Godmode and graph

The deployed Backline visibility work reports canonical convergence and global projection state and includes an authenticated Intelligence Graph tab. The current graph reader performs bounded traversal over source, Observation, Claim, candidate and canonical-resolution relationships.

Godmode is functional but not yet the truthful, rich control surface required for BAU. It still needs clear source freshness and run state, new-versus-existing intelligence, conflicts, evidence trails, candidate resolutions, shadow outcomes, would-write decisions and explicit blockers.

## Source and incident status

| Source or domain | Current state | Decision |
| --- | --- | --- |
| Canonical BNDY corpus | Hydrated into Backline as of 2026-09-01 | Refresh by bounded delta until streams have a confirmed owner and deployment path |
| `lemonrock-gig-hydration` | Disabled and shadowed | Keep contained until one fresh corrected shadow run succeeds; 17 evidence-poor historical candidates remain parked |
| `onthecase-gig-index` | Disabled and shadowed; schedule disabled | Complete and evidence the approved fresh bounded shadow acquisition before BAU restoration |
| Fizgig | Ingestion plan exists; historical records may already be in canonical | Build source-native fixture and initial shadow scan, resolve against hydrated canonical entities, then define BAU change detection |
| Live Band Photos | Ingestion plan exists; historical records may already be in canonical | Build fixtures and bounded initial shadow scan, then daily gigs, weekly indexes and monthly reconciliation if qualified |
| Hugging Face / GigXChange | Candidate adversarial external source | Later qualification, not on the current critical path |

### ProjectionDLQ incident

The shared historical ProjectionDLQ held approximately 10,909 quarantined event-creation delivery requests when last reported. A sample suggested roughly 59% Lemonrock and 41% OnTheCase.

The original Lemonrock defect omitted locality from `occursAt` Claims. The repair path added 8,306 evidence-backed Claims; 17 unresolved cases were deliberately left unresolved. A 352-message Lemonrock shadow replay sample processed successfully.

The OnTheCase repair path added exactly 278 evidence-backed locality Claims. A later replay encountered an OnTheCase candidate outside that repair cohort with many incomplete `occursAt` Claims. Nothing was transferred and all parked messages were restored.

This established that exhaustive historical replay is an unbounded data-cleanup exercise, not a prerequisite for proving the corrected live pipeline. The current decision is therefore:

- retain the old DLQ as incident quarantine;
- do not replay, purge or repair it on the critical path;
- do not derive current source health from it;
- revisit retention only as a separately bounded maintenance decision.

## Repository record

### Repositories directly changed during this recovery sequence

| Repository | Direct work recorded | Latest relevant remote state |
| --- | --- | --- |
| `flowency-live/bndy-enrichment` | Lemonrock parser/projection repair, bounded repair tooling, OnTheCase locality repair, source plans and operational documentation | PR #140 merged at `32f957c1b29fc85d6fb02e8aec48882ff10bcdad`; earlier Lemonrock PRs #138 and #139 merged |
| `flowency-live/bndy-website` | Backline workboard checkpoints for convergence, repairs, SourceWorker deployment verification and the first safe replay stop | Last verified checkpoint commit `88654bae22d92236b3c0686cc6c710a806dbb509` |

The local `bndy-enrichment` checkout is clean on `fix/onthecase-occurs-at-repair` at local commit `1f83a8c`. Its tree corresponds to the OnTheCase repair that GitHub squash-merged as `32f957c`. The local `origin/main` reference is stale at PR #139 and must be fetched before further branch work.

### Repositories integrated through reported releases, but not directly changed in the current local workspace

| Repository | Relevant reported release |
| --- | --- |
| `flowency-live/bndy-serverless-api` | Backline convergence endpoint merged in PR #76; SourceRuns Lambda deployed |
| `flowency-live/bndy-backstage` | Convergence and Intelligence Graph UI deployed; Amplify build #826 succeeded |
| `flowency-live/bndy-signals` | Legacy schedules reported disabled; do not treat it as the active writer |
| `flowency-live/bndy-ops` | Contains operational/Cowork context that still needs reconciliation when source ownership changes |

### Deployment evidence supplied by the AWS-enabled worker

- Lemonrock repair release: SourceWorker and ProjectionWorker code-only deployment from merge `b51e644`; no CloudFormation changes.
- OnTheCase repair release: SourceWorker code-only deployment from exact merge `32f957c`; configuration preserved and deployed archive hash verified.
- The reported suite result for `32f957c` was **396 passed, 2 failed, 7 skipped**. The two failures were attributed to date-sensitive GigsNews source-parity fixtures, so the suite must not be described as fully green until that drift is resolved.

## Current work, in delivery order

### 1. Close the fresh OnTheCase shadow proof

An AWS worker was instructed to enqueue exactly one manual root scan under reconciliation ID `onthecase-fresh-shadow-2026-09-04-v1`, with at most 500 root and child tasks and all write controls remaining off.

The closure audit established:

- run ID `run-8f2bb560-d350-460e-a49d-a4735dca9092`;
- status `completed`;
- start `2026-09-03T23:48:33.551Z`;
- completion `2026-09-03T23:48:36.605Z`;
- one root task and zero child tasks;
- one immutable 333,072-byte HTML evidence object and one Observation;
- zero Claims, candidates, entity profiles or projection work items;
- no ProjectionQueue or historical ProjectionDLQ movement;
- a successful source heartbeat but no useful new Godmode intelligence.

The retained HTML was valid and contained 252 parseable gigs. The manual root message was malformed: its `taskKey` selected the internal `gig-inventory-control` task kind. `parseOnTheCase()` correctly short-circuits control tasks, so the actual `gig-index` parser and the corrected event path were never exercised.

This is an invocation defect, not a source, evidence, parser or projection defect. It must not be reported as a successful acquisition proof.

The technically correct root message omits `taskKey` and `task`. However, the current adapter would then create about 252 venue-hydration requests plus an inventory-control request, and venue pages may create further band-hydration requests. The current fan-out publisher has deduplication but no reconciliation-wide 500-task budget. Therefore a reconciliation-scoped rerun cannot honestly guarantee the previously approved 500-task ceiling without an additional bound or a root-only acquisition mode.

### 2. Make Godmode demonstrate accumulating intelligence

Refactor `/godmode/enrichment` around the operating questions:

1. What ran, when, and is it fresh?
2. What new evidence and Claims arrived?
3. Which artists, venues and events were resolved, conflicted or remain unknown?
4. What would Backline write if projection were enabled?
5. Why does Backline believe each proposed fact?

The graph is an application-level evidence and entity graph. It does not require an AWS infrastructure graph visualiser. An AWS resource graph may later help infrastructure ownership, but it is not the Backline intelligence product.

### 3. Restore shadow BAU source by source

After one useful fresh OnTheCase run, perform a second bounded run to prove idempotency/change detection. Only then seek approval to re-enable the OnTheCase hourly schedule in shadow mode with freshness monitoring. Repeat the same proof for Lemonrock before re-enabling its hydration cadence.

### 4. Add new sources

For Fizgig and Live Band Photos:

1. capture immutable representative fixtures and licence/provenance notes;
2. implement source-native parsing and stable external identifiers;
3. run a bounded initial scan in shadow mode;
4. resolve observations against the canonical entities already hydrated into Backline;
5. expose new, matched, conflicting and unresolved intelligence in Godmode;
6. run a second scan to prove change detection;
7. only then enable BAU cadence.

These feeds must not recreate records merely because their historical data already exists in canonical BNDY.

### 5. Controlled canonical-write pilot

Once fresh shadow BAU and Godmode visibility are proven, prepare a small additive-only pilot, expected to be 5 to 10 future events with already-resolved artists and venues. The approval packet must show exact would-write payloads, provenance, authority, deduplication results and rollback/containment controls.

The first pilot must exclude updates, deletions, cancellations and automatic creation of new artists or venues. Enabling the global projection control and executing any canonical writes require a new explicit human approval.

## Human approval gates that remain

- No canonical writes without explicit approval of the precise pilot and write window.
- No source schedule re-enablement until its fresh shadow and repeat-run evidence is accepted.
- No infrastructure deployment, stream enablement, IAM change, queue mutation or concurrency change by this workspace.
- No historical DLQ purge or bulk replay on the critical path.
- No deletion of Claims as an incident-recovery shortcut.

## Exact next action

Add an explicit, tested root-only/manual fan-out control to the OnTheCase acquisition path so a fresh gig-index run can parse and project the current 252 gigs without recursively hydrating venues and bands. Deploy only the corrected SourceWorker code after review, then enqueue a root message without the control-task key and with that bounded mode enabled. Keep both affected sources and canonical writes disabled. Do not touch the historical DLQ.
