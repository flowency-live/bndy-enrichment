# Backline relaunch plan

Status: repository execution plan, live actions gated

Prepared: 2026-08-31

Authority: this document supersedes the Backline and source-automation status shown on the website workboard before this date. It does not supersede the safety controls or execution gates in the linked repository documents.

## Decision

Backline does not need a restart. Its evidence graph, source runtime, canonical safety gate, freshness controls, continuous hydration path, Explorer and reliability controls survived and are now on `main`.

The relaunch has three immediate jobs:

1. prove what is actually live and release the smallest shadow-only control plane;
2. catch Backline up with canonical BNDY from the complete 24 August baseline, then keep it current;
3. move deterministic sources into one observable shadow BAU runtime before attempting one tightly bounded canonical event pilot.

Backline remains a one-way intelligence layer throughout these jobs. Canonical writes remain disabled unless a later, exact human approval authorises a bounded pilot.

## What is exciting again

The target is not a collection of scrapers. It is a continuously refreshed, provenance-first model of the UK live-music world that can answer:

- what changed today;
- which source said it;
- which canonical Artist, Venue or Event it may refer to;
- where sources agree or contradict each other;
- what Backline would change in BNDY;
- why that change is safe, unsafe or unresolved.

The first compelling proof is therefore an end-to-end intelligence loop: source revision, immutable evidence, atomic Claims, identity resolution, conflict display, freshness heartbeat and a would-write decision, all visible without mutating BNDY.

## Current truth

| Area | Repository state | Live state | Decision |
| --- | --- | --- | --- |
| Evidence, Observations, Claims and resolutions | Intact | Existing stores predate recovery | Preserve |
| Global canonical projection gate | Default-off and fail-closed | Unverified after recovery | First bounded release candidate |
| Daily source contract and 26-hour alarm | Implemented | Deployment and catalogue seed unverified | First bounded release candidate |
| Reliability controls | 30-day logs, 24 alarms and five concurrency caps implemented | Not deployed or reconciled | Release separately after live audit |
| Canonical baseline | Complete baseline `bndy-baseline-2026-08-24-v1` recorded | Stale relative to current BNDY | Delta catch-up required |
| Continuous canonical ingestion | Implemented and default-disabled | Streams, parameters and mappings unverified | Enable only after ownership and gap-free handoff |
| Source adapters | Lemonrock, On The Case, KLMA, GigsNews and ScenicEye are code-ready | Current schedules and last successful runs unverified | Reconcile, then shadow BAU |
| Legacy Signals writers | Fail-closed change exists as open PR #1 | Main and deployed state are not safe to assume | External blocker |
| Cowork source runners | Direct-writer task definitions and run contract exist | No current run ledger or final schedule export | Treat current canonical as catch-up truth |
| Serverless Capture hot-deploy bypasses | Contained by `bndy-serverless-api` PR #71 | Live hashes still unverified | Collision materially reduced |
| Provider qualification | Review material complete | Provider inactive and unscheduled | Failed capture contract, separate lane |
| Explorer and Godmode | Core graph reader survived | Release and truthful live status unverified | Extend as the control surface |

Green repository state must not be presented as green production state.

## Canonical catch-up decision

Yes, Backline needs another hydration from canonical BNDY. It needs a delta hydration, not another full baseline.

The only complete named baseline is `bndy-baseline-2026-08-24-v1`. Canonical BNDY may have changed since then through Cowork tasks, Claim V2, MCP, product flows and direct user activity. The absence of a current Cowork run ledger makes canonical BNDY the most reliable catch-up source.

The sequence is:

1. the authorised infrastructure operator proves the global projection gate is absent or false and validates the complete baseline manifest;
2. run the existing delta CLI in read-only `--dry-run` mode and review insert, modify, remove, unchanged and checkpoint totals;
3. approve and run exactly one delta hydration that writes only Backline evidence and state;
4. reconcile the resulting manifest and prove zero projection work;
5. after the canonical-table owner settles streams and SSM ownership, hand over to continuous canonical-change ingestion without losing the stream-retention window.

