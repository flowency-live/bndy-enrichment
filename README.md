# bndy Enrichment Engine

Google-first live music discovery and enrichment for **bndy**, with targeted Facebook evidence collection as an experimental fallback.

This repository contains the AWS-deployable prototype described in `docs/SPEC.md`.

## Current vertical slice

- AWS CDK infrastructure
- EventBridge scheduled scan planner
- SQS discovery queue + DLQ
- Gemini + Google Search grounded discovery worker
- structured event/evidence schemas
- DynamoDB run/evidence state
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

1. Build a 25-artist / 25-venue truth set.
2. Run artist-side Google discovery.
3. Run venue-side Google discovery.
4. Measure union recall, precision and search cost.
5. Only then use the Facebook worker to measure incremental recall.

The core metric is **cost per verified, previously unknown gig discovered**.
