> **AUTHORITY DECLARATION.** This document is the single authoritative target architecture for BNDY enrichment, source ingestion, observations, claims, reconciliation and the future knowledge graph. Any conflicting target-state document in `bndy-signals`, Cowork, Obsidian or another repository is superseded by this file. Execution sequence and scope live in `docs/BUILD-PLAN.md`.

# BNDY Source Reconciliation & Knowledge Graph Architecture

**Status:** Architecture paper  
**Date:** 19 August 2026  
**Scope:** `bndy-enrichment`, venue gig sources, scheduled source reconciliation, claim/evidence model, future knowledge graph, BNDY projections and operational tooling.

---

## 1. Executive summary

BNDY should evolve from a collection of import jobs into a **source reconciliation platform**.

The key architectural principle is:

> **Sources do not create truth. Sources create claims. BNDY derives its current view of artists, venues and gigs from the claims it holds.**

This is the natural next step from the current BNDY import runbook and the new AWS `bndy-enrichment` service.

The immediate requirement is practical:

- allow a venue to mark one of its website URLs as a **Gig Source**;
- scan all enabled venue gig sources on a schedule;
- detect new, changed, cancelled and removed gigs;
- resolve artists and venues through existing BNDY APIs;
- create or update events through existing BNDY APIs;
- preserve provenance and evidence;
- avoid reintroducing events that another stronger source has already cancelled.

The longer-term requirement is more important:

- all source scrapes, Facebook captures, posters, venue websites and curated feeds should produce **observations and claims**;
- those claims should later form a BNDY knowledge graph;
- BNDY should infer the most likely real-world artist, venue and event from multiple independent claims;
- the existing Artist, Venue and Event tables remain fast **materialised projections of what BNDY currently believes**.

This architecture is designed so the source collectors built now do **not** need to be rewritten when BNDY moves to a true graph store.

---

## 2. Current position

### 2.1 Existing AWS enrichment platform

`bndy-enrichment` already provides a strong base:

- AWS CDK;
- DynamoDB state table;
- private S3 evidence bucket;
- SQS queues and DLQs;
- Lambda workers;
- EventBridge schedules;
- Secrets Manager;
- Gemini;
- service-to-service authentication to BNDY;
- capture processing from `bndy-capture`.

The current enrichment stack already uses a scheduled planner, queue workers, evidence storage and a separate Capture queue. This should be extended rather than replaced.

### 2.2 Existing BNDY canonical write path

The enrichment service already calls the production APIs rather than writing directly into production domain tables.

Current canonical writes include:

- `POST /api/artists/find-or-create`
- `PUT /api/artists/{id}/mcp`
- `POST /api/venues/find-or-create`
- `POST /api/events/community`

This remains the correct boundary.

The enrichment/graph system may infer identities and claims, but existing BNDY domain APIs remain authoritative for:

- artist uniqueness;
- Facebook identity matching;
- venue Google Place identity;
- event uniqueness;
- sentinel enforcement;
- protected/owner-managed records;
- validation.

The knowledge graph must **not** become a second competing CRUD implementation.

---


## 2A. AS-BUILT: Current `bndy-enrichment` AWS platform

This section describes the implementation that exists today. It is deliberately separate from the target source-reconciliation and knowledge-graph design later in this paper.

### 2A.1 Repository and application stack

Repository:

```text
flowency-live/bndy-enrichment
```

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 22 |
| Module system | ES modules |
| Infrastructure as code | AWS CDK v2 |
| AWS SDK | AWS SDK for JavaScript v3 |
| Validation | Zod |
| Unit tests | Vitest |
| Bundling | esbuild through CDK `NodejsFunction` |
| Local TS execution | tsx |
| Browser experimentation | Playwright |
| CI | GitHub Actions |
| Production cloud | AWS |
| Primary region | `eu-west-2` |

Principal repository scripts:

```text
npm run build
npm run test
npm run check
npm run synth
npm run deploy
npm run destroy
npm run prototype:search
npm run evaluate
npm run facebook:probe
```

The CI path runs `npm install`, TypeScript build, Vitest and `cdk synth` on Node.js 22.

### 2A.2 Current AWS topology

The CDK stack is `BndyEnrichmentStack`.

```text
BndyEnrichmentStack
│
├── DynamoDB
│   └── StateTable
│
├── S3
│   ├── EvidenceBucket
│   └── imported bndy-capture-images-<account>-<region>
│
├── SQS
│   ├── GoogleDiscoveryQueue
│   ├── GoogleDiscoveryDLQ
│   ├── CaptureProcessingQueue
│   └── CaptureProcessingDLQ
│
├── Lambda
│   ├── ScanPlanner
│   ├── GoogleDiscoveryWorker
│   ├── bndy-capture-scan
│   └── bndy-capture-processor
│
├── EventBridge
│   ├── DailyScanRule
│   └── CaptureScanRule
│
├── Secrets Manager
│   ├── GeminiApiKey
│   ├── bndy/mcp-service
│   └── bndy/capture-service
│
└── imported BNDY domain tables
    ├── bndy-artists
    └── bndy-venues
```

### 2A.3 DynamoDB state

`StateTable` uses:

```text
PK: pk
SK: sk
billing: PAY_PER_REQUEST
point-in-time recovery: enabled
removal policy: RETAIN
```

The current Google discovery path stores per-entity run records:

```text
PK ENTITY#<entityType>#<bndyId>
SK RUN#<retrievedAt>#<runId>
```

and an eligibility record:

```text
PK ENTITY#<entityType>#<bndyId>
SK ELIGIBILITY
```

Eligibility includes suppression state, classification, free/paid/unknown event counts, ticketed-venue indicators and next eligible time.

This table is already a useful base for source state and graph-shaped records. A dedicated knowledge table can be introduced later if access patterns justify it.

### 2A.4 Evidence and image storage

The stack creates a private S3 Evidence bucket with:

```text
S3-managed encryption
block public access
SSL enforcement
RETAIN removal policy
abort incomplete multipart uploads after 7 days
```

The stack also imports the private Capture image bucket:

```text
bndy-capture-images-<AWS account>-<AWS region>
```

The Capture processor has read access to that bucket for multimodal poster processing. The target design later in this paper extends the Evidence bucket into the immutable raw-observation store.

### 2A.5 Secrets and authentication

Current Secrets Manager dependencies:

```text
GeminiApiKey
bndy/mcp-service
bndy/capture-service
```

Gemini accepts a secret containing `apiKey` and also understands the legacy `GEMINI_API_KEY` key.

The Capture processor authenticates to `https://api.bndy.co.uk` using a bearer token from `bndy/mcp-service`.

The Capture scanner and processor authenticate to `https://capture.bndy.co.uk` using `bndy/capture-service`.

AWS service access uses Lambda IAM execution roles rather than application access keys.

### 2A.6 Generic Google discovery path

```text
EventBridge DailyScanRule
        ↓
ScanPlanner
        ↓
GoogleDiscoveryQueue
        ↓
GoogleDiscoveryWorker
        ↓
Gemini + Google Search grounding
        ↓
StateTable
        ↓
suggested enrichment metadata
```

The current daily rule runs at **03:15 UTC**.

`ScanPlanner` validates supplied entities, reads suppression state, excludes entities still suppressed, and sends eligible entities to SQS in batches.

Important current limitation: the planner is still a prototype hook. The scheduled rule currently invokes it with an empty `entities` array. It does not yet autonomously enumerate all BNDY artists or venues.

That is an important design lesson for the new source dispatcher: it should enumerate an explicit Gig Source registry.

### 2A.7 Google Discovery Worker

Current worker configuration:

```text
runtime: Node.js 22
memory: 1024 MB
timeout: 5 minutes
SQS batch size: 1
partial batch failures: enabled
Gemini model: gemini-3.6-flash
default horizon: 90 days
```

It:

1. parses the entity;
2. loads Gemini credentials;
3. runs grounded discovery;
4. calculates eligibility/suppression;
5. writes the full discovery run to `StateTable`;
6. updates the entity's current `ELIGIBILITY` record;
7. optionally writes enrichment suggestions to the existing BNDY artist or venue record.

### 2A.8 Legacy direct-write exception

The older Google-discovery path still writes review-oriented enrichment metadata directly to `bndy-artists` and `bndy-venues`.

It does **not** directly replace the canonical public fields. It writes:

```text
enrichment_status = needs_review
enrichment_date
enrichment_data
```

Artist suggestions can include Facebook URL, website URL, bio, genres, artist type, act types, confidence, evidence URLs and notes. Venue suggestions can include website, Facebook, confidence and notes.

This is an **as-built legacy path** for Godmode/review.

**Target decision:** retire direct domain-table enrichment writes. Future source collectors should write evidence and claims to enrichment storage, then project accepted changes through canonical BNDY APIs.

### 2A.9 Capture ingestion path

The newer Capture flow is closer to the intended target architecture.

```text
Android / Capture API
        ↓
capture.bndy.co.uk
        ↓
bndy-capture-scan
        ↓
CaptureProcessingQueue
        ↓
bndy-capture-processor
        ↓
Gemini + Google grounding
        ↓
canonical BNDY APIs
```

### 2A.10 Capture scanner

Lambda:

```text
bndy-capture-scan
```

Schedule:

```text
every 5 minutes
```

Configuration:

```text
memory: 512 MB
timeout: 1 minute
default scan limit: 25
```

The scanner currently:

1. reads unprocessed Capture records;
2. sorts newest first;
3. ignores `manual-test`;
4. canonicalises shared URLs;
5. requires a public URL or uploaded image reference;
6. deduplicates within the current scan batch;
7. atomically claims the capture for 20 minutes;
8. enqueues `{captureId}`.

URL canonicalisation strips common Facebook and tracking parameters including `rdid`, `mibextid`, `ref`, `refsrc`, `sfnsn`, `__tn__`, `eid` and `utm_*`.

### 2A.11 Capture processor

Lambda:

