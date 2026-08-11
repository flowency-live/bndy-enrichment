# bndy Enrichment Engine

Google-first live music discovery and enrichment for **bndy**, with targeted Facebook evidence collection as an experimental fallback.

This repository contains the AWS-deployable prototype described in `docs/SPEC.md`.

## Core operating rule: FREE first

The engine deliberately separates **what bndy should retain/publish** from **what bndy should pay to enrich**:

```text
Discover dated gigs
  -> classify admission FREE / PAID / UNKNOWN
  -> one batched low-cost follow-up for UNKNOWN
  -> FREE: publish + enrich entities + allow graph expansion
  -> PAID: publish + retain ticket/admission evidence, but no enrichment/graph expansion
  -> UNKNOWN: hold, do not publish or enrich
```

This means a grassroots artist can still contribute the occasional ticketed gig to bndy. The paid gig remains useful canonical event data, clearly labelled `PAID_CONFIRMED`, but its venue/artist relationships do not trigger additional subsidised discovery work.

Paid-event venues are emitted as commercial/ticketed entity signals so bndy can retain/create them and mark them ticketed, while `autoEnrich=false` and `scanEligible=false` prevents them becoming new enrichment branches.

`COMMERCIAL_TICKETING` subjects are persisted with a 270-day suppression window. For venues, two confirmed paid events with no free evidence are enough to classify the venue as ticketed/commercial. The scan planner reads suppression state before queueing Gemini work. Pass `force:true` only when deliberately overriding suppression.

Entity classes are:

- `GRASSROOTS_FREE` - auto-enrich;
- `LIKELY_GRASSROOTS` - auto-enrich;
- `MIXED` - publish confirmed free and paid gigs, but no automatic rich entity enrichment;
- `COMMERCIAL_TICKETING` - publish discovered event data, suppress scheduled enrichment/scanning;
- `UNKNOWN` - no rich enrichment.

Absence of a ticket price is **never** treated as evidence that a gig is free.

## Current vertical slice

- AWS CDK infrastructure
- EventBridge scheduled scan planner
- SQS discovery queue + DLQ
- Gemini + Google Search grounded discovery worker
- FREE/PAID/UNKNOWN admission gate
- separate publish/enrichment/graph-expansion disposition
- commercial/ticketed venue signals
- commercial entity suppression state in DynamoDB
- structured event/evidence/enrichment schemas
- S3 evidence archive scaffold
- Secrets Manager integration
- local search CLI
- truth-set precision/recall evaluator
- Playwright Facebook `/events` scroll/network probe
- GitHub Actions CI and manual AWS deployment workflow

## Start locally

```bash
npm install
cp .env.example .env
# add GEMINI_API_KEY to .env
npm run build
npm test
npm run prototype:search -- --type artist --name "Killin Scarlet" --town "Northwich" --days 90
```

## Deploy to AWS

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

At minimum you will need:

1. an AWS account/role capable of CDK deployment;
2. a Gemini API key;
3. Node.js 22;
4. AWS CDK bootstrapped in the target account/region.

The CDK stack creates a Secrets Manager secret for Gemini. Populate it after the first deployment, then invoke the worker through the queue/schedule.

## Prototype order

1. Run artist-side and venue-side reconnaissance against the truth set.
2. Measure discovery recall plus FREE/PAID classification accuracy.
3. Measure Search queries consumed before and after the eligibility gate.
4. Measure rich-enrichment calls only for retained grassroots entities.
5. Use Facebook browser collection only where it adds measurable incremental recall.

The core metric remains **cost per verified, previously unknown FREE gig discovered**, while paid gigs are retained when discovered at no additional enrichment cost.