The exact safeguards and stop conditions are in [CANONICAL-HYDRATION-READINESS.md](CANONICAL-HYDRATION-READINESS.md). Hydration is an infrastructure-owner action and is not authorised by this plan.

## Relaunch sequence

### Phase 1: establish live truth and release the shadow control plane

Owner: designated infrastructure agent, with Backline review

1. Return the fresh read-only inventory, resource ownership ledger, Lambda hash reconciliation, final Cowork schedule export and Signals state.
2. Produce the bounded no-change-set CDK diff requested by [BOUNDED-CDK-DIFF-REQUEST.md](BOUNDED-CDK-DIFF-REQUEST.md).
3. Classify every proposed resource. Reject replacements, deletions, Capture ownership changes, canonical streams, provider activation and unrelated schedules.
4. Release only the default-off projection gate, would-write reporting, unified source catalogue runtime and source-health controls.
5. Seed the reviewed catalogue separately, observe every coverage heartbeat and prove the 26-hour alarm.

Exit: live hashes reconcile to reviewed commits, one schedule owner exists per source, canonical writes are false, canonical streams remain disabled, and freshness is visible.

### Phase 2: catch up and continuously hydrate canonical BNDY

Owner: designated infrastructure agent, with a separate exact hydration approval

1. Review the canonical delta dry-run from `bndy-baseline-2026-08-24-v1`.
2. Execute one approved shadow-only delta hydration.
3. Reconcile the manifest and source-labelled records, including Fizgig and Live Band Photos imports already present in canonical BNDY.
4. Enable and verify continuous canonical-change ingestion only after canonical table, stream and SSM ownership is explicit.
5. Prove insert, update and removal semantics using separately approved test data.

Exit: Backline represents current canonical BNDY, consumes subsequent changes once, records removals correctly and causes zero canonical mutations.

### Phase 3: put deterministic sources into shadow BAU

Owner: Backline repository for code; designated infrastructure agent for any live activation

Move sources one at a time. Each cutover requires two clean shadow runs, stable source identities, immutable evidence, complete run reports, reconciled counts, freshness heartbeats, empty operational DLQs and proof that the previous scheduler is off before authority transfers.

| Order | Source family | Target cadence | Immediate purpose |
| ---: | --- | --- | --- |
| 1 | KLMA | Daily | Smallest deterministic end-to-end reference source |
| 2 | GigsNews | Daily | Recover a current regional coverage path from Cowork |
| 3 | ScenicEye | Daily | Prove browser or edition-style acquisition without slowing freshness |
| 4 | On The Case | Hourly root plus child hydrations | National directory and gig intelligence |
| 5 | Lemonrock | Hourly change roots plus daily reconcile | Large-scale source and reliability proof |
| 6 | Live Band Photos | Daily gigs, weekly indexes | Canonical-first source recovery and south-east coverage |
| 7 | Fizgig | Daily after fixture qualification | Canonical-first Lincolnshire and East Midlands coverage |

This order is operational, not a value ranking. Lemonrock remains strategically important, but its historical task volume makes it a poor first proof after the infrastructure stall.

### Phase 4: make Godmode the truthful intelligence surface

Expose, without granting write authority:

- source owner, cadence, last success, acquisition age and publisher-data age;
- immutable snapshots and exact evidence;
- canonical matches, unresolved candidates and identity conflicts;
- Claim histories, contradictions, withdrawals and resolutions;
- would-create, would-update, would-cancel and policy-rejected decisions;
- global canonical-write state and the deployed commit identity;
- hydration checkpoints, run manifests, alarms, queues and DLQs.

Exit: a product or operations reviewer can understand one entity and one source run from acquisition to decision without reading logs or trusting a green badge.

### Phase 5: one bounded canonical pilot

The first pilot should use KLMA because the adapter and deterministic identity rules are already tested. It must be proposed only after Phases 1 to 3 are healthy.