```text
bndy-capture-processor
```

Configuration:

```text
runtime: Node.js 22
memory: 1024 MB
timeout: 5 minutes
SQS batch size: 1
partial batch failures: enabled
```

The processor:

1. loads the Capture record;
2. performs Gemini/Google discovery;
3. handles URL or image evidence;
4. resolves or creates the artist;
5. patches only genuinely missing fields on matched artists;
6. resolves venues;
7. creates or matches events;
8. writes the processing result into Capture notes;
9. marks the Capture processed, ignored or failed.

Persistent processing errors are finalised after three SQS receives rather than retrying forever.

### 2A.12 Multimodal poster path

The Capture discovery layer can retrieve a private image from S3 and send it to Gemini as multimodal input.

Current image cap:

```text
15 MB
```

Supported Capture image MIME types include:

```text
image/jpeg
image/png
image/webp
image/gif
```

Poster discovery is intended to:

- inspect the image itself;
- identify the represented act;
- distinguish event/festival names from physical venues;
- discover a canonical Facebook identity where possible;
- extract future gig rows;
- classify admission as `FREE_CONFIRMED`, `PAID_CONFIRMED` or `UNKNOWN`;
- avoid treating missing price as proof of free admission;
- resolve physical venues before event creation.

This is the most natural existing path to migrate first from a direct discovery result into the Observation/Claim model.

### 2A.13 Canonical BNDY API client

The Capture processor uses the service-authenticated BNDY API client.

Current operations include:

```http
POST /api/artists/find-or-create
GET  /api/artists/{id}
PUT  /api/artists/{id}/mcp
POST /api/venues/find-or-create
POST /api/events/community
```

Artist type mappings include:

```text
Band       → band
Solo Act   → solo
Duo        → duo
Trio       → trio
Group      → group
DJ         → dj
Collective → collective
```

Act type mappings include:

```text
Originals   → originals
Covers      → covers
Tribute Act → tribute
```

The Capture path therefore already demonstrates the desired boundary:

```text
discovery/enrichment
        ↓
canonical domain API
        ↓
production domain record
```

### 2A.14 Current event idempotency

Capture-created events carry:

```text
externalIds.source = bndy-capture
```

The Event API remains responsible for canonical duplicate detection. A `409`/`DUPLICATE_EVENT` resolves to the existing event rather than becoming a failed write.

This principle remains in the graph design: **source identity is provenance; domain identity is enforced by canonical BNDY resolvers.**

### 2A.15 SQS retry and DLQ model

```text
GoogleDiscoveryQueue
  → max 3 receives
  → GoogleDiscoveryDLQ

CaptureProcessingQueue
  → max 3 receives
  → CaptureProcessingDLQ
```

Workers use partial batch failure reporting. One failed message can retry without replaying successful messages.

### 2A.16 IAM boundaries

Current function-level permissions include:

```text
ScanPlanner
  → read StateTable
  → send GoogleDiscoveryQueue

GoogleDiscoveryWorker
  → write StateTable
  → read Gemini secret
  → read/write EvidenceBucket
  → write bndy-artists
  → write bndy-venues

CaptureScanner
  → read Capture service secret
  → send CaptureProcessingQueue

CaptureProcessor
  → read Gemini secret
  → read Capture service secret
  → read BNDY service secret
  → read Capture image bucket
```

The new source scanner should preserve this least-privilege pattern.

### 2A.17 CI and deployment

GitHub Actions CI currently runs:

```text
checkout
Node.js 22
npm install
npm run build
npm run test
npm run synth
```

CDK deployment is exposed through:

```text
npm run deploy
→ cdk deploy --all
```

Production deployment should use GitHub OIDC to assume an AWS deployment role rather than storing AWS access keys. AWS role configuration is therefore an environment/deployment prerequisite, not application code.

### 2A.18 Current tech stack summary

| Concern | As built |
|---|---|
| Infrastructure | AWS CDK v2 |
| Cloud | AWS |
| Region | `eu-west-2` |
| Compute | AWS Lambda |
| Runtime | Node.js 22 |
| Language | TypeScript |
| Queues | Amazon SQS |
| Retry isolation | SQS DLQs |
| Scheduling | Amazon EventBridge |
| State | Amazon DynamoDB |
| Evidence | Amazon S3 |
| Secrets | AWS Secrets Manager |
| AI | Gemini 3.6 Flash |
| Search grounding | Google Search through Gemini |
| Validation | Zod |
| Domain writes | BNDY HTTP APIs |
| Legacy suggestion writes | direct DynamoDB enrichment metadata |
| API auth | bearer service tokens from Secrets Manager |
| AWS auth | IAM execution roles |
| Tests | Vitest |
| Build | TypeScript + esbuild |
| CI | GitHub Actions |
| Browser experimentation | Playwright |
| Mobile intake | `bndy-capture` Android + Capture API |
| Poster intake | private S3 image + Gemini multimodal |

### 2A.19 Current end-to-end flows

#### Flow A: Facebook/profile Capture

```text
Android Share
   ↓
bndy-capture
   ↓
Capture API
   ↓
Capture record
   ↓
5-minute scanner
   ↓
CaptureProcessingQueue
   ↓
Capture processor
   ↓
Gemini + Google grounding
   ↓
Artist resolver
   ↓
Venue resolver
   ↓
Event API
   ↓
BNDY
```

#### Flow B: poster Capture

```text
Android image share
   ↓
private Capture S3 bucket + Capture record
   ↓
Capture scanner
   ↓
Capture processor
   ↓
S3 GetObject
   ↓
Gemini multimodal + Google grounding
   ↓
artist / venue / event resolution
   ↓
BNDY APIs
```

#### Flow C: generic entity discovery

```text
EventBridge
   ↓
ScanPlanner
   ↓
GoogleDiscoveryQueue
   ↓
GoogleDiscoveryWorker
   ↓
Gemini
   ↓
StateTable
   ↓
suggested enrichment metadata on artist/venue
```

Flow C is currently infrastructure-ready but not autonomously supplied with BNDY entities by the scheduled rule.

### 2A.20 As-built versus target

| Capability | As built | Target |
|---|---|---|
| Mobile URL Capture | yes | Observation/Claim producer |
| Poster ingestion | yes | Observation/Claim producer |
| Gemini grounding | yes | shared extraction service |
| SQS isolation | yes | expand to all sources |
| Evidence S3 | yes | immutable observation store |
| State DynamoDB | yes | source/claim/resolution state |
| Venue website scanning | no | first-class Gig Source |
| Source registry | no | yes |
| Curated source adapters | not in AWS | yes |
| Delta reconciliation | mainly runbook/Cowork | cloud-native |
| Tombstones | local runbook/file model | durable AWS model |
| Multi-source conflict reasoning | no | yes |
| Claim store | no | yes |
| Knowledge graph | no | graph-shaped first, Neptune later |
| Provenance UI | no | admin source/event provenance |
| Canonical API projection | Capture path yes | all paths |
| Direct domain-table enrichment | Google path yes | retire |
| Autonomous generic planner | no | source registry dispatcher |

---

## 3. Design goals

The system must:

1. Add venue website gig sources without bespoke scheduled tasks.
2. Support curated sources such as GigsNews, OnTheCase, SceneEye and Lemonrock through the same framework.
3. Preserve the hard-earned import behaviour captured in the current runbook.
4. Store raw evidence and extracted claims.
5. Reconcile multiple claims about the same real-world gig.
6. Preserve disagreement rather than overwriting it.
7. Use source authority when claims conflict.
8. Make cancellation decisions durable across sources.
9. Prevent recursive enrichment from becoming an uncontrolled crawler.
10. Allow deterministic extraction where possible and AI extraction where useful.
11. Keep normal BNDY reads fast.
12. Allow a later migration to a graph database without redesigning collectors.
13. Make every automated change explainable.
14. Minimise routine human review.
15. Keep source-specific parsing quirks separate from global domain rules.

---

## 4. Core model

BNDY should distinguish five concepts.

### 4.1 Entity

A real-world thing BNDY believes exists.

Initial entity classes:

- `Artist`
- `Venue`
- `Event`
- `Festival`
- `Source`

Future classes may include:

- `Promoter`
- `Stage`
- `TicketOffer`
- `Organisation`
- `Area`

Entities are canonical.

Examples:

```text
Artist:a12
Venue:v44
Event:e921
Source:venue-web:v44
```

### 4.2 Observation

An immutable record that BNDY inspected a source at a point in time.

Example:

```json
{
  "observationId": "obs_01J...",
  "sourceId": "venue-web:v44",
  "observedAt": "2026-08-19T04:58:12Z",
  "sourceUrl": "https://examplevenue.co.uk/whats-on/",
  "captureHash": "sha256:...",
  "captureKey": "s3://.../2026-08-19T04-58-12Z/index.html",
  "enumerationMethod": "wordpress-rest-v1",
  "complete": true
}
```

An observation says:

> “This is what the source exposed when BNDY looked.”

It does not say that the source is correct.

### 4.3 Claim

A fact asserted or implied by one observation.

Examples:

```text
EventCandidate:c1 performerName "Legacy of Crows"
EventCandidate:c1 occursOn 2026-09-12
EventCandidate:c1 venueName "The Fishpond"
EventCandidate:c1 startsAt 21:00
EventCandidate:c1 admission FREE_CONFIRMED
```

A claim contains provenance.

```json
{
  "claimId": "clm_01J...",
  "observationId": "obs_01J...",
  "sourceId": "venue-web:v44",
  "subject": {
    "type": "event-candidate",
    "key": "source-native-id:11882"
  },
  "predicate": "startsAt",
  "value": "21:00",
  "confidence": 0.99,
  "evidence": {
    "url": "https://examplevenue.co.uk/events/legacy-of-crows/",
    "text": "Live from 9pm"
  }
}
```

### 4.4 Resolution

A mapping from one or more source candidates to a canonical BNDY entity.

Example:

