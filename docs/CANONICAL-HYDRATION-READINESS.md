# Canonical hydration readiness checkpoint

Status: repository safeguards ready, execution blocked

Prepared: 2026-08-31

## Decision

Backline has the code needed to refresh its stale canonical baseline and then consume canonical changes continuously. The implementation remains one-way and shadow-only, but no hydration or stream activation is currently authorised.

The remaining work is primarily live evidence, sole-resource ownership and an execution handoff. This checkpoint prepares those decisions without touching AWS.

## Repository safety boundary

| Operation | Default behaviour | Required write confirmation | Additional fail-closed check |
| --- | --- | --- | --- |
| Canonical baseline | Refuses to start | `WRITE_BACKLINE_CANONICAL_BASELINE` | Global canonical writes must be disabled; snapshot ID and timestamp must be explicit |
| Delta hydration plan | Read-only with `--dry-run` | None because no data is written | Global canonical writes must be disabled; named baseline must be complete and shadow-only |
| Delta hydration write | Refuses to start | `WRITE_BACKLINE_CANONICAL_DELTA` | Same gate and baseline checks; baseline and run IDs must be explicit |
| Canonical change-source activation | Refuses to start | `ACTIVATE_BACKLINE_CANONICAL_CHANGE_SOURCES` | Global canonical writes must be disabled |

The confirmation tokens prevent an ambiguous command from becoming a write. They are not approvals by themselves. An authorised human must still approve the exact run, and the designated infrastructure owner must execute it with the intended role.

## What delta dry-run proves

An authorised read-only operator can run:

```bash
STATE_TABLE=<backline-state-table> \
EVIDENCE_BUCKET=<backline-evidence-bucket> \
npm run bndy:delta-hydration -- \
  --baseline-snapshot-id=<approved-complete-baseline> \
  --run-id=<planned-run-id> \
  --dry-run
```

The plan reads:

- the global projection control;
- the exact baseline manifest;
- canonical Artists, Venues and Events records;
- existing Backline canonical Claims and sync checkpoints;
- baseline resolutions used to identify removals.

It reports scanned, unchanged, would-insert, would-modify, would-remove and planned-checkpoint totals. It does not write source configuration, checkpoints, evidence, Observations, Claims, resolutions or a run manifest.

Dry-run results are planning evidence only. The canonical tables can change after the scan, and a DynamoDB `Scan` is not a transactionally consistent corpus snapshot.

## Required live evidence before a write

| Evidence | Required result | Owner |
| --- | --- | --- |
| Global projection control | Missing or explicitly false | Infrastructure audit owner |
| Deployed projection code | Rescued default-off, fail-closed implementation | Infrastructure audit owner |
| Direct canonical table-write IAM | Absent from all enrichment workers | Infrastructure audit owner |
| Baseline manifest | Exact ID, `status=complete`, `shadow=true`, `canonicalWritesEnabled=false` | Backline operator |
| Baseline counts | Reconciled with its stored resolutions and evidence totals | Backline operator |
| Current canonical counts | Artists, Venues, Events and logical Festivals counted without returning records | Infrastructure audit owner |
| Canonical table ownership | One approved IaC owner per table and stream configuration | Infrastructure owner |
| Stream SSM ownership | One approved writer for each `/bndy/canonical/*/stream-arn` parameter | Infrastructure owner |
| Bounded CDK diff | No replacement, deletion, direct canonical-write grant or unrelated schedule change | Infrastructure owner |
| Signals and Cowork | No competing canonical writer or duplicate source path | Relevant owners |

Any missing item is a blocker, not an assumed pass.

## Controlled execution sequence

The following is a handoff sequence, not authorisation to execute it:

1. Complete the fresh read-only live audit and ownership ledger.
2. Run the delta hydration in `--dry-run` mode with a read-only role and review the proposed totals.
3. Review a default-off CDK synthesis and the complete live diff. Keep `canonicalChangeStreamsEnabled=false` at this stage.
4. The approved canonical-table owner enables `NEW_AND_OLD_IMAGES` streams and publishes the exact current stream ARNs. Record each stream label and the 24-hour retention deadline.
5. Re-run the read-only delta plan if canonical counts or the baseline evidence changed materially.
6. Approve one exact baseline ID, run ID, expected count range, role, start window, abort threshold and rollback procedure.
7. Run the confirmed delta hydration. It writes only Backline evidence, Claims, resolutions, source state, checkpoints and its manifest.
8. Before the oldest retained stream record can expire, review and execute the separately approved change set that adds the canonical-change worker and mappings with `canonicalChangeStreamsEnabled=true`.
9. Confirm every mapping starts at `TRIM_HORIZON`, uses partial-batch failure reporting and targets the intended 14-day DLQ.
10. Activate the four shadow canonical change-source records with the exact confirmation token.
11. Under a separate test-data approval, have the authorised owner make one controlled insert, update and removal on a clearly non-user-owned record.
12. Prove the evidence, Observation, Claims, resolution, checkpoint and removal semantics, then reconcile counts and clear operational alarms.
13. Prove zero ProjectionQueue messages and zero canonical mutation calls caused by hydration.

If the stream-retention window becomes too short to finish safely, stop and repeat the planning sequence. Do not race a deployment to preserve an expiring window.

## Automatic stop conditions

Stop without writing if:

- global canonical writes are enabled or cannot be read;
- the named baseline is missing, failed, incomplete or not shadow-only;
- canonical counts fall outside the reviewed range;
- a canonical row lacks an ID;
- any canonical table or stream lacks a sole approved owner;
- the CDK diff includes replacement, deletion, Capture ownership changes or unrelated schedule activation;
- the stream view is not `NEW_AND_OLD_IMAGES`;
- an SSM parameter points at an old stream generation;
- the 24-hour stream-retention window cannot be maintained;
- the Backline state table, evidence bucket, worker or DLQ is unhealthy;
- a worker gains direct canonical table-write permission;
- Signals or Cowork still has a competing writer;
- the proposed action includes canonical projection enablement.

## Fizgig and Live Band Photos

Records already imported into canonical BNDY from Fizgig or Live Band Photos will be represented by the global canonical hydration as assertions about current BNDY state. Where a recoverable source label exists, Backline preserves that label as provenance metadata. It does not treat the label as source-native evidence or independent authority.

Their source-specific backlog remains separate:

1. identify the existing canonical records and retained import lineage without recreating them;
2. take an immutable source-native initial snapshot;
3. resolve source candidates to the existing canonical IDs;
4. compare the source snapshot with canonical hydration and expose conflicts;
5. run future source changes through a shadow BAU adapter;
6. keep canonical projection disabled.

This avoids duplicate canonical entities while still giving Backline real Fizgig and Live Band Photos evidence rather than relying forever on a legacy source label.

## Completion definition

Hydration readiness is complete when the repository checks pass and the infrastructure owner can execute the sequence using explicit IDs, exact confirmations, a read-only plan, a classified change set and measurable stop conditions.

Production hydration is complete only when the authorised run manifest is complete, stream continuity is proved, alarms are clear, counts reconcile and zero canonical projection is evidenced. These are separate states and must not be collapsed into one green status.

No AWS call, data read, data write, stream change, hydration or source activation was performed while preparing this checkpoint.
