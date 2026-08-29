# Canonical BNDY continuous hydration

Status: code-ready, not enabled in production. Canonical writes remain disabled.

## Outcome

Backline can ingest every insert, update and removal from `bndy-artists`, `bndy-venues` and `bndy-events` as a one-way evidence feed. Festivals remain logical festival records in `bndy-events`.

Each change produces:

1. immutable private JSON evidence;
2. a `SourceObservation` keyed to the DynamoDB stream version;
3. atomised and semantic Claims;
4. a self-resolution for inserts and updates, or a superseded resolution plus `canonical-record-removed` Claim for removals;
5. a keyed sync checkpoint used by future delta hydration.

The worker has no `ProjectionQueue`, no BNDY API credentials and no permission on canonical tables except stream reads. Its sources are always shadow. A canonical change can therefore enter Backline but cannot loop back into BNDY.

## Catch-up hydration

The 2026-08-24 baseline predates current BNDY data. `npm run bndy:delta-hydration` scans the three canonical tables read-only, compares each record with its latest canonical-source Claim or sync checkpoint, and writes Backline evidence only for additions and changes. It also compares baseline resolutions with current IDs to record removals. Unchanged records receive a small checkpoint instead of another copy of their Claims.

Every run writes `DELTA_HYDRATION#<runId> / META` with exact scanned, unchanged, inserted, modified, removed, Claim and checkpoint counts. The manifest always reports `canonicalWritesEnabled: false`.

## Production HITL gate

These steps change production infrastructure or write the Backline production state and require explicit approval:

1. enable `NEW_AND_OLD_IMAGES` DynamoDB Streams on `bndy-artists`, `bndy-venues` and `bndy-events`;
2. publish the three exact stream ARNs to `/bndy/canonical/artists/stream-arn`, `/bndy/canonical/venues/stream-arn` and `/bndy/canonical/events/stream-arn`;
3. while streams retain changes, run one approved delta hydration from baseline `bndy-baseline-2026-08-24-v1`;
4. deploy Backline with CDK context `canonicalChangeStreamsEnabled=true`; each mapping starts at `TRIM_HORIZON`, uses partial-batch failure reporting and has a 14-day DLQ;
5. run `npm run bndy:activate-change-sources` against the deployed Backline state table;
6. prove one controlled insert, update and removal in a non-user-owned test record and verify evidence, Claims, resolution/checkpoint and zero canonical projection calls;
7. compare current canonical counts with the completed delta manifest and clear all worker/DLQ alarms.

Do not enable the global projection control as part of this gate. Hydration and canonical-write activation are separate decisions.