```text
EventCandidate:c1 ─┐
EventCandidate:c2 ─┼── resolvesTo ──> Event:e921
EventCandidate:c3 ─┘
```

Resolution is where identity reasoning happens.

### 4.5 Projection

The normal BNDY production record.

For example:

```json
{
  "id": "e921",
  "artistId": "a12",
  "venueId": "v44",
  "date": "2026-09-12",
  "startTime": "21:00",
  "isPublic": true
}
```

This is the answer to:

> “What does BNDY currently believe?”

The claim graph answers:

> “Why does BNDY believe it?”

---

## 5. The central architecture

```text
                            ┌───────────────────────┐
                            │     Source Registry   │
                            │ venue / curated / etc │
                            └──────────┬────────────┘
                                       │
                                EventBridge
                                       │
                                       ▼
                            ┌───────────────────────┐
                            │ Source Scan Dispatcher│
                            └──────────┬────────────┘
                                       │
                                      SQS
                                       │
                                       ▼
                            ┌───────────────────────┐
                            │   Source Scan Worker  │
                            └──────────┬────────────┘
                                       │
                      ┌────────────────┼─────────────────┐
                      │                │                 │
                      ▼                ▼                 ▼
                HTTP/API fetch   browser fallback   file/image
                      │                │                 │
                      └────────────────┼─────────────────┘
                                       ▼
                            ┌───────────────────────┐
                            │   Raw Observation     │
                            │      S3 + state       │
                            └──────────┬────────────┘
                                       │
                                       ▼
                            ┌───────────────────────┐
                            │ Extract / Normalise   │
                            │ deterministic + AI    │
                            └──────────┬────────────┘
                                       │
                                       ▼
                            ┌───────────────────────┐
                            │     Claim Store       │
                            └──────────┬────────────┘
                                       │
                                       ▼
                            ┌───────────────────────┐
                            │ Reconciliation Engine │
                            └──────────┬────────────┘
                                       │
                  ┌────────────────────┼────────────────────┐
                  │                    │                    │
                  ▼                    ▼                    ▼
           Artist resolver       Venue resolver       Event resolver
                  │                    │                    │
                  └────────────────────┼────────────────────┘
                                       ▼
                            ┌───────────────────────┐
                            │ Existing BNDY APIs    │
                            └──────────┬────────────┘
                                       │
                                       ▼
                            ┌───────────────────────┐
                            │ Materialised BNDY     │
                            │ Artist/Venue/Event    │
                            └───────────────────────┘
```

---

## 6. Venue Gig Source

### 6.1 Venue domain extension

Do not treat every venue website as a gig source.

Add a dedicated source configuration.

Conceptual venue fields:

```json
{
  "websiteUrl": "https://thefishpondmatlockbath.co.uk/",
  "gigSource": {
    "enabled": true,
    "url": "https://thefishpondmatlockbath.co.uk/whats-on/",
    "mode": "delta",
    "authority": "venue-owned",
    "schedule": "daily"
  }
}
```

Recommended production model:

```ts
type VenueGigSource = {
  enabled: boolean;
  url: string;

  mode: 'delta' | 'append-only';

  authority: 'venue-owned';

  scanFrequency?: 'daily' | 'twice-daily' | 'weekly';

  parserHint?: string;
  sourceAdapter?: string;

  lastSuccessfulScanAt?: string;
  lastAttemptAt?: string;
  health?: 'healthy' | 'warning' | 'failed';
};
```

`parserHint` and `sourceAdapter` are internal/admin fields. They are not required for the first UI.

### 6.2 Admin UI

Venue edit page:

```text
Website
[ https://thefishpondmatlockbath.co.uk/ ]

Gig source
[x] Scan this venue for gigs

Gig source URL
[ https://thefishpondmatlockbath.co.uk/whats-on/ ]

Source mode
[ Delta ]

Last scan
19 Aug 2026, 05:03

Status
Healthy · 14 future gigs found
```

Later:

```text
[ Scan now ]
[ View source health ]
[ View last observation ]
[ View claims ]
```

### 6.3 API

Add a narrow venue source configuration endpoint.

Example:

```http
PUT /api/venues/{venueId}/gig-source
```

Payload:

```json
{
  "enabled": true,
  "url": "https://thefishpondmatlockbath.co.uk/whats-on/",
  "mode": "delta"
}
```

The normal venue endpoint can expose the resulting config.

Do not allow arbitrary scrape execution through this endpoint.

---

## 7. Source Registry

Venue websites should be represented as Source records internally.

A source is not the same thing as a venue.

```json
{
  "sourceId": "venue-web:b0f76afb-a52a-4baf-a224-9a62af1396b2",
  "sourceType": "VENUE_WEBSITE",
  "entityId": "b0f76afb-a52a-4baf-a224-9a62af1396b2",
  "url": "https://thefishpondmatlockbath.co.uk/whats-on/",
  "mode": "delta",
  "authorityClass": "venue-owned",
  "enabled": true
}
```

Other source classes:

```text
VENUE_WEBSITE
ARTIST_WEBSITE
ARTIST_FACEBOOK
CURATED_SOURCE
AGGREGATOR
CAPTURE_IMAGE
CAPTURE_URL
TICKETING_SOURCE
MANUAL
```

Existing examples can later become:

```text
CURATED_SOURCE:gigs-news
CURATED_SOURCE:onthecasemusic
CURATED_SOURCE:sceniceye
AGGREGATOR:lemonrock
VENUE_WEBSITE:sugarmill
CAPTURE_IMAGE:<capture-id>
```

---

## 8. Scheduling

### 8.1 EventBridge

Use one scheduler, not one EventBridge rule per venue.

Example:

```text
05:00 daily
     ↓
VenueSourceDispatcher
     ↓
query enabled VENUE_WEBSITE sources
     ↓
send one SQS message per source
```

Message:

```json
{
  "sourceId": "venue-web:v44",
  "reason": "scheduled",
  "requestedAt": "2026-08-19T04:00:00Z"
}
```

### 8.2 Queue

Create:

```text
VenueSourceScanQueue
VenueSourceScanDLQ
```

Recommended first values:

```text
batch size: 1
max receives: 3
visibility timeout: 10 minutes
DLQ retention: 14 days
```

One source failure must not stop another venue.

### 8.3 Manual scan

Admin/API can enqueue:

```json
{
  "sourceId": "venue-web:v44",
  "reason": "manual"
}
```

Do not invoke the worker synchronously from the web request.

---

## 9. Source acquisition strategy

The worker should use the cheapest reliable method.

### 9.1 Acquisition ladder

Order:

1. known adapter;
2. structured endpoint;
3. JSON-LD;
4. embedded page JSON;
5. DOM extraction;
6. AI-assisted extraction;
7. browser rendering only where unavoidable.

This avoids turning Lambda into a headless-browser farm.

### 9.2 Detect structured data

Inspect:

- `application/ld+json`;
- Schema.org `Event`;
- WordPress REST endpoints;
- Next.js `__NEXT_DATA__`;
- Nuxt state;
- GraphQL calls;
- JSON APIs;
- event widgets;
- ticket provider APIs;
- XHR/fetch calls;
- pagination endpoints.

A page that appears to require “Load more” may already expose a simple JSON endpoint.

The source worker should prefer that endpoint once discovered.

### 9.3 Source adapter

When a source has stable quirks, record a reusable adapter.

```ts
interface SourceAdapter {
  detect(document: SourceDocument): Promise<number>;
  enumerate(context: SourceContext): Promise<RawSourceItem[]>;
  normalise(item: RawSourceItem): Promise<SourceClaimBundle>;
}
```

Examples:

```text
generic-jsonld
wordpress-events
dice-widget
eventbrite-widget
lemonrock
gigs-news
fishpond-v1
```

A custom adapter is not failure of the architecture. It is how stable source-specific quirks are isolated.

---

## 10. Raw evidence

Every successful source run stores enough evidence to reproduce or investigate it.

### 10.1 S3 structure

```text
s3://bndy-enrichment-evidence/
  source-observations/
    venue-web/
      <venueId>/
        2026/
          08/
            19/
              <observationId>/
                manifest.json
                response.html
                source.json
                screenshot.png
                extracted.json
```

Not every run needs every file.

### 10.2 Observation manifest

```json
{
  "observationId": "obs_...",
  "sourceId": "venue-web:v44",
  "sourceUrl": "...",
  "observedAt": "...",
  "httpStatus": 200,
  "captureHash": "...",
  "enumerationMethod": "wordpress-rest-v1",
  "complete": true,
  "itemsSeen": 18,
  "futureItemsSeen": 14
}
```

The raw capture is immutable.

---

## 11. Claim contract

Collectors should not output BNDY API payloads directly.

They should output graph-ready claims.

### 11.1 Claim envelope

```ts
interface Claim<T = unknown> {
  claimId: string;

  observationId: string;
  sourceId: string;

  subject: ClaimSubject;
  predicate: ClaimPredicate;
  value: T;

  confidence: number;

  evidence?: {
    sourceUrl?: string;
    rawItemId?: string;
    text?: string;
    selector?: string;
  };

  assertedAt?: string;
  observedAt: string;
}
```

### 11.2 Initial predicates

#### Artist

```text
hasName
hasNameVariant
hasFacebookUrl
hasWebsiteUrl
hasInstagramUrl
hasLocation
hasArtistType
hasActType
hasGenre
hasBio
```

#### Venue

```text
hasName
hasAddress
hasGooglePlaceId
hasWebsiteUrl
locatedIn
```

#### Event

```text
hasPerformer
hasPerformerName
occursAt
hasVenueName
occursOn
startsAt
endsAt
hasTitle
hasAdmissionStatus
hasPrice
hasTicketUrl
hasEventUrl
hasStatus
```

#### Relationships

```text
performsAt
resolvesTo
reportedBy
derivedFrom
contradicts
supersedes
```

---

## 12. Event candidate bundle

For convenience, an extractor can emit a bundle.

