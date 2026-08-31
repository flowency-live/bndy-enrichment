# Backline infrastructure ownership handoff

Status: repository evidence only

Prepared: 2026-08-31

Repository: `bndy-enrichment`

Stack: `BndyEnrichmentStack`

## Purpose and authority boundary

This document records what `bndy-enrichment` currently declares. It is a handoff to the authorised infrastructure agent, not evidence of live ownership or deployed state.

No AWS inventory, deployment, bootstrap, stream change, SSM change, queue operation, schedule change, hydration, provider activation or canonical write was performed while preparing it.

The infrastructure agent must verify every ownership statement against the live account and resolve every open boundary before any Backline deployment.

## Repository-declared ownership

| Domain | Resources declared by `BndyEnrichmentStack` | Current classification |
| --- | --- | --- |
| Backline stores | `StateTable`, `EvidenceBucket` | Enrichment-owned |
| Discovery | `GoogleDiscoveryQueue`, `GoogleDiscoveryDLQ`, `GoogleDiscoveryWorker`, `ScanPlanner`, `DailyScanRule` | Enrichment-owned |
| Source acquisition | `SourceScanQueue`, `SourceScanDLQ`, `BrowserScanQueue`, `BrowserScanDLQ`, `SourceDispatcher`, `SourceWorker`, `BrowserSourceWorker` | Enrichment-owned |
| Source health | `SourceHealthWorker`, `SourceDispatchTick`, `SourceHealthTick`, `SourceFreshnessAlarm` | Enrichment-owned |
| Projection | `ProjectionQueue`, `ProjectionDLQ`, `ProjectionWorker` | Enrichment-owned. The worker may call the canonical API only through the global write gate |
| Entity enrichment | `EntityEnrichmentQueue`, `EntityEnrichmentDLQ` | Enrichment-owned |
| Administration and trust | `BacklineAdminApi`, its Function URL, `TrustLoop`, `TrustLoopDailyClassification` | Enrichment-owned, subject to live verification and access review |
| Source schedules | Lemonrock hourly, daily and monthly rules; OnTheCase hourly rule | Enrichment-owned declarations. Authoritative schedule coverage must be reconciled before release |
| Historical failures | `HistoricalSourceFailureQuarantine` | Enrichment-owned and retained |
| Provider credential | `GeminiApiKey` secret | Created by this stack |
| Claim ingestion | `ClaimAuthorityStreamWorker` and its event mapping | Worker is enrichment-owned; source table and stream are external imports |
| Optional canonical-change ingestion | `CanonicalChangeStreamWorker`, `CanonicalChangeDLQ`, event mappings and alarms | Enrichment-owned only when explicitly enabled. Disabled by default |

## Cross-product boundary requiring an explicit decision

`BndyEnrichmentStack` currently creates both `bndy-capture-processor` and `bndy-capture-scan`, their processing queue and DLQ, and the five-minute scan rule. The Capture images bucket is imported by name and is not created here.

The infrastructure agent must confirm that:

1. `bndy-enrichment` is the sole IaC owner of the two Capture worker functions, queues and scan rule.
2. No SAM template or standalone workflow can update either function.
3. The Capture API, Capture table, image bucket and WhatsApp transport remain owned outside this repository.
4. The combined Capture and Enrichment deployment workflow remains disabled until this ownership is settled.

## External resources imported by this stack

These resources must not be created, mutated or adopted by `bndy-enrichment` without a separate ownership decision.

| Imported resource | Repository use | Required external owner |
| --- | --- | --- |
| `bndy-capture-images-${account}-${region}` | Read Capture evidence | Capture infrastructure owner |
| `bndy/mcp-service` secret | Canonical API authentication | Canonical API owner |
| `bndy/capture-service` secret | Capture authentication | Capture infrastructure owner |
| `/bndy/claims/stream-arn` | Resolve the Claim V2 stream | Claim V2 infrastructure owner |
| `bndy-entity-claims` table and stream | Claim authority ingestion | Claim V2 infrastructure owner |
| `bndy-artists`, `bndy-venues`, `bndy-events` tables | Optional canonical-change ingestion | Owner unresolved |
| `/bndy/canonical/artists/stream-arn` | Optional stream import | Owner unresolved |
| `/bndy/canonical/venues/stream-arn` | Optional stream import | Owner unresolved |
| `/bndy/canonical/events/stream-arn` | Optional stream import | Owner unresolved |

The projection worker's only permitted canonical mutation boundary is the canonical API. Direct table writes are not part of the enrichment ownership model.

## Safe current default

Canonical-change ingestion is guarded by the CDK context value `canonicalChangeStreamsEnabled`. The repository default is false. With that default, the stack does not declare the canonical stream worker, its DLQ, its event mappings or its alarms.

This is a repository property, not proof of live state. The infrastructure agent must verify that no equivalent live mappings or unmanaged stream consumers exist.

## Decisions required from the infrastructure agent

1. Map every live Backline resource to exactly one repository, stack and logical resource.
2. Confirm or correct the enrichment-owned list above.
3. Settle sole ownership of `bndy-capture-processor` and `bndy-capture-scan`.
4. Identify the IaC owner of `bndy-artists`, `bndy-venues` and `bndy-events`, including responsibility for stream configuration and SSM publication.
5. Confirm ownership of the Claim V2 table, stream and `/bndy/claims/stream-arn` parameter.
6. Find any overlapping workflow, stack or manually managed resource that can update an enrichment-owned resource.
7. Reconcile all declared schedules with the final Cowork export and legacy Signals schedules. Each source needs one authoritative path.
8. Return a classified CDK diff or CloudFormation change set before any Backline release is authorised.

## Evidence requested in the handoff response

The infrastructure agent should return:

- stack name, physical resource ID, logical resource ID, repository and owner for each resource;
- live Lambda code hash or version and its reconciled repository commit;
- event source mappings, EventBridge rules and enabled state;
- DynamoDB stream configuration and relevant SSM parameter value provenance;
- stack drift findings and unmanaged resources;
- the proposed CDK diff, with every addition, update, replacement and deletion classified;
- any ownership collision that prevents a bounded release.

## Actions that remain prohibited pending that response

- CDK or SAM deploy, bootstrap or change-set execution;
- enabling DynamoDB streams or event mappings;
- creating or changing canonical stream SSM parameters;
- source schedule activation or legacy writer changes;
- queue replay, initial hydration or delta hydration;
- provider activation or paid-provider calls;
- enabling canonical projection writes.

The next authorised enrichment work is repository-only preparation. All live infrastructure actions remain with the designated infrastructure agent.
