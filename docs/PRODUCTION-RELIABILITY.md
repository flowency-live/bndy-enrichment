# Backline production reliability controls

Status: implemented in the repository, not deployed

Prepared: 2026-08-31

## Purpose

Rebuild the reliability controls that were lost before the repository rescue, using the current `bndy-enrichment` stack as the source of truth. This change is repository-only. It does not authorise a CDK deployment, AWS write, source activation, queue operation, hydration or canonical write.

The default stack now synthesises a 24-alarm reliability baseline, explicit 30-day retention for every application Lambda log group, and bounded concurrency for source, paid, browser and projection workers.

## Default-state control inventory

| Control | Count | Behaviour |
| --- | ---: | --- |
| Application Lambda log-retention policies | 12 | Retain logs for 30 days |
| Lambda error alarms | 12 | Alarm on one error in one five-minute period |
| Operational DLQ alarms | 6 | Alarm on one visible message in one five-minute period |
| Active queue-age alarms | 6 | Alarm after two consecutive five-minute periods beyond the queue-specific age threshold |
| Reserved-concurrency caps | 5 | Maximum of two concurrent executions per capped worker |
| SQS maximum-concurrency caps | 5 | Maximum of two concurrent batches per capped SQS consumer |

All alarms treat missing data as not breaching. Missing data is therefore not evidence of healthy execution, and live audit must still prove that scheduled work is running.

## Log retention

The stack uses explicit `LogRetention` resources for each application Lambda. This preserves the conventional `/aws/lambda/<function-name>` log-group path and sets retention to 30 days without replacing the Lambda.

The default stack covers:

- Claim authority stream worker;
- source dispatcher;
- source-health worker;
- standard source worker;
- browser source worker;
- projection worker;
- Backline admin API;
- trust loop;
- Google discovery worker;
- scan planner;
- Capture processor;
- Capture scanner.

When `canonicalChangeStreamsEnabled=true`, the optional canonical-change worker also receives 30-day retention. This repository work does not enable that context.

## Lambda error alarms

The following logical workers each have error coverage:

| Worker | Alarm role |
| --- | --- |
| Claim authority stream worker | Claim V2 stream-processing failure |
| Source dispatcher | Due-source scheduling failure |
| Source-health worker | Missing, invalid or older-than-26-hour coverage heartbeat |
| Standard source worker | Acquisition or persistence failure |
| Browser source worker | Browser acquisition or persistence failure |
| Projection worker | Globally gated projection failure |
| Backline admin API | Read-only intelligence API failure |
| Trust loop | Classification failure |
| Google discovery worker | Paid discovery failure |
| Scan planner | Daily discovery planning failure |
| Capture processor | Paid Capture-processing failure |
| Capture scanner | Capture polling failure |

The source-health error alarm remains `SourceFreshnessAlarm`, preserving its source-policy meaning. It is counted once in the 12-error-alarm total.

## Queue alarms

| Active queue | Operational DLQ | Oldest-message threshold |
| --- | --- | ---: |
| Google discovery | Google discovery DLQ | 30 minutes |
| Capture processing | Capture processing DLQ | 15 minutes |
| Standard source scan | Source scan DLQ | 30 minutes |
| Browser source scan | Browser scan DLQ | 30 minutes |
| Projection | Projection DLQ | 15 minutes |
| Entity enrichment | Entity enrichment DLQ | 30 minutes |

The retained `HistoricalSourceFailureQuarantine` is deliberately excluded. It contains preserved forensic evidence from superseded work and is not an active operational DLQ. Its non-zero depth must not page the current pipeline.

`EntityEnrichmentQueue` currently has no consumer declared in this stack. Its queue-age alarm is intentional: unresolved ownership or a missing downstream consumer must become visible rather than silently accumulating work.

## Concurrency limits

| Worker | Reserved concurrency | SQS maximum concurrency | Reason |
| --- | ---: | ---: | --- |
| Standard source worker | 2 | 2 | Protect external sources and prevent retry amplification |
| Browser source worker | 2 | 2 | Bound Chromium cost, memory pressure and remote-site load |
| Projection worker | 2 | 2 | Bound canonical API pressure even if the global gate is later approved |
| Google discovery worker | 2 | 2 | Bound paid-provider calls and spend rate |
| Capture processor | 2 | 2 | Bound paid-provider calls and Capture API pressure |

Reserved concurrency is a hard Lambda ceiling. SQS maximum concurrency stops the corresponding event-source mapping from attempting to exceed the same ceiling.

## Optional canonical-change path

The opt-in canonical-change worker retains its pre-existing error and DLQ alarms and now receives 30-day log retention. It is still absent from the default template when:

```text
canonicalChangeStreamsEnabled=false
```

No canonical stream, stream parameter, mapping or hydration is created or run by this change.

## Regression contract

`test/stack-reliability.test.ts` synthesises both the default and opt-in templates and verifies:

- 12 default 30-day application log-retention resources;
- 13 only when the optional canonical-change worker is explicitly included;
- the default 24-alarm split of 12 errors, 6 operational DLQs and 6 active queue-age alarms;
- immediate error and DLQ thresholds;
- two-period queue-age thresholds;
- the five concurrency-limited workers and mappings;
- exclusion of the historical quarantine from operational alarms;
- absence of the canonical-change worker in the default template.

## Deployment boundary

These controls are not part of the first bounded projection-gate and source-health release. They remain classified as `RELIABILITY_LATER` until the authorised infrastructure agent returns a complete live audit and per-resource CDK diff.

Before any reliability deployment is proposed, the owner must:

1. Reconcile every live Lambda, queue, DLQ and log group to one stack and repository.
2. Confirm that adopting 30-day retention will not collide with another stack's log-group ownership.
3. Classify the Capture processor and scanner changes under the resolved Capture/Enrichment owner.
4. Confirm the `EntityEnrichmentQueue` consumer and ownership model.
5. Review concurrency values against live traffic and provider budgets.
6. Review all 24 alarm additions and their dimensions in a no-change-set CDK diff.
7. Choose and approve notification routing separately. This patch creates alarm state but does not invent an SNS, PagerDuty or other notification owner.
8. Prove there are no replacements, deletions, source activations, canonical stream changes or canonical-write permission changes.

## Post-deployment acceptance

After a separately authorised infrastructure release, acceptance requires:

- every application log group showing a 30-day retention policy;
- all expected alarms present with the reviewed dimensions and thresholds;
- no operational DLQ messages;
- active queues below their age thresholds;
- reserved and mapping concurrency matching the approved values;
- no unexplained Lambda throttling;
- no unintended source or Capture schedule change;
- canonical-change ingestion still absent unless separately approved;
- canonical writes still disabled.

Throttle and DynamoDB iterator-age alarms are not invented in this patch without live workload evidence and an agreed notification policy. The authorised live audit must report those metrics and any existing alarms so a later bounded change can add useful thresholds without producing unowned noise.