```ts
interface EventClaimBundle {
  sourceEventKey: string;

  claims: Claim[];

  sourceEventUrl?: string;
  sourceNativeId?: string;

  extractionConfidence: number;
}
```

The bundle is not a canonical event.

It is one source's description of a possible event.

---

## 13. Stable source identity

Prefer a native source-owned identifier.

Order:

1. source numeric ID;
2. stable event slug;
3. canonical event URL;
4. deterministic derived key only as a last resort.

Example:

```text
sourceId: venue-web:v44
sourceEventKey: wordpress:event:11882
```

Do not confuse source identity with BNDY event identity.

BNDY event identity continues to be protected by the existing canonical event resolver and artist/venue/date sentinel.

---

## 14. Reconciliation engine

### 14.1 Candidate clustering

The engine attempts to cluster source event candidates that describe the same event.

Strong event signals:

```text
resolved artist
resolved venue
date
```

Secondary signals:

```text
start time
event title
ticket URL
source event URL
festival parent
```

Initial deterministic rule:

```text
same resolved artist
+ same resolved venue
+ same date
= same BNDY performance
```

This mirrors the existing BNDY event uniqueness model.

### 14.2 Artist resolution

Evidence can include:

- exact canonical Facebook URL;
- name;
- name variants;
- source-owned name;
- location;
- venue footprint;
- previous events;
- official website;
- social links.

Do not replace the existing Artist Lambda.

The reconciliation layer should produce the best supported candidate payload and then use the existing `find-or-create` contract.

### 14.3 Venue resolution

Evidence can include:

- source venue;
- venue name;
- town;
- address;
- postcode;
- Google Place ID;
- source's relationship to a known canonical venue.

For a `VENUE_WEBSITE` source tied to `venueId`, the venue is already resolved.

This is valuable:

```text
Source = venue-web:v44
therefore every local gig item occursAt Venue:v44
```

unless the source explicitly describes an off-site event.

That removes a large class of venue geocoding ambiguity.

---

## 15. Source authority

Authority must be predicate-specific.

Do not implement one global source score.

### 15.1 Suggested initial precedence

| Predicate | Highest authority |
|---|---|
| artist canonical name | artist-owned source |
| artist bio | artist-owned source only |
| artist Facebook URL | artist-owned/direct captured profile |
| venue address | Google Place / venue-owned |
| venue website | venue-owned / verified domain |
| gig existence | venue-owned or artist-owned |
| gig date | venue-owned or artist-owned |
| stage time | artist-owned / venue-owned |
| cancellation | artist-owned / venue-owned |
| ticket price | venue / official ticket provider |
| ticket URL | official ticket provider / venue |
| genre | artist source, then accumulated corroboration |

A curated source can be excellent discovery evidence without outranking the venue on cancellation.

---

## 16. Conflict handling

Suppose:

```text
Venue website:     21:00
Artist Facebook:   21:00
GigsNews:          20:30
```

The claim graph retains all three claims.

Projection:

```text
startTime = 21:00
```

Reason:

```text
two higher-authority owned sources agree
```

Do not delete the GigsNews claim.

It remains evidence that can be audited.

---

## 17. Claim confidence versus source authority

These are different.

**Extraction confidence** asks:

> Did the collector correctly understand the source?

**Source authority** asks:

> If correctly understood, how much should BNDY trust this source for this predicate?

Example:

```text
Gemini confidently extracts "8:30pm" from GigsNews.
Extraction confidence = 0.99.

The venue website says 9pm.
Venue source has higher stage-time authority.
Projection = 9pm.
```

---

## 18. Source modes

Retain the current runbook distinction.

### 18.1 `append-only`

The source can add and modify claims.

The source cannot cause an event to disappear merely because an item is no longer present.

Suitable where enumeration is incomplete or unstable.

### 18.2 `delta`

The source supports:

- additions;
- changes;
- explicit cancellations;
- removed-row handling.

Use only when:

- the source capture is complete;
- the enumeration method is stable;
- the previous observation used the same method;
- the new capture can be reproduced reliably.

This should be enforced in code.

---

## 19. Observation completeness

Every observation must say whether enumeration was complete.

```json
{
  "complete": true,
  "enumerationMethod": "api-v2",
  "paginationComplete": true,
  "captureStable": true
}
```

If completeness is false:

```text
do not infer disappearance
```

This converts an important runbook rule into machine state.

---

## 20. Snapshot reconciliation

The local `*-last-page.txt` model becomes durable cloud state.

### 20.1 DynamoDB source state

Use the existing `bndy-enrichment` state table initially.

Suggested keys:

```text
PK SOURCE#<sourceId>
SK CONFIG
SK STATE
SK OBS#<timestamp>
SK EVENT#<sourceEventKey>
```

Example state:

```json
{
  "pk": "SOURCE#venue-web:v44",
  "sk": "STATE",
  "lastSuccessfulObservationId": "obs_...",
  "lastSuccessfulScanAt": "...",
  "lastCaptureHash": "...",
  "lastEnumerationMethod": "wordpress-rest-v1",
  "lastComplete": true,
  "consecutiveFailures": 0
}
```

### 20.2 S3 remains the immutable payload store

DynamoDB stores state and indexes.

S3 stores raw evidence.

---

## 21. Cancellation model

Cancellation needs first-class evidence.

### 21.1 Explicit cancellation

Example source claim:

```text
EventCandidate:c1 hasStatus CANCELLED
```

This is stronger than simple absence.

The projection should normally:

```text
set event hidden/cancelled
```

rather than silently delete it.

### 21.2 Source disappearance

A delta source may assert:

```text
previously present source candidate no longer appears
```

Model this as a withdrawal:

```text
ClaimWithdrawal
```

not immediately as universal truth that the gig has ceased to exist.

### 21.3 Tombstone

When BNDY decides a canonical event must not be recreated, create a durable tombstone.

```json
{
  "tombstoneId": "tmb_...",
  "eventId": "e921",
  "artistId": "a12",
  "venueId": "v44",
  "date": "2026-09-12",
  "reason": "cancelled",
  "sourceId": "artist-facebook:a12",
  "evidenceObservationId": "obs_...",
  "createdAt": "..."
}
```

Before a projection creates a canonical event:

```text
check tombstone
```

This replaces cross-task coordination through local JSONL files.

---

## 22. Projection policy

The graph/reconciliation layer does not directly modify DynamoDB Artist/Venue/Event records.

It calls canonical BNDY APIs.

### 22.1 Artist projection

```text
claims
  ↓
resolved artist candidate
  ↓
POST /api/artists/find-or-create
```

Then top up missing fields only through the supported update endpoint.

### 22.2 Venue projection

```text
claims
  ↓
resolved venue candidate
  ↓
POST /api/venues/find-or-create
```

For a venue-owned source linked to an existing venue:

```text
reuse the linked venueId
```

### 22.3 Event projection

```text
resolved artist
+ resolved venue
+ date
+ reconciled fields
  ↓
POST /api/events/community
```

Duplicates remain idempotent.

---

## 23. Source ownership of projections

A canonical Event should know which source claims support it.

Do not rely only on one `externalId`.

Add graph/provenance linkage such as:

```text
Event:e921
  supportedBy → ClaimGroup:g88
```

The BNDY production Event can continue to carry source external IDs for compatibility.

The claim store becomes the full provenance record.

---

## 24. Multi-source support

Example:

```text
Event e921

support:
  venue-web:v44       observed today
  artist-facebook:a12 observed yesterday
  gigs-news           observed today

conflict:
  gigs-news startTime 20:30
  venue-web startTime 21:00
  artist Facebook 21:00
```

Projection:

```text
21:00
```

The UI need not show all provenance initially.

Admin tooling should.

---

## 25. Poster ingestion

Poster/image capture becomes a Source Observation.

```text
Source type: CAPTURE_IMAGE
```

The image itself is raw evidence.

Gemini extracts claims.

Example:

```text
poster claims:
Artist name = TheTR5s
Gig 1 date = ...
Gig 1 venue name = ...
Gig 2 date = ...
...
```

Gemini is not asked:

> “What should BNDY write?”

It is asked:

> “What claims are supported by this evidence?”

The normal reconciliation engine decides what becomes canonical.

---

## 26. Facebook captures

A shared Facebook artist URL is also an observation.

```text
Source type: CAPTURE_URL
```

The supplied URL remains authoritative provenance for the capture.

Search can resolve the canonical URL and enrich surrounding facts.

The resulting artist and gig facts are claims.

---

## 27. Existing curated sources

Existing Cowork sources become adapters over time.

Example:

```text
gigs-news
   ↓
GigsNewsAdapter
   ↓
Observation
   ↓
Claims
```

The source's existing rules remain source-specific extraction rules.

Global behaviour moves into shared code:

- identity;
- claim model;
- authority;
- projection;
- verification;
- tombstones;
- source modes;
- observability.

This is the main simplification.

---

## 28. Knowledge graph implementation strategy

Do not make a graph database mandatory in phase one.

### 28.1 Phase one: graph-shaped data in DynamoDB

Use the existing state table or a dedicated `bndy-knowledge` DynamoDB table.

Store:

```text
entities
candidate entities
observations
claims
resolutions
tombstones
source configs
```

Example:

```text
PK ENTITY#EVENT#e921
SK CLAIM#startsAt#clm123

PK SOURCE#venue-web:v44
SK OBS#2026-08-19T05:02:00Z

PK CANDIDATE#venue-web:v44#11882
SK CLAIM#occursOn#clm456
```

Advantages:

- no new database technology immediately;
- low operational cost;
- easy CDK integration;
- current team familiarity;
- enough for the initial reconciliation model.

### 28.2 Phase two: graph projection

When graph queries become valuable, project the claim layer into a graph store.

Potential AWS option:

```text
Amazon Neptune
```

The collectors should not care.

A graph projector can consume claim events and maintain:

