# First bounded Backline release readiness

Status: repository ready, live release blocked

Prepared: 2026-08-31

Audited repository state: `flowency-live/bndy-enrichment` at `f15bdc40f0d642ab865ff3e96d6b877349cd72cc`

Target stack: `BndyEnrichmentStack`

## Decision

The rescued implementation needed for the first bounded Backline release is intact. It does not need to be restarted or recreated.

The repository proves that canonical projection is default-off and fail-closed, the unified daily-source policy is enforced, the source-health worker and 26-hour freshness alarm are defined, and canonical-change ingestion is absent when its explicit context flag is false.

The live release is not yet authorised. Current production code hashes, drift, schedule ownership, global gate state and deployed alarm state have not been reconciled. The generic deployment workflow can apply every outstanding stack difference, so it is not an approved substitute for a classified live diff and an explicit resource allowlist.

No AWS access, deployment, source seeding, hydration, provider invocation or canonical write was performed to produce this assessment.

## Repository evidence

| Control | Repository evidence | Result |
| --- | --- | --- |
| Global projection gate | `src/projection/control-store.ts` performs a consistent read of `CONTROL#PROJECTION / GLOBAL` and enables writes only when `canonicalWritesEnabled === true` | Pass |
| Missing gate record | A missing record evaluates to false | Pass |
| Gate read failure | `src/projection/engine.ts` returns a retryable failure before any canonical API mutation | Pass |
| Shadow and non-authoritative sources | The projection engine records a would-write decision and does not call BNDY mutation APIs | Pass |
| Predicate and action policy | Explicit allowlists remain mandatory even when the global gate is enabled | Pass |
| Direct canonical table access | The projection worker receives no Artists, Venues or Events table-write grant | Pass |
| Daily-source contract | `src/sources/catalog.ts` defines daily-or-faster coverage and a 26-hour maximum staleness threshold | Pass |
| Source-health evaluation | `src/handlers/source-health.ts` checks every coverage root and fails on missing, invalid or stale state | Pass |
| Freshness alarm | `lib/bndy-enrichment-stack.ts` defines an hourly health run and an alarm on source-health errors | Pass |
| Canonical-change ingestion | Stack synthesis with `canonicalChangeStreamsEnabled=false` contains no canonical-change worker, DLQ, alarm or event-source mapping | Pass |
| Deployment containment | Repository tests restrict full-stack CDK deployment to two manual, confirmation-gated workflows | Pass |

Relevant regression coverage includes:

- `test/projection-engine.test.ts`;
- `test/source-cadence-policy.test.ts`;
- `test/canonical-change-stream.test.ts`;
- `test/deployment-workflow-safety.test.ts`.

The full repository check passed on the deployment-containment change with 58 test files and 369 tests. Subsequent documentation changes passed GitHub CI.

## Repository-only synthesis evidence

A fresh synthesis was produced without AWS credentials from the audited commit using the compiled CDK entrypoint and this context:

```text
canonicalChangeStreamsEnabled=false
```

The template contained 79 resources:

| CloudFormation type | Count |
| --- | ---: |
| DynamoDB table | 1 |
| S3 bucket | 1 |
| S3 bucket policy | 1 |
| SQS queue | 13 |
| SQS queue policy | 1 |
| Secrets Manager secret | 1 |
| IAM role | 12 |
| IAM policy | 12 |
| Lambda function | 12 |
| Lambda event-source mapping | 6 |
| EventBridge rule | 9 |
| Lambda permission | 7 |
| CloudWatch alarm | 1 |
| Lambda Function URL | 1 |
| CDK metadata | 1 |

Template SHA-256:

```text
e59755c1349726a49e0ad8333d8f1bfd29eea7c22f93537d1cd8f6db53bab3ce
```

No resource logical ID matched `CanonicalChange`.

This proves repository synthesis only. It does not establish what is deployed in AWS.

## Candidate first-release boundary

Subject to the authorised live audit and per-resource diff, the first release may include only:

- projection worker code implementing the global default-off gate and would-write reporting;
- source dispatcher code needed for the unified source catalogue;
- source-health worker code;
- the source-health schedule and 26-hour freshness alarm, only after schedule reconciliation;
- the minimum associated IAM changes, with no direct canonical table-write permission.

The release must exclude:

- canonical Artists, Venues or Events stream changes;
- canonical stream SSM parameters, workers, queues, alarms and event-source mappings;
- canonical hydration or baseline execution;
- provider activation or provider calls;
- Capture processor or scanner ownership changes;
- reliability controls reserved for the later reliability release;
- any source schedule not reconciled with Signals and Cowork;
- source catalogue seeding or other live data writes;
- canonical writes.

## Blocking evidence

The release remains blocked until all of the following are returned and reviewed:

1. A fresh read-only live audit, including every Lambda `CodeSha256`, event mapping, rule, stream, SSM parameter, queue, log group, alarm and stack drift result.
2. The bounded, no-change-set CDK diff requested in `docs/BOUNDED-CDK-DIFF-REQUEST.md`, with every logical resource classified.
3. Proof that the live global projection control record is absent or explicitly false, without changing it.
4. Proof that the live projection worker has the rescued gate implementation and cannot write directly to canonical tables.
5. Proof that canonical-change streams, parameters and event-source mappings remain inactive.
6. A final owner for the canonical Artists, Venues and Events table stream configuration.
7. Evidence from the Signals owner that legacy source schedules, intelligence auto-apply and direct canonical writers are fail-closed.
8. The final Cowork scheduled-task export and a one-owner reconciliation for every active source.
9. A reviewed first-release resource allowlist and an execution mechanism that cannot apply unrelated stack changes.

Missing evidence is `UNVERIFIED`, not a pass.

## Separate post-release controlled action

`src/cli/seed-source-catalog.ts` writes the unified catalogue into the Backline state table. It was not run during this assessment and is not part of repository-readiness verification.

After an authorised bounded release, the designated owner may propose a separately approved catalogue seed. That proposal must preserve `canonicalWritesEnabled=false`, identify every record it will write and include rollback and verification evidence. Only after the seed is approved and executed can the team prove successful coverage heartbeats and the live 26-hour alarm.

## Release acceptance evidence

Before any execution approval, the release packet must show:

- exact repository commit and live Lambda code-hash reconciliation;
- a reviewed CloudFormation diff containing only allowlisted changes;
- no resource replacement or deletion;
- no direct canonical table-write permission;
- global canonical writes absent or false;
- canonical-change ingestion absent with `canonicalChangeStreamsEnabled=false`;
- no unintended source, Capture or provider schedule activation;
- one authoritative daily-or-faster path for every active source;
- an explicit rollback route;
- confirmation that the release itself contains no hydration or canonical write.

After execution by the authorised infrastructure owner, acceptance must additionally prove:

- the intended worker code hashes are live;
- the source catalogue is current after its separately approved seed;
- each active coverage root records a successful heartbeat;
- the source freshness alarm is present and behaves as designed;
- would-write decisions are recorded;
- zero projection mutation calls occurred;
- canonical Artists, Venues and Events remain unchanged by Backline.

## Next repository work

While the live evidence is being gathered, repository-only work can continue with the rebuilt reliability controls and canonical hydration readiness. Neither workstream authorises deployment, stream activation, hydration or a canonical write.