Pilot boundary:

- five to ten future Event creates only;
- Artist and Venue must already exist canonically and resolve unambiguously;
- no Artist or Venue creation;
- no updates, deletions, cancellations, restores or owner-managed fields;
- canonical API only, never direct table writes;
- every proposed action human-reviewed before execution;
- hard stop on the first mismatch, duplicate, policy failure or read-back error;
- exact read-back verification and retained Backline decision evidence;
- separately approved run ID, candidate list, time window and rollback procedure.

This pilot proves the controlled source-to-canonical loop. It does not enable scheduled canonical writes and does not authorise any other predicate or source.

## Fizgig and Live Band Photos recovery pattern

Both sources already have records in canonical BNDY, so source onboarding starts with provenance recovery rather than creation:

1. delta-hydrate current canonical records into Backline;
2. identify retained source labels and import lineage;
3. capture an immutable source-native fixture set;
4. derive stable source identities without inventing canonical IDs;
5. resolve source candidates to existing canonical records and expose conflicts;
6. run new and changed source observations in shadow BAU;
7. keep canonical projection disabled.

The canonical hydration proves what BNDY currently says. The source-native scan proves what each publisher currently says. They are separate evidence and must never be collapsed.

See [LIVEBANDPHOTOS-INGESTION.md](LIVEBANDPHOTOS-INGESTION.md) and [FIZGIG-INGESTION.md](FIZGIG-INGESTION.md).

## Provider lane

The Interactions evidence-first provider attempted 20 cases, captured 12, admitted facts in 9, safely abstained in 3 and errored in 8. Six cases exceeded the approved search contract and two returned invalid FACT lines. The capture verdict is `FAILED_CAPTURE_CONTRACT`; human fact adjudication remains pending.

The provider remains inactive and unscheduled. It does not block deterministic source ingestion, canonical catch-up, identity resolution, freshness or the bounded event-only pilot. Any revised four-search contract would be a new cost and qualification decision.

## Non-negotiable stop conditions

Stop before any live action if:

- the global canonical-write state is true or unreadable;
- live code hashes cannot be reconciled;
- a resource has more than one infrastructure owner;
- Signals or Cowork can still write the same source concurrently;
- a proposed diff includes a replacement, deletion or unclassified resource;
- a source capture is structurally incomplete or its previous complete baseline is unclear;
- identity resolution is ambiguous;
- the action needs a canonical table write, provider call or infrastructure change not covered by a separate approval.

## Definition of fully functional shadow Backline

Backline is fully functional in shadow when:

1. current canonical BNDY is represented and stays current;
2. every active source has one daily-or-faster authoritative acquisition path;
3. every run retains evidence, Claims, decisions, metrics and a freshness heartbeat;
4. conflicts and unresolved identities remain visible instead of being flattened;
5. Godmode truthfully reports live code, source, queue, alarm, hydration and write-gate state;
6. reliability controls are deployed and verified by the infrastructure owner;
7. zero Backline-caused canonical writes are proven.

Only then should the bounded KLMA event pilot be brought back for explicit human approval.

## Repository evidence already completed

- [PR #124: contain obsolete deployment workflows](https://github.com/flowency-live/bndy-enrichment/pull/124)
- [PR #125: infrastructure ownership handoff](https://github.com/flowency-live/bndy-enrichment/pull/125)
- [PR #126: bounded CDK diff request](https://github.com/flowency-live/bndy-enrichment/pull/126)
- [PR #127: first bounded release readiness](https://github.com/flowency-live/bndy-enrichment/pull/127)
- [PR #128: reliability controls](https://github.com/flowency-live/bndy-enrichment/pull/128)
- [PR #129: canonical hydration safeguards](https://github.com/flowency-live/bndy-enrichment/pull/129)
- [PR #130: provider qualification adjudication material](https://github.com/flowency-live/bndy-enrichment/pull/130)

No AWS call, provider call, source activation, hydration, queue action, deployment or canonical write was made while preparing this plan.