```text
Artist ─PERFORMS_AT→ Event
Event ─OCCURS_AT→ Venue
Claim ─ASSERTS→ Fact
Claim ─REPORTED_BY→ Source
Candidate ─RESOLVES_TO→ Entity
```

### 28.3 Keep DynamoDB projections

Even after Neptune:

```text
Neptune = reasoning / relationship exploration
DynamoDB domain tables = application read model
S3 = evidence
```

The gig map should not depend on a graph traversal for normal rendering.

---

## 29. Suggested graph shape

```text
(Source)
   │
   └── PRODUCED ──> (Observation)
                         │
                         └── ASSERTS ──> (Claim)
                                          │
                    ┌─────────────────────┼───────────────────┐
                    ▼                     ▼                   ▼
                (Artist)               (Event)              (Venue)
                    │                     │                   ▲
                    │                     ├── OCCURS_AT ──────┘
                    │                     │
                    └── PERFORMS_AT ──────┘
```

Candidate nodes may exist before resolution.

```text
(ArtistCandidate)
      │
      └── RESOLVES_TO ──> (Artist)
```

---

## 30. Inference

Initial inference should remain deterministic.

Examples:

### 30.1 Event identity

```text
same artist + same venue + same date
→ same performance
```

### 30.2 Artist identity

```text
exact canonical Facebook identity
→ same artist
```

or:

```text
same normalised name
+ compatible location
+ overlapping gig footprint
→ probable same artist
```

The canonical Artist resolver remains the final gate.

### 30.3 Venue identity

```text
same Google Place ID
→ same venue
```

### 30.4 Cancellation

```text
artist-owned CANCELLED
+ venue source withdrawal
+ aggregator still lists
→ canonical event cancelled
→ aggregator claim retained as stale/conflicting evidence
```

---

## 31. Learned source reliability

Later, measure source performance by predicate.

Example:

```json
{
  "sourceId": "gigs-news",
  "reliability": {
    "eventDiscovery": 0.94,
    "date": 0.96,
    "startTime": 0.81,
    "cancellation": 0.61
  }
}
```

Do not introduce machine-learned reliability on day one.

Start with explicit authority classes.

Collect enough history first.

---

## 32. Bounded graph expansion

A knowledge graph does not mean unrestricted crawling.

Use budgets.

Example:

```text
root venue source scan
  depth 0

new artists discovered
  profile enrichment
  depth 1

artist upcoming-gig discovery
  optional
  depth 2

new venues from those gigs
  profile enrichment only
  no immediate recursive venue listing crawl
```

Budgets:

```text
max depth
max new entities
max source fetches
max model calls
max execution time
max estimated cost
```

Fully enrich nodes.

Selectively expand edges.

---

## 33. Frontend/admin full stack

### 33.1 Venue editor

Add:

```text
Gig Source
```

Fields:

- enabled;
- URL;
- mode;
- health;
- last scan.

### 33.2 Source health page

Admin route:

```text
/admin/gig-sources
```

Columns:

```text
Source
Venue
Type
Mode
Last successful scan
Items found
Changes
Health
Next scan
```

Filters:

```text
failed
warning
never scanned
delta
append-only
```

### 33.3 Source detail

Show:

- source config;
- recent observations;
- extracted candidates;
- canonical mappings;
- claims;
- conflicts;
- writes;
- errors;
- raw evidence links;
- scan now.

### 33.4 Event provenance

Later, admin Event screen:

```text
Why BNDY believes this event

✓ Venue website · today
✓ Artist Facebook · yesterday
✓ GigsNews · today

Start time
21:00
Venue site: 21:00
Artist: 21:00
GigsNews: 20:30
```

This becomes a powerful operational tool.

---

## 34. APIs for enrichment administration

Recommended internal endpoints:

```http
GET  /api/admin/gig-sources
GET  /api/admin/gig-sources/{sourceId}
POST /api/admin/gig-sources/{sourceId}/scan

GET  /api/admin/observations/{observationId}
GET  /api/admin/entities/{entityId}/claims
GET  /api/admin/events/{eventId}/provenance
```

These should be admin/service authenticated.

Do not expose evidence S3 publicly.

Use signed URLs if raw evidence must be inspected.

---

## 35. AWS resources

Extend `BndyEnrichmentStack`.

Recommended additions:

```text
SourceScanQueue
SourceScanDLQ

SourceDispatcher Lambda
SourceWorker Lambda
ClaimProjector Lambda
ReconciliationWorker Lambda

SourceSchedule EventBridge Rule

KnowledgeTable / existing StateTable extensions
EvidenceBucket extensions

optional:
ReconciliationQueue
ProjectionQueue
```

A useful first split:

```text
Dispatcher
  ↓
SourceScanQueue
  ↓
SourceWorker
  ↓
Claim/ReconciliationQueue
  ↓
ReconciliationWorker
  ↓
BNDY APIs
```

This prevents slow source acquisition from consuming projection capacity.

---

## 36. Event-driven internal contract

After a source observation:

```json
{
  "type": "SourceObservationCompleted",
  "observationId": "obs_...",
  "sourceId": "venue-web:v44",
  "claimCount": 87
}
```

After reconciliation:

```json
{
  "type": "EntityProjectionRequired",
  "entityType": "event",
  "entityKey": "...",
  "reason": "claims-changed"
}
```

SQS is sufficient initially.

EventBridge Pipes/EventBridge Bus can be introduced later if event fan-out becomes useful.

---

## 37. Idempotency

Every stage needs a stable key.

### Scan

```text
sourceId + scheduled window
```

### Observation

```text
sourceId + captureHash
```

A byte-identical capture can still record a scan occurrence, but need not regenerate every claim.

### Claim

```text
observationId + source item + predicate + value
```

### Projection

Use existing BNDY canonical uniqueness.

---

## 38. Verification

Retain the runbook's strongest principle:

> a write is not trusted until read back.

Projection workflow:

```text
write through canonical API
  ↓
read canonical entity/event
  ↓
verify expected identity/fields
  ↓
mark projection successful
```

A write response alone does not close the operation.

---

## 39. Owner-managed records

Owner-managed BNDY records remain protected.

The graph may still contain third-party claims about them.

But claims must not silently overwrite owner truth.

Conceptually:

```text
owner claim authority > automated source claim
```

For example:

```text
Venue owner says startTime 21:00
GigsNews says 20:30
```

Projection remains 21:00.

The GigsNews claim is retained.

---

## 40. Bios and authored text

Bios require special handling.

Do not infer or compose artist bios from graph facts.

Store:

```text
claim hasBio "<verbatim source text>"
```

Only artist-owned evidence can project to public bio.

This preserves the existing BNDY principle that artist bio is quoted evidence, not generated copy.

---

## 41. Observability

CloudWatch metrics:

```text
SourcesEnabled
SourcesScanned
SourceScanSuccess
SourceScanFailure
SourceScanDuration

ObservationsCreated
ClaimsExtracted
ClaimsRejected

CandidatesResolved
CandidatesAmbiguous

ArtistsCreated
ArtistsMatched
VenuesCreated
VenuesMatched
EventsCreated
EventsUpdated
EventsCancelled
EventsTombstoned

ProjectionFailures
DLQMessages
```

Dimensions:

```text
sourceType
sourceId
adapter
mode
```

---

## 42. Health model

Each source gets a computed health status.

### Healthy

- last scan successful;
- enumeration complete;
- no repeated parser errors.

### Warning

- source content changed significantly;
- enumeration incomplete;
- zero events where historically non-zero;
- extraction confidence collapsed.

### Failed

- repeated fetch failure;
- parser failure;
- authentication challenge;
- DLQ message;
- source URL invalid.

Do not treat “zero gigs” as automatically failed.

---

## 43. Drift detection

Websites change.

Detect:

- capture structure changed;
- adapter no longer matches;
- event count drops sharply;
- expected JSON endpoint disappears;
- pagination changes;
- source returns challenge/login page.

Store structural fingerprints.

Example:

```text
adapter fishpond-v1
historical future items 8-25
today 0
HTML changed 74%
```

Mark warning and retain previous projection.

Do not interpret a parser failure as mass cancellation.

---

## 44. Cost control

Use deterministic acquisition first.

AI is used for:

- unstructured text;
- poster images;
- difficult event-card interpretation;
- entity hints;
- classification.

Avoid model calls where structured data already supplies:

- date;
- title;
- URL;
- venue;
- price.

Cache source-level discoveries such as:

```text
this WordPress site exposes /wp-json/...
```

---

## 45. Security

- private S3 buckets;
- SSL enforced;
- Secrets Manager for Gemini and BNDY service tokens;
- least-privilege Lambda roles;
- no AWS credentials in repo;
- no public raw evidence URLs;
- sanitise fetched content before logs;
- cap response sizes;
- block internal/private IP targets to avoid SSRF;
- only `http`/`https` source URLs;
- DNS/IP validation on fetch;
- timeout all external calls.

The source scanner is an internet-facing fetch engine and needs SSRF protections from day one.

---

## 46. Data retention

Suggested:

### Raw HTML/API captures

90-180 days initially.

### Normalised observations and claims

Long-lived.

### Run summaries

Long-lived.

### Screenshots

Shorter retention unless supporting a disputed/cancellation claim.

### Tombstones

Long-lived.

A tombstone is operational knowledge, not disposable scan evidence.

---

## 47. Run reports

Replace local run reports with structured AWS run records.

Example:

```json
{
  "runId": "run_...",
  "sourceId": "gigs-news",
  "startedAt": "...",
  "completedAt": "...",
  "status": "SUCCESS",
  "itemsSeen": 147,
  "claims": 833,
  "artistsCreated": 3,
  "artistsMatched": 41,
  "venuesCreated": 1,
  "eventsCreated": 12,
  "eventsUpdated": 3,
  "eventsCancelled": 1,
  "projectionFailures": 0
}
```

A human-readable report can be generated from it.

---

## 48. Source-specific configuration

Do not copy the whole master runbook into code per source.

