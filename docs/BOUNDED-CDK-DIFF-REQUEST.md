# Bounded Backline CDK diff request

Status: ready for the authorised infrastructure agent

Prepared: 2026-08-31

Repository: `flowency-live/bndy-enrichment`

Stack: `BndyEnrichmentStack`

Region: `eu-west-2`

## Purpose

Compare the rescued enrichment stack with the live `BndyEnrichmentStack` without deploying, creating a change set or changing any AWS resource. The output is evidence for release planning only.

This request does not authorise deployment. It must be executed by the designated infrastructure agent with a read-only role.

## Exact source state

Use a clean checkout of the current protected `main` branch. Record the exact commit SHA before running any command. Do not run this request from a feature branch, a locally modified worktree or a cached CDK assembly.

The repository owner will provide the intended commit SHA at handoff time. The infrastructure agent must fail the request if GitHub `main`, the checked-out commit and the reported SHA differ.

## Required context

Canonical-change ingestion must remain disabled:

```text
canonicalChangeStreamsEnabled=false
```

Do not run a comparison with that context set to true. Do not enable canonical table streams, publish stream ARNs to SSM or create event-source mappings.

## Repository-only preparation

Run these steps without AWS credentials first:

```bash
npm ci
npm run check
npx cdk synth BndyEnrichmentStack \
  --context canonicalChangeStreamsEnabled=false
```

Record:

- checked-out commit SHA;
- Node, npm and CDK versions;
- test result;
- synthesised resource count by CloudFormation type;
- SHA-256 hash of `cdk.out/BndyEnrichmentStack.template.json`;
- confirmation that the synthesised template contains no canonical-change worker, DLQ, alarm or event-source mapping.

Synthesis failure is a stop condition. Do not compensate by changing dependencies, context or source.

## Read-only live comparison

After repository preparation passes, assume the approved read-only audit role and run only the named stack comparison:

```bash
npx cdk diff BndyEnrichmentStack \
  --context canonicalChangeStreamsEnabled=false \
  --no-change-set
```

Requirements:

- use `--no-change-set` so this request does not create an AWS change set;
- do not use `cdk deploy`, `cdk bootstrap`, `sam deploy`, `sam sync` or `--all`;
- do not accept a CDK prompt that requests a write;
- do not modify stack parameters, tags, context or assets to make the diff smaller;
- preserve the complete unsanitised output only in the infrastructure agent's secure working area;
- publish a sanitised report with resource roles and logical IDs, not secrets, tokens or full ARNs.

If the read-only role cannot complete the comparison, report the missing permission and stop. Do not switch to a deployment role under this request.

## Required classification

Every diff entry must appear in exactly one of these classes.

| Class | Meaning | Release treatment |
| --- | --- | --- |
| `EXPECTED_RELEASE` | Required for the bounded projection-gate and source-health release | Candidate only after detailed review |
| `RELIABILITY_LATER` | Log retention, alarms or concurrency work intended for the later reliability release | Exclude from the first release |
| `OWNERSHIP_BLOCKER` | Capture workers, external imports or another resource with unsettled sole ownership | Stop until the owner decides |
| `CANONICAL_STREAM_BLOCKER` | Canonical table stream, SSM or event-mapping change | Prohibited in the first release |
| `SCHEDULE_CHANGE` | Addition, removal, target change, enablement or cadence change | Separate schedule reconciliation required |
| `IAM_EXPANSION` | New or broader permissions, especially canonical writes, secrets or cross-stack access | Security review required; canonical direct writes fail the release |
| `REPLACEMENT_OR_DELETION` | CloudFormation replacement, deletion or orphaning | Automatic stop |
| `UNEXPLAINED_DRIFT` | Difference not attributable to a reviewed repository change | Automatic stop |
| `NO_CHANGE` | Resource is identical to the live template | Record for completeness |

Do not combine entries into a general statement such as "Lambda updates". Each logical resource needs its own row.

## Mandatory resource groups

The report must explicitly classify:

- Backline state table and evidence bucket;
- every queue and DLQ;
- every Lambda function and event-source mapping;
- every EventBridge rule and target;
- every IAM role and policy statement change;
- the Backline admin Function URL;
- source freshness alarm and any other alarm;
- Claim V2 stream import and authority worker;
- `bndy-capture-processor` and `bndy-capture-scan`;
- imported Capture bucket and service secrets;
- any canonical Artists, Venues or Events stream resource, even if the result is correctly absent.

## First-release acceptance boundary

The initial bounded release may contain only changes necessary to prove:

1. global canonical projection is default-off and fail-closed;
2. would-write decisions are observable without making canonical writes;
3. the unified source catalogue and freshness worker are present;
4. the 26-hour source freshness alarm is present;
5. canonical-change ingestion remains absent;
6. no direct canonical table-write permission is added;
7. no source, Capture or provider schedule is activated as a side effect.

Repository history may have accumulated other legitimate changes. Their legitimacy does not make them part of this release. Any unrelated diff must be excluded, split into a later release or accepted through a separate explicit decision.

## Automatic stop conditions

Stop and return the evidence without proposing execution if the diff includes:

- any resource replacement or deletion;
- any change to a canonical Artists, Venues or Events table or stream;
- creation or update of `/bndy/canonical/*/stream-arn` parameters;
- an enabled canonical stream event-source mapping;
- direct canonical table-write IAM permissions;
- a change to Capture processor or scanner ownership;
- a new or enabled source schedule not reconciled with Signals and Cowork;
- provider activation, provider invocation or paid-provider concurrency;
- an unexplained physical-resource or template mismatch;
- a resource controlled by more than one stack or repository.

## Report format

Return one row per logical resource:

| Logical resource | Type | Diff action | Classification | Intended owner | Evidence | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Exact logical ID | CloudFormation type | Add, modify, replace, delete or none | One required class | Repository and stack | Sanitised diff excerpt | Include, exclude or stop |

Also return:

- the exact GitHub commit SHA;
- template hash and resource counts;
- the complete list of stop conditions triggered;
- a proposed first-release resource allowlist;
- a proposed later-release list;
- unresolved ownership questions;
- confirmation that no AWS write occurred.

## What this result authorises

A completed and reviewed report authorises preparation of a release branch and, if necessary, a separately approved CloudFormation change set. It does not authorise creation or execution of that change set, a CDK deployment, stream enablement, source activation, hydration or canonical writes.
