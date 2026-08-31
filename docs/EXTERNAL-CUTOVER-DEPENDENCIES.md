# External Backline cutover dependencies

Status: unresolved external-owner actions

Prepared: 2026-08-31

## Scope

This file records conditions that block a safe Backline release but cannot be completed from `bndy-enrichment`. It does not authorise edits to Signals, Cowork, backend repositories or live infrastructure.

## Signals fail-close

The 2026-08-30 repository audit found that `bndy-signals/main` still represented enabled legacy source schedules and direct canonical writers. It also found an open Signals PR intended to disable four source schedules, disable the intelligence trigger and force legacy handlers into dry-run.

That evidence may now be stale. Until the Signals owner supplies newer proof, Backline must treat the legacy writer risk as unresolved.

Required result from the Signals owner:

- identify every live Signals schedule and target;
- confirm the four transferred source schedules are disabled;
- confirm intelligence auto-apply is disabled;
- confirm legacy handlers fail closed or run in dry-run;
- confirm no Signals role retains an active direct canonical-write path for a transferred source;
- supply the merged commit, deployed code evidence and live rule state;
- keep any retained non-Backline source under one explicit owner.

Merging a PR is not deployment proof. Repository state, deployed code and live schedule state must all agree.

## Cowork schedule reconciliation

The final Cowork scheduled-task export is still required. The export must include, for every source-related task:

- task name and stable identifier;
- enabled state;
- cadence and timezone;
- source family and operation;
- target repository, workflow, Lambda, queue or API;
- whether it reads, discovers, writes or projects;
- last successful and failed execution timestamps;
- intended post-cutover owner.

The enrichment owner will compare that export with the schedules declared by `BndyEnrichmentStack`. No live rule will be changed as part of the comparison.

## Cutover rule

Each active source must have exactly one authoritative daily-or-faster coverage path where the source contract requires it. Faster change feeds may coexist with a slower reconciliation path only when both belong to the same declared source family and have distinct, documented semantics.

Competing discovery paths are allowed only during an explicitly bounded shadow comparison. Competing canonical writers are not allowed.

## Evidence table to be returned

| Source family | Signals path | Cowork path | Backline path | Canonical writer | Required decision |
| --- | --- | --- | --- | --- | --- |
| One row per source | Enabled state and owner | Enabled state and owner | Enabled state and owner | Exactly one or none | Keep, retire, shadow-compare or investigate |

## Release blocker

The first bounded Backline release remains blocked if any of these are true:

- a transferred source has an enabled Signals writer;
- a Cowork task can write or project the same facts without an explicit boundary;
- the live state cannot be reconciled with repository state;
- a source has no authoritative daily coverage path;
- a source has more than one active canonical writer.

Signals and Cowork changes must be made by their authorised owners. This repository consumes their evidence and records the release decision only.