Global rules live in shared reconciliation code.

Source spec contains:

```yaml
sourceId: gigs-news
type: CURATED_SOURCE
mode: delta
url: ...
adapter: gigs-news-v1
horizonDays: ...
ignoreRules: ...
knownQuirks: ...
```

Venue sources normally require far less:

```yaml
sourceId: venue-web:v44
type: VENUE_WEBSITE
mode: delta
url: ...
adapter: generic
```

---

## 49. Migration of existing Cowork jobs

Do this incrementally.

### Stage 1

Prove generic venue website scanning.

Suggested first venue:

```text
The Fishpond
```

### Stage 2

Add 5-10 different venue websites.

Choose deliberately different stacks:

- WordPress;
- static HTML;
- JavaScript rendered;
- embedded ticket widget;
- JSON-LD;
- pagination/load more.

### Stage 3

Move one stable curated Cowork source.

Suggested candidate:

```text
GigsNews
```

It already has mature delta behaviour.

### Stage 4

Move remaining curated sources.

### Stage 5

Retire duplicate Cowork tasks only after AWS parity is measured.

---

## 50. Migration without a graph database

The important migration sequence is:

```text
NOW
source → direct discovery → BNDY API

NEXT
source → observation → claims → current resolver → BNDY API

LATER
source → observation → claims → graph → inference → BNDY API
```

The collector contract changes once:

```text
produce claims
```

It does not change again when Neptune arrives.

---

## 51. Recommended repository structure

Inside `bndy-enrichment`:

```text
src/
  source/
    schema.ts
    registry.ts
    state.ts
    observation.ts
    claims.ts

    fetch/
      http.ts
      structured.ts
      browser.ts

    adapters/
      interface.ts
      generic-jsonld.ts
      wordpress.ts
      gigs-news.ts
      fishpond.ts

    extract/
      deterministic.ts
      gemini.ts

  graph/
    claim-store.ts
    resolution.ts
    authority.ts
    conflicts.ts
    tombstones.ts

  projection/
    artist.ts
    venue.ts
    event.ts
    verify.ts

  handlers/
    source-dispatcher.ts
    source-worker.ts
    reconciliation-worker.ts
```

Keep `capture/` as an input adapter into the same claim model.

Eventually:

```text
capture → observation/claim
```

rather than maintaining a parallel capture-specific reconciliation engine.

---

## 52. Proposed TypeScript contracts

### Source

```ts
export interface GigSource {
  id: string;

  type:
    | 'VENUE_WEBSITE'
    | 'ARTIST_WEBSITE'
    | 'CURATED_SOURCE'
    | 'AGGREGATOR'
    | 'CAPTURE_IMAGE'
    | 'CAPTURE_URL';

  url?: string;

  linkedEntityId?: string;

  mode: 'delta' | 'append-only';

  authorityClass:
    | 'owner'
    | 'artist-owned'
    | 'venue-owned'
    | 'official-ticket'
    | 'curated'
    | 'aggregator'
    | 'capture';

  enabled: boolean;

  adapter?: string;
}
```

### Observation

```ts
export interface SourceObservation {
  id: string;
  sourceId: string;

  observedAt: string;

  url?: string;
  captureHash?: string;
  evidenceKey?: string;

  enumerationMethod: string;
  complete: boolean;

  itemCount: number;
}
```

### Claim

```ts
export interface KnowledgeClaim<T = unknown> {
  id: string;

  observationId: string;
  sourceId: string;

  subjectType:
    | 'artist-candidate'
    | 'venue-candidate'
    | 'event-candidate'
    | 'artist'
    | 'venue'
    | 'event';

  subjectKey: string;

  predicate: string;
  value: T;

  confidence: number;

  evidenceUrl?: string;
  evidenceText?: string;

  observedAt: string;
}
```

### Resolution

```ts
export interface EntityResolution {
  candidateType: 'artist' | 'venue' | 'event';
  candidateKey: string;

  canonicalEntityId: string;

  method: string;
  confidence: number;

  supportingClaimIds: string[];

  resolvedAt: string;
}
```

---

## 53. Initial DynamoDB access patterns

Need to support:

```text
get source config
list enabled sources
get latest observation
list observations for source
get claims for observation
get claims for candidate
get claims supporting canonical entity
get candidate resolution
get tombstone by artist+venue+date
```

Use GSIs where necessary.

Potential keys:

```text
PK SOURCE#<id>       SK CONFIG
PK SOURCE#<id>       SK OBS#<timestamp>

PK OBS#<id>          SK CLAIM#<id>

PK CAND#<type>#<key> SK CLAIM#<id>
PK CAND#<type>#<key> SK RESOLUTION

PK ENTITY#<type>#<id> SK SUPPORT#<claimId>

PK TOMBSTONE#<artist>#<venue>#<date> SK META
```

---

## 54. Knowledge graph transition trigger

Do not migrate to Neptune merely because “graphs are good”.

Introduce a graph store when BNDY needs queries such as:

```text
show all paths supporting this artist identity

find unresolved artist candidates connected to the same venues

find events where two high-authority sources disagree

find candidate artists with overlapping performance footprints

show every source that has ever asserted this venue name

infer likely aliases from recurring shared event footprints
```

Those are real graph workloads.

Until then, graph-shaped DynamoDB data is sufficient.

---

## 55. Full-stack delivery phases

### Phase A: foundations

Build:

- `GigSource` model;
- venue `gigSource` config;
- admin edit UI;
- source registry;
- source scheduler;
- source SQS/DLQ;
- observation store;
- raw S3 evidence;
- claim schema.

No automatic writes required for the first deployment.

**Acceptance:** A marked venue is scanned nightly and produces an immutable observation plus claims.

### Phase B: venue reconciliation

Build:

- generic source acquisition;
- JSON-LD extraction;
- DOM extraction;
- Gemini fallback;
- event candidate grouping;
- existing artist resolver integration;
- linked venue resolution;
- event creation;
- read-back verification.

**Acceptance:** A venue source can create a clean new gig through existing BNDY APIs.

### Phase C: delta alignment

Build:

- source snapshots;
- complete-capture checks;
- updates;
- explicit cancellation;
- disappeared-row handling;
- tombstones;
- cross-source conflict protection.

**Acceptance:** BNDY remains aligned with a venue source across additions, changes and cancellations without false mass deletion.

### Phase D: multi-source claims

Build:

- source authority;
- event clustering;
- claim conflict model;
- projection explanations;
- admin provenance UI.

**Acceptance:** Two or more sources can support or contradict one canonical event without losing evidence.

### Phase E: Cowork migration

Move:

- GigsNews;
- OnTheCase;
- SceneEye;
- Sugarmill;
- Lemonrock where suitable;
- other scheduled sources.

**Acceptance:** AWS produces equal or better results than Cowork for multiple consecutive runs.

### Phase F: graph projection

Build:

- graph projector;
- Neptune if justified;
- graph-specific queries;
- entity inference jobs;
- confidence/reliability analysis.

**Acceptance:** Graph can explain entity and event projections while the existing application remains on fast materialised BNDY tables.

---

## 56. Decisions

### D1. Sources emit claims, not CRUD commands

**Decision:** Accepted.

Collectors describe evidence.

They do not decide canonical truth.

### D2. Existing BNDY APIs remain write authority

**Decision:** Accepted.

No direct enrichment writes into canonical Artist/Venue/Event tables.

### D3. Venue website is a first-class Gig Source

**Decision:** Accepted.

A venue website and its gig listing URL are separate concepts.

### D4. Graph-ready model starts before graph database

**Decision:** Accepted.

Write observations and claims now.

Do not block delivery on Neptune.

### D5. BNDY tables remain materialised application projections

**Decision:** Accepted.

Normal user-facing reads stay fast.

### D6. Raw evidence is retained

**Decision:** Accepted.

S3 stores source captures.

### D7. Authority is predicate-specific

**Decision:** Accepted.

There is no single universal source rank.

### D8. Cancellation creates durable graph knowledge

**Decision:** Accepted.

Use tombstones/withdrawals, not transient task-local knowledge.

### D9. Source expansion is bounded

**Decision:** Accepted.

A knowledge graph does not authorise infinite crawling.

---

## 57. Immediate build recommendation

The first implementation slice should be:

```text
1. Venue gigSource fields.
2. Venue admin UI.
3. GigSource registry.
4. EventBridge daily dispatcher.
5. Source SQS + DLQ.
6. Venue source worker.
7. S3 raw observation.
8. DynamoDB observation + claims.
9. Generic JSON-LD/DOM extractor.
10. Gemini fallback.
11. Claim → existing BNDY resolver adapter.
12. Read-back verification.
13. The Fishpond live pilot.
```

Do **not** implement Neptune yet.

Do **not** migrate GigsNews yet.

First prove that a venue website can:

```text
scan
→ preserve evidence
→ produce claims
→ reconcile
→ write through canonical APIs
→ verify
```

Once that works, GigsNews becomes another source adapter rather than another architecture.

---

## 58. End state

The intended BNDY model becomes:

```text
                 THE WORLD
                    │
        ┌───────────┼───────────┐
        │           │           │
     artists      venues     curators
        │           │           │
        └──── web / social / data ────┐
                                      │
                                      ▼
                               BNDY SOURCES
                                      │
                                      ▼
                                OBSERVATIONS
                                      │
                                      ▼
                                   CLAIMS
                                      │
                                      ▼
                               KNOWLEDGE GRAPH
                                      │
                       ┌──────────────┼──────────────┐
                       │              │              │
                       ▼              ▼              ▼
                    Artist          Venue           Event
                   inference       inference       inference
                       │              │              │
                       └──────────────┼──────────────┘
                                      ▼
                                BNDY PROJECTION
                                      │
                                      ▼
                               bndy.co.uk / PWA
```

The key distinction is simple:

> **The graph stores evidence, claims, disagreement and reasoning.**

> **The BNDY application stores the current operational answer.**

