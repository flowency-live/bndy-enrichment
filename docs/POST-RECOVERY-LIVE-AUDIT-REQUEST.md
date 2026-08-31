# Post-recovery Backline live-audit request

Status: ready for the authorised infrastructure agent

Prepared: 2026-08-31

Target region: `eu-west-2`

Primary stack: `BndyEnrichmentStack`

## Purpose

Establish the actual live Backline state after repository rescue and infrastructure ownership repair. This is a read-only evidence request. It does not authorise a deployment, configuration change, replay, hydration or canonical write.

The latest committed sanitised audit was generated at `2026-08-29T21:50:30Z`. It recorded the stack at `UPDATE_COMPLETE`, last updated at `2026-08-29T16:59:00Z`. It predates the rescued Backline changes now on `bndy-enrichment/main` and cannot prove their deployment.

That audit also lacked permission to read Lambda configurations and CloudWatch alarms. Its `lambdaFunctions` result was empty and its alarm section failed. A fresh audit must close those evidence gaps.

## Safety constraints

- Use a read-only audit role.
- Do not deploy, bootstrap, create a change set or repair drift.
- Do not enable or disable rules, mappings, streams, aliases or schedules.
- Do not write SSM parameters, secrets, queues, tables or S3 objects.
- Do not invoke Lambdas, replay queues, run hydration or call external providers.
- Do not expose secret values, evidence content, personal data, raw entity records or full resource ARNs in the published report.
- Record access denial as an explicit audit gap. Do not broaden permissions as part of the audit run.

## Required inventory

### CloudFormation

For `BndyEnrichmentStack` and any stack that claims one of its physical resources, report:

- stack status, creation time and last update time;
- template or deployment identity if available;
- logical resource ID, sanitised physical resource class and resource type;
- drift status for the stack and each resource;
- retained, imported or unmanaged resources associated with Backline;
- any physical resource referenced by more than one stack or repository.

### Lambda

For every Backline and Capture worker associated with `BndyEnrichmentStack`, report:

- logical role;
- runtime state and last modified timestamp;
- `CodeSha256`, published version and alias target where present;
- reconciliation to a repository commit, or `UNRECONCILED` with the reason;
- memory, timeout, architecture and ephemeral storage;
- reserved concurrency;
- event source mappings, enabled state, batch size, failure handling and maximum concurrency;
- attached log group and retention period.

Pay particular attention to:

- `bndy-capture-processor`;
- `bndy-capture-scan`;
- `ClaimAuthorityStreamWorker`;
- `ProjectionWorker`;
- source dispatcher and source workers;
- any live canonical-change stream worker.

### EventBridge and event-source mappings

Report every rule or mapping targeting a Backline-owned Lambda or queue:

- logical role and owner;
- enabled state;
- cadence or source type;
- sanitised target role;
- dead-letter and retry configuration;
- source ID or task kind where present;
- whether it duplicates a Signals, Cowork or other schedule.

This must include mappings that are not in `BndyEnrichmentStack` but target the same physical resource.

### DynamoDB and SSM

Report without returning table data or parameter values:

- stream enabled state, view type and latest stream-label timestamp for `bndy-entity-claims`, `bndy-artists`, `bndy-venues` and `bndy-events`;
- all event-source mappings consuming those streams;
- existence, last modified timestamp and owning stack or process for `/bndy/claims/stream-arn` and each `/bndy/canonical/*/stream-arn` parameter;
- whether each SSM parameter refers to the table's current stream generation;
- PITR, deletion protection and TTL state for the Backline state table;
- confirmation that no canonical table policy grants direct write access to an enrichment worker.

### SQS

For every stack-owned queue and DLQ, report:

- logical role;
- visible, in-flight and delayed counts;
- oldest-message age;
- visibility timeout, retention and redrive configuration;
- consumer mapping and maximum concurrency;
- DLQ alarm coverage;
- the historical quarantine count separately from active operational DLQs.

Do not purge, replay or sample message bodies.

### CloudWatch

Report:

- every alarm covering stack Lambda errors, throttles, iterator age, queue age and DLQ depth;
- state, reason timestamp, missing-data treatment and target resource role;
- Lambda log retention for every worker;
- resources without the expected alarm or retention coverage.

### Canonical-write safety

Prove or mark unverified:

- the global projection gate's live configuration;
- whether the deployed `ProjectionWorker` hash contains the rescued gate implementation;
- whether any enrichment role can write directly to canonical Artists, Venues or Events tables;
- whether any legacy Signals or Cowork writer remains enabled;
- whether any canonical-change stream or mapping is already active;
- whether any code path can bypass the canonical API and its write control.

Do not test this by making a write.

### Backline data health

Return aggregate counts and timestamps only:

- latest complete canonical baseline manifest and totals;
- latest canonical delta-hydration checkpoint, if any;
- observations, Claims, resolutions and evidence references by source ID;
- each configured source's enabled, shadow and health state;
- last scan, last successful scan, last failure and next scheduled time;
- active queue and DLQ counts;
- evidence object count and newest object timestamp;
- global write-state record and latest would-write decision timestamp.

## Required reconciliation output

The audit response should include these four tables.

### 1. Resource ownership

| Logical role | Sanitised physical class | Live stack | Intended repository | Status |
| --- | --- | --- | --- | --- |
| One row per resource | No secrets or full ARNs | Exact stack | Exact repository | `CONFIRMED`, `COLLISION`, `UNMANAGED` or `UNKNOWN` |

### 2. Lambda provenance

| Logical role | Live code hash | Repository commit | Match | Evidence gap |
| --- | --- | --- | --- | --- |
| One row per function | `CodeSha256` | Exact SHA if reconciled | `YES`, `NO` or `UNKNOWN` | Reason if unknown |

### 3. Schedule authority

| Source or task | Live cadence | Live owner | Competing path | Decision needed |
| --- | --- | --- | --- | --- |
| One row per active acquisition path | Exact rule | Stack, Signals or Cowork | Other active path | Keep, disable or investigate |

### 4. Safety gates

| Gate | Live state | Evidence | Result |
| --- | --- | --- | --- |
| Global canonical writes | On or off | Config and code hash | `PASS`, `FAIL` or `UNVERIFIED` |
| Canonical stream ingestion | On or off | Streams and mappings | `PASS`, `FAIL` or `UNVERIFIED` |
| Direct table-write access | Present or absent | IAM policy inspection | `PASS`, `FAIL` or `UNVERIFIED` |
| Legacy writers | Enabled or disabled | Rules and targets | `PASS`, `FAIL` or `UNVERIFIED` |

## Completion criteria

The audit is complete only when:

1. Every live Backline resource has one owner or an explicit ownership blocker.
2. Every live Lambda is reconciled to code or marked `UNRECONCILED`.
3. Every schedule and mapping has been enumerated, including external duplicates.
4. Canonical-write safety is proved without writing data.
5. Streams, SSM parameters, queues, alarms, log retention and drift are evidenced.
6. All access gaps are visible and no green status is inferred from missing evidence.

The result authorises planning and diff review only. Deployment, source activation, hydration and canonical writes remain separate HITL decisions.