This gives BNDY a scalable path from today's source imports to a defensible, explainable live-music knowledge system.

---

## Appendix A: Runbook principles carried forward

The cloud implementation should preserve these important behaviours from the existing BNDY master import runbook:

- the backend resolvers and gates remain canonical;
- every write is read back and verified;
- automated records retain source provenance;
- future source disappearance is different from explicit cancellation;
- `delta` and `append-only` are explicit source modes;
- disappearance is actionable only from a complete reproducible capture;
- owner-managed records outrank automated imports;
- artist bios are evidence, not generated prose;
- venue Google Place identity remains authoritative;
- Facebook identity is a strong artist identity signal;
- event identity remains based around artist, venue and date;
- stable native source IDs are preferred;
- source state has one canonical home;
- cross-source cancellations must be durable so a stale source cannot recreate a cancelled gig.

The cloud architecture converts these from agent instructions into data structures and code wherever possible.

---

## Appendix B: Existing implementation anchors

Current implementation to reuse:

```text
flowency-live/bndy-enrichment

- CDK stack
- DynamoDB state
- S3 evidence bucket
- SQS + DLQ
- EventBridge
- Gemini secret
- BNDY service secret
- bndy-capture scanner/processor
- existing BNDY API client
```

Current canonical resolver APIs to retain:

```text
POST /api/artists/find-or-create
PUT  /api/artists/{id}/mcp
POST /api/venues/find-or-create
POST /api/events/community
```

The new source subsystem should be implemented inside this architecture rather than creating a second ingestion platform.

---

# 59. bndy-signals Consolidation Assessment

## 59.1 Decision

`flowency-live/bndy-enrichment` is the **single strategic runtime and single source of truth for the target architecture**.

`flowency-live/bndy-signals` becomes a **donor/migration repository**.

Its useful domain concepts, source-runner code, tests, adapters, evidence model and selected AWS patterns should be ported into `bndy-enrichment`. Once parity is proven, `bndy-signals` should be archived.

This supersedes the earlier `bndy-signals` ADR that named `bndy-signals` itself as the canonical intelligence runtime.

### Target repository authority

```text
flowency-live/bndy-enrichment
    │
    ├── application code
    ├── AWS infrastructure
    ├── Capture ingestion
    ├── source adapters
    ├── source registry
    ├── observation / evidence runtime
    ├── extraction
    ├── interpretation
    ├── claims
    ├── reconciliation
    ├── model providers
    ├── projection
    │
    └── docs/
         TARGET-ARCHITECTURE.md
```

The architecture document in `bndy-enrichment` should state explicitly:

> This document is the single authoritative target architecture for BNDY enrichment, source ingestion, observations, claims, reconciliation and the future knowledge graph. Any conflicting target-state document in `bndy-signals`, Cowork, Obsidian or another repository is superseded by this file.

`bndy-signals` should not remain a second evolving target architecture.

## 59.2 What bndy-signals contains

`bndy-signals` contains two valuable but distinct systems.

### Cognitive runtime

```text
Signal
 ↓
Deterministic Extraction
 ↓
Interpretation
 ↓
Claims
 ↓
Evidence Packs
 ↓
Clarification / Review
 ↓
Canonical state
```

### Scheduled source runner

```text
fetch
 ↓
snapshot
 ↓
parse
 ↓
normalise
 ↓
diff
 ↓
resolve
 ↓
write
 ↓
state/report
```

The source runner already contains working adapters for GigsNews, KLMA Stoke, On The Case and Scenic Eye.

The correct consolidation strategy is to preserve both sets of useful capabilities while removing duplicated infrastructure and target-state ownership.

# 60. Domain Concepts to Port

Port and standardise around:

```text
Source
Observation
Evidence
Extraction
Interpretation
Claim
Resolution
Projection
```

A `Signal` maps most closely to an immutable Observation. The distinction must remain:

```text
Observation
"What exactly did BNDY observe?"

Interpretation
"What did model/prompt/version X conclude from it?"
```

Port fully:
- immutable evidence
- Extraction
- Interpretation/versioning
- Claims, generalised into subject/predicate/value form
- Evidence Packs, improved with authority/freshness/independence rather than source count alone
- EventCandidate and EntityCandidate concepts, simplified

Claims may be partial. Only the final BNDY projection must satisfy canonical API creation rules.

# 61. Source Runner Capabilities to Port

Port the generic runner orchestration almost wholesale:

```text
load_config
start_run
fetch_source
store_snapshot
parse_source
store_normalised
load_previous
diff_events
store_diff
resolve_entities
apply_writes
persist_state
generate_report
complete_run
```

Change the write model.

Current:

```text
normalised source event
→ resolve
→ write BNDY
```

Target:

```text
normalised source item
→ Observation + Claims
→ Reconciliation
→ canonical BNDY APIs
```

Retain dependency injection, acquisition, parsing, normalisation, diffing and reporting.

## Existing source adapters

Port, do not rewrite:

```text
GigsNews
KLMA Stoke
On The Case
Scenic Eye
```

Suggested target:

```text
bndy-enrichment/src/sources/adapters/
  gigs-news/
  klma-stoke/
  onthecase/
  sceniceye/
```

Keep source-specific fetch/DOM/browser/parsing/normalisation rules and tests. Move global identity, claims, projection, tombstones, authority and reconciliation into shared runtime code.

### GigsNews

Port immediately. Existing code already has adapter/config/fetch/normalise/parse/tests and captures its JS-rendered behaviour, region, daily schedule and complete snapshot semantics.

Do not rebuild this scraper.

## SourceConfig

Port and merge with GigSource.

Retain:
- source ID/name/type
- region/timezone
- schedule
- input
- thresholds
- snapshot semantics
- source-specific policy

Merge with:
- authority class
- linked entity
- enabled
- URL
- adapter
- mode
- health/freshness

Keep both:

```text
mode: delta | append-only
snapshotSemantics: complete | incremental | one_shot
```

They answer different questions.

## Artefacts

Map existing artefacts into target knowledge objects:

```text
raw snapshot       → Observation evidence
normalised output  → extracted candidates
diff report        → changes in source assertions
resolution         → candidate/entity mappings
write report       → ProjectionRun
```

# 62. Cost and Model Routing to Port

Port the deterministic-first hierarchy:

```text
Tier 0 Existing BNDY knowledge
Tier 1 URL/metadata/JSON-LD/OpenGraph
Tier 2 external IDs / Google Place
Tier 3 deterministic extraction/matching
Tier 4 cheap structured model
Tier 5 stronger ambiguity-resolution model
Tier 6 operator exception handling
```

Port interpretation caching by URL, canonical URL, content hash, Google Place ID, model input hash, prompt version, model version and entity/source combination.

Port and extend job budgets:

```ts
type DiscoveryBudget = {
  maxDepth: number;
  maxEntities: number;
  maxSearches: number;
  maxFetches: number;
  maxModelCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxEstimatedCost: number;
  allowExpensiveModel: boolean;
  deadlineMs: number;
};
```

# 63. AWS Capabilities to Port Selectively

## Step Functions

Retain for complex interpretation, ambiguity resolution, expensive reprocessing and admin-triggered deep workflows.

Do not make every routine source scan a Step Function.

Routine source scanning remains:

```text
EventBridge
→ Dispatcher
→ SQS
→ Source Worker
```

## Bedrock

Port as an alternate model provider, not a replacement for Gemini.

Target:

```text
GeminiProvider
BedrockClaudeProvider
DeterministicProvider
```

Example routing:

```text
Google/public identity discovery → Gemini + Search grounding
cheap structured interpretation  → Bedrock Haiku
poster + identity discovery      → Gemini multimodal + Search
hard ambiguity                   → stronger routed model
```

## Textract

Retain as optional deterministic OCR.

## Chromium

Port `@sparticuz/chromium` / `puppeteer-core` support, but isolate browser jobs:

```text
Source Worker
  ├─ static/API → continue
  └─ browser required
       → BrowserScanQueue
       → Chromium Lambda
```

# 64. Intelligence Pass

Port the concept:

```text
cheap deterministic run
→ unresolved cases only
→ AI intelligence pass
```

Retain budgets, cost cap, context-aware resolution, audit reasoning and evidence logging.

Do not retain blanket `NEVER auto-CREATE`.

Target:

```text
safe additive + high-confidence → auto-apply
ambiguous / destructive / conflicting → Exception Queue
```

# 65. Concepts Not to Port

Do not port:
- Human Review as the default claim lifecycle
- ParkingLot as a strategic domain concept
- one Lambda per source
- separate long-term review table
- separate Signals DynamoDB/S3 as parallel strategic stores
- old target-state documents as authoritative
- old ADR naming bndy-signals the canonical runtime

Rename operational `Review Queue` to `Exception Queue`.

The target human model is exception-only.

# 66. Port / Merge / Retire Matrix

| bndy-signals capability | Decision |
|---|---|
| Signal concept | PORT as Observation/Signal semantics |
| Immutable evidence | PORT |
| Extraction entity | PORT |
| Interpretation entity/versioning | PORT |
| Claims | PORT + generalise |
| EvidencePack | PORT + improve authority scoring |
| EventCandidate | PORT concept, simplify |
| Entity candidate/resolution | PORT |
| SourceConfig | PORT + merge with GigSource |
| Snapshot semantics | PORT |
| Deterministic-first hierarchy | PORT |
| Model budgets | PORT |
| Interpretation cache | PORT |
| Step Functions | PORT selectively |
| Bedrock provider | PORT as alternate model provider |
| Textract | RETAIN as optional extractor |
| Source Runner orchestration | PORT |
| GigsNews adapter/tests | PORT immediately |
| KLMA adapter/tests | PORT |
| OnTheCase adapter/tests | PORT |
| Scenic Eye adapter/tests | PORT |
| Chromium Lambda support | PORT |
| S3 source-run evidence semantics | PORT into EvidenceBucket |
| Intelligence Pass | PORT + change policy |
| Separate review table | RETIRE |
| Parking Lot domain concept | RETIRE |
| Human review by default | RETIRE |
| Never auto-create | RETIRE |
| One Lambda per source | RETIRE |
| Separate Signals DynamoDB as long-term target | RETIRE |
| Separate Signals S3 as long-term target | RETIRE |
| ADR naming bndy-signals canonical runtime | SUPERSEDE |
| bndy-signals target docs as authority | SUPERSEDE |

# 67. Revised Unified Target Architecture

```text
                             INPUTS
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
     bndy-capture         scheduled sources      Gig Sources
   Facebook / poster      GigsNews/KLMA/etc      venue sites
          │                    │                    │
          └────────────────────┼────────────────────┘
                               ▼
                         SOURCE REGISTRY
                               │
                               ▼
                           OBSERVATION
                        immutable evidence
                               │
                               ▼
                   DETERMINISTIC EXTRACTION
                               │
                       sufficient result?
                         │            │
                        yes          no
                         │            ▼
                         │      INTERPRETATION
                         │     Gemini / Bedrock
                         │            │
                         └──────┬─────┘
                                ▼
                              CLAIMS
                                │
                                ▼
                         EVIDENCE PACKS
                                │
                                ▼
                          RECONCILIATION
                    ┌───────────┼───────────┐
                    │           │           │
                  Artist       Venue       Event
                    │           │           │
                    └───────────┼───────────┘
                                ▼
                         CANONICAL BNDY APIs
                                │
                                ▼
                           PROJECTIONS
                                │
                                ▼
                            BNDY product
```

Later:

```text
Claims + Evidence Packs + Resolutions
→ Neptune
→ graph inference
→ Projection engine
→ canonical BNDY APIs/read model
```

# 68. Consolidation Implementation Plan

## Phase 1: establish authority

1. Copy this paper to:

```text
bndy-enrichment/docs/TARGET-ARCHITECTURE.md
```

2. Add the single-source-of-truth declaration.
3. Add a migration notice to `bndy-signals/README.md`.
4. Stop creating strategic target-state documents in `bndy-signals`.

## Phase 2: port canonical shared types

Port/reconcile:
- Signal / Observation
- Extraction
- Interpretation
- Claim
- EvidencePack
- EntityCandidate
- EventCandidate
- Resolution
- SourceConfig
- SnapshotSemantics
- Budget

Create one canonical schema home in `bndy-enrichment`.

## Phase 3: port Source Runner framework

Port:
- runner orchestration
- storage/state interfaces
- diff logic
- normalisation utilities
- source config loader
- safety/budget handling
- run reporting

Modify output to create Observations/Claims before projection.

## Phase 4: port adapters

Order:

```text
1. GigsNews
2. KLMA Stoke
3. On The Case
4. Scenic Eye
```

For each:

```text
port code
port tests
dry comparison
AWS shadow mode
compare with existing production/Cowork
switch authority
retire old runner
```

## Phase 5: unify AWS storage

Migrate required records from:

```text
bndy-signals-*
bndy-source-state-*
bndy-source-review-*
```

into the target `bndy-enrichment` evidence/knowledge model.

Do not delete evidence until migration/retention is verified.

## Phase 6: unify model runtime

Add provider abstraction and retain:
- Gemini
- Bedrock Claude
- deterministic extraction
- cost tracking
- budgets

## Phase 7: retire direct-write paths

Move direct enrichment/source writes toward:

```text
Observation
→ Claims
→ Reconciliation
→ canonical BNDY APIs
```

Do not remove existing production paths until parity is proven.

## Phase 8: archive bndy-signals

Archive only when:
- active source adapters are migrated
- required historical state is retained
- signal/claim concepts are migrated
- production schedules are replaced
- no clients depend on its APIs
- target docs are moved
- CI/deployment is no longer required

# 69. Consolidation Acceptance Criteria

Consolidation is complete when:

1. Exactly one authoritative target architecture document exists.
2. `bndy-enrichment` owns all new enrichment/source/claim runtime development.
3. Capture, venue source scans and curated source scans emit the same Observation/Claim model.
4. GigsNews, KLMA, OnTheCase and Scenic Eye run from the unified runtime.
5. No production source job remains uniquely implemented in `bndy-signals`.
6. One canonical Source Registry exists.
7. One canonical evidence/observation model exists.
8. One canonical claim schema exists.
9. One reconciliation path exists.
10. All canonical entity mutations go through BNDY domain APIs.
11. Human handling is exception-only.
12. `bndy-signals` is archived.

# 70. Final Architectural Position

`bndy-signals` is not discarded. It is mined for proven concepts, adapters and tests.

It does not remain a second strategic runtime.

```text
bndy-signals
   ↓
port proven concepts + adapters + tests
   ↓
bndy-enrichment
   ↓
single source runtime
single claim runtime
single target architecture
single AWS evolution path
```

Strong capabilities coming from `bndy-signals`:

```text
source runner
source adapters
signal semantics
extraction
interpretation versioning
claims
evidence packs
cost budgets
Bedrock
Chromium source acquisition
```

Strong/current capabilities coming from `bndy-enrichment`:

```text
Capture integration
Android intake
private image ingestion
Gemini Google grounding
multimodal poster processing
current BNDY API integration
venue Gig Source capability
knowledge-graph target
```

The consolidated runtime deliberately keeps the best of both.

---

# 71. Corrections and clarifications (accepted review, 20 August 2026)

These corrections are part of the authoritative architecture. Where an earlier section conflicts, this section wins.

## 71A. Cancellation: target vs interim

TARGET: the canonical Event has an explicit cancelled state (§21.1).

INTERIM DUAL-MODE IMPLEMENTATION, until the cancelled product state ships (BUILD-PLAN WP-17):

- an authoritative cancellation or eligible withdrawal deletes/hides the current Event projection;
- a durable tombstone preserves the cancellation knowledge;
- Claims and Observations are never deleted;
- WP-17 later reprojects tombstoned cancellations as status=cancelled.

Tombstones have a lifecycle: `active | superseded | reinstated`. An active tombstone blocks creation unless a fresh explicit artist-owned or venue-owned reinstatement claim supersedes it. TTL is never the primary mechanism.

## 71B. Knowledge truth

Replace any "graph is truth" reading with: **the durable knowledge substrate is truth**. Immutable Observations, Claims, Resolutions, Tombstones and supporting evidence are durable and survive projection changes. Artist/Venue/Event product records are materialised projections, rebuildable only where stable canonical IDs and external references are preserved. A future graph database (Neptune) is initially a projection/index of that substrate and must never silently become the only copy of evidence.

## 71C. Claim storage is single-copy

The multi-partition key examples in §28.1 and §53 are ACCESS PATTERNS, not storage copies. Each Claim is stored once (`PK CLAIM#<claimId>`), reached through GSIs (by observation, by subject) and through lightweight immutable support-link records (`PK ENTITY#<type>#<id> SK SUPPORT#<claimId>`) that hold the claimId only. The same principle applies to Interpretations and Evidence Packs.

## 71D. Scheduling is due-source dispatch

Replace the single fixed daily rule illustration in §8.1. The scheduler is an EventBridge tick (15 to 30 minutes) driving a dispatcher that queries a due-source index (`nextScanAt <= now`), enqueues, and atomically advances `nextScanAt` using each source's timezone, cadence and local time. This is BST/GMT correct and supports daily, twice-daily and weekly schedules with one scheduler.

## 71E. Source configuration ownership

The Source Registry is the canonical executable source configuration. Entity-level convenience fields such as `venue.gigSource` are read projections/references only. Any configuration API (for example `PUT /api/venues/{venueId}/gig-source`) upserts the Source Registry through one canonical path. The same configuration is never independently written to two stores.

## 71F. Event identity is a projection constraint

`same resolved artist + same resolved venue + same date = same performance` is the CURRENT BNDY projection sentinel, enforced by the canonical Event API. It is not the permanent knowledge-layer identity rule. Candidates and claims always retain sourceEventKey, native source ID, time, event URL and festival/stage identity, so the product sentinel can evolve later without losing source truth.

## 71G. Projection queue is required

The optional `ProjectionQueue` in §35 is REQUIRED for source imports. Source workers persist Observations and Claims, then emit one ProjectionWorkItem per candidate/event change. A separate ProjectionWorker consumes them with per-item idempotency (`sourceId + observationId + candidateKey + projectionAction`), per-item retries and a per-item DLQ path. Browser acquisition is likewise isolated: sources with `runtimeClass: browser` dispatch to a dedicated BrowserScanQueue and Chromium-equipped worker; Chromium is never bundled into the standard worker.

## 71H. Capture convergence is a named migration step

Before `bndy-signals` is archived, the existing Capture processor migrates onto the shared Observation/Claim/Projection pipeline (BUILD-PLAN WP-18), reusing the proven Facebook URL and poster discovery behaviour without prompt rewrites. Acceptance criterion 3 in §69 is met by this step, not assumed.

## 71I. Enrichment on create

The legacy GoogleDiscoveryWorker direct-write path (§2A.8) is not a target dependency. Entity enrichment on create flows through an EntityEnrichmentWorkItem whose worker reuses the Gemini/Google discovery libraries but writes Observations/Claims and projects accepted fields through canonical BNDY APIs. Any use of the legacy path is a flagged temporary bridge with a stated removal criterion.

## 71J. Incomplete observations

`complete: false` means: additions and updates supported by positive evidence may be claimed and projected; disappearance must not produce a ClaimWithdrawal; cancellation requires an explicit cancellation claim; the prior complete snapshot remains the cancellation baseline.

## 71K. Minimum source authority in wave 1

Predicate-specific authority (§15) ships as a deterministic AuthorityPolicy with explicit authority classes before any scheduled source writes production. Minimum destructive rule: a lower-authority source may not delete or withdraw a canonical event while a fresh higher-authority claim still supports it. Learned reliability (§31) remains deferred.
