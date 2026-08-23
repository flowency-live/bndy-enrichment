# Fresh Agent Mission — National Lemonrock into BNDY Backline

## Mission: Put national Lemonrock into BNDY Backline tonight

You have a fresh context window. Your job is to **autonomously build, deploy and start the national Lemonrock bootstrap into BNDY Backline**, and make the resulting Backline data visibly inspectable in BNDY Backstage / Godmode.

**Do not spend the session producing another strategy document. The implementation plan already exists. Execute it.**

## Definition of success when I return

I want to be able to open Backstage and see that Lemonrock is genuinely entering **BNDY Backline**, ideally with:

- national Lemonrock Artists discovered
- national Lemonrock Venues discovered
- current/future Lemonrock Gigs discovered
- Artist/Venue rich profile hydration running or substantially complete
- bios, genres, locations, websites and social URLs retained where Lemonrock provides them
- immutable source evidence stored
- Observations created
- atomised Claims created
- Lemonrock source-native identities retained
- identity resolution against existing BNDY running
- legacy poor-quality Lemonrock/Cowork imports being identified rather than duplicated
- bootstrap progress/counts visible
- **Backline Explorer** available in Backstage/Godmode
- preferably an Obsidian-style graph view that can inspect Lemonrock → Artist/Venue/Gig → Claims/Evidence → canonical BNDY relationships

The critical result is **Lemonrock in Backline and viewable**. Do not block the entire delivery because canonical publication into public BNDY needs additional caution.

---

## Start here

Primary runtime repo:

`flowency-live/bndy-enrichment`

Read these first:

1. `docs/LEMONROCK-NATIONAL-INGESTION.md`
2. `docs/BUILD-PLAN.md`
3. `docs/TARGET-ARCHITECTURE.md` if required for architectural detail

The Lemonrock plan was committed as:

`f51d3ba6f10860da6b47d2fcc06853761188bca6`

The BNDY workboard is:

`flowency-live/bndy-website/public/workboard.json`

Latest known Lemonrock/workboard commit from the preceding session:

`32b42cc13318c2d8379cbd8ba2191b5991051fde`

**Re-fetch current `main` everywhere before changing anything. Other agents may have committed since these SHAs.**

Supporting repos:

- `flowency-live/bndy-backstage` = Godmode / Backline Explorer UI
- `flowency-live/bndy-serverless-api` = canonical BNDY product APIs
- `flowency-live/bndy-website` = workboard

Do **not** create a new `bndy-backline` repository.

**BNDY Backline is the capability/product name. `bndy-enrichment` is its strategic runtime.**

Existing architecture explicitly says one strategic runtime/repo, not another parallel ingestion platform.

---

## Non-negotiable architecture

```text
Lemonrock
     ↓
source acquisition
     ↓
immutable evidence
     ↓
Observations
     ↓
source-native Artist / Venue / Gig identities
     ↓
atomised Claims
     ↓
identity resolution / authority / conflicts
     ↓
projection
     ↓
canonical BNDY APIs
```

The durable Backline knowledge substrate is the intelligence truth.

Canonical Artist/Venue/Event records are product projections.

The graph is a **derived view**, not the authority.

Existing Backline infrastructure in `bndy-enrichment` already includes much of what you need:

- Source Registry
- EventBridge SourceDispatcher
- SourceScanQueue / BrowserScanQueue + DLQs
- SourceAdapter contract
- generic Source Runner
- HTTP acquisition
- Chromium acquisition
- S3 evidence
- DynamoDB Observation/Claim/SourceState/Tombstone storage
- ProjectionQueue
- ProjectionWorker
- authority policy
- canonical API projection
- read-back verification
- parity artefacts
- shadow / writerAuthority controls

**Reuse this. Do not build another crawler platform.**

---

# The Lemonrock objective is NATIONAL

Do not start with Staffordshire, Stoke, a county, a test geography or a sample cohort as the target architecture.

You may use small fixtures while developing parsers, but the first actual bootstrap target is:

**all discoverable UK Lemonrock Artists + Venues + current/future Gigs.**

The operating principle is:

> **Ingest everything into Backline. Project selectively into canonical BNDY.**

An unresolved Lemonrock Artist is still valuable Backline knowledge.

An unresolved Lemonrock Venue is still valuable Backline knowledge.

An unresolved Lemonrock Gig must not be thrown away merely because its entities cannot yet safely be projected.

---

# Rich data is required

Do not reproduce the old thin Cowork imports.

Lemonrock Artist pages can contain materially richer information. Preserve everything useful that can be extracted deterministically, including where available:

- source identity / slug / URL
- Artist name
- artist format
- genres
- originals/covers information
- based-in location
- biography / profile text
- website
- Facebook
- Instagram
- YouTube
- Bandcamp
- other socials
- telephone
- email
- enquiry/contact details
- maintained/claimed state
- last update information
- upcoming gig relationships

Venue pages likewise need rich extraction:

- source identity
- name
- type
- address
- locality
- postcode
- website
- Facebook
- Instagram / socials
- phone
- email
- venue profile/bio
- live-music information
- capacity/facilities when present
- claimed/maintained state
- upcoming gigs

**Do not discard fields just because canonical BNDY does not currently expose somewhere to project them. Store them as Backline Claims/evidence.**

Do not generate artist bios. Preserve source text as evidence.

---

# Source discovery model

Inspect the live Lemonrock structure yourself before finalising the parser.

Known useful surfaces include:

- Newly Posted Gigs
- cancellations / explicit cancelled state
- national/current gig indexes
- Artist A-Z / directories
- Venue A-Z / directories
- individual Artist pages
- individual Venue pages
- individual Gig pages
- county/region indexes
- per Artist/Venue gig feeds
- CSV/iCalendar where accessible

Test actual production accessibility from the runtime rather than assuming an endpoint works from AWS.

Preferred acquisition:

1. deterministic HTTP
2. structured/feed endpoint
3. Chromium only where necessary

Do not put Gemini/Claude in the normal HTML parsing hot path.

Use model/search enrichment only where deterministic source parsing or identity resolution genuinely requires it.

---

# Stable Lemonrock identities

This is essential.

Use source-native identities before attempting BNDY resolution.

Examples:

```text
lemonrock:artist:<native-slug-or-id>
lemonrock:venue:<native-slug-or-id>
lemonrock:gig:<native-gig-id>
```

If Lemonrock exposes a numeric gig ID, retain it.

Never make `artist + venue + date` the permanent Lemonrock identity.

That can be a canonical matching signal but is not the source identity.

---

# Build order

Work continuously. Do not stop after LR-01 and report back.

The plan has LR-01 through LR-09. Execute as far through it as technically possible tonight.

## P0: make national Backline ingestion real

- Lemonrock source family
- identity utilities
- Artist enumeration
- Venue enumeration
- national/current/future Gig enumeration
- gig detail parsing
- rich Artist hydration
- rich Venue hydration
- cancellation parsing
- immutable evidence
- Observations
- Claims
- resumable bootstrap
- bounded concurrency
- retry/backoff
- progress metrics

## P0: start the actual bootstrap

Do not merely leave me a command to run tomorrow.

If the AWS environment and credentials/workflows allow it:

- deploy the required Backline infrastructure/code
- start the national bootstrap
- ensure it is a durable server-side process that continues after your interactive session ends
- verify queue/job progress
- verify evidence/Claims are accumulating

**Do not implement a bootstrap that only survives while your terminal/process remains open.**

Use durable AWS queues/workers/schedules or another existing durable mechanism.

## P0: make it viewable

Build a **Backline Explorer** inside `bndy-backstage`.

At minimum I need a useful read-only operational UI showing:

- Lemonrock source status
- Artists discovered/hydrated/resolved
- Venues discovered/hydrated/resolved
- Gigs discovered/hydrated/resolved
- Claims count
- Observation count
- parse failures
- unresolved/conflicting identities
- queue/bootstrap progress
- last successful scans

And an entity/source inspector.

Search Artist/Venue/Gig and show:

```text
Canonical BNDY entity
    ↕
Lemonrock source identity
    ↕
Claims
    ↕
Observations
    ↕
raw evidence
```

Build the **Obsidian-style graph view** if reasonably possible tonight.

Graph nodes should support:

- Artist
- Venue
- Gig
- Source
- canonical BNDY entity

Claims/Observations may be collapsed by default and expanded when requested so the graph does not become unusably noisy.

Clicking a node should expose details rather than producing a decorative graph.

A useful working Explorer beats a visually elaborate but fake mock-up.

---

# Read API for Explorer

Backstage must not directly query DynamoDB from the browser.

Inspect the current architecture and implement the smallest appropriate **authenticated read-only Backline Explorer API** over the existing Backline stores.

Reuse existing Backstage/Godmode authentication patterns.

Do not expose raw Backline evidence publicly.

Required read capabilities should cover at least:

- source-family summary
- bootstrap status
- search source/canonical entities
- subject Claims
- Observations/provenance
- graph neighbourhood
- evidence metadata / safe raw-evidence retrieval for Godmode

Keep canonical product APIs separate from Backline intelligence inspection.

---

# Legacy Cowork Lemonrock imports

Existing BNDY contains poor-quality Lemonrock-derived records from earlier Claude Cowork jobs.

Treat canonical BNDY as potentially dirty.

During resolution:

- look for existing Lemonrock provenance/external IDs
- match safely onto existing records where possible
- attach proper Lemonrock source-native identity
- identify duplicates
- identify low-quality imports
- record conflicts
- do not blindly create another copy
- do not destructively overwrite owner/verified/high-authority data

Make these conflicts visible in Explorer.

---

# Projection policy tonight

**Do not make public BNDY projection the blocker for the Backline bootstrap.**

The first national Backline ingest can run shadow/no-write while still producing real evidence and Claims.

If safe canonical resolution/projection can be proven during the session:

- test bounded safe writes
- read them back
- reuse existing canonical records
- retain source IDs/provenance

But do not mass-create questionable Artists/Venues simply to say the import is complete.

Backline completeness and canonical BNDY publication are different states.

Do not infer cancellation from disappearance.

Only explicit Lemonrock cancellation evidence should produce a cancellation Claim unless another documented source semantic is proven.

---

# AWS COST GUARDRAIL — NON-NEGOTIABLE

This project must remain effectively free-tier/serverless scale. Do not introduce any always-on or high-fixed-cost AWS service.

- Do **not** create NAT Gateway, EC2, ECS/Fargate, OpenSearch, Neptune, RDS or other persistent compute/database infrastructure.
- Reuse existing Lambda + SQS + DynamoDB + S3 Backline infrastructure.
- Use deterministic HTTP acquisition for Lemonrock wherever possible. Chromium is fallback only.
- Do not use Step Functions per Artist/Venue/Gig. Use durable SQS fan-out/workers.
- Keep worker concurrency deliberately bounded. Start low and increase only where needed.
- Compress raw HTML/evidence before S3 storage where practical.
- Never put complete HTML/evidence bodies into CloudWatch logs.
- Log IDs, counts, timing and errors only.
- Ensure new log groups have sensible retention rather than indefinite verbose retention.
- Do not add additional Secrets Manager secrets unless actually required.
- Before starting the national bootstrap, inspect the resources it will use and estimate requests/compute/storage.
- If implementation choices appear likely to create more than **£5 of incremental AWS cost for the bootstrap**, stop that particular approach and choose a cheaper architecture.
- Cost optimisation must **not** reduce Backline completeness. Slow/batch the work instead of discarding data.
- The bootstrap must remain durable and resumable, so throttling it does not lose progress.

Avoid architecture choices that turn a finite bootstrap into a persistent monthly cost.

---

# Operational requirements

Bootstrap must be:

- idempotent
- resumable
- durable
- observable
- rate-limited
- safe to restart
- source-key deduplicated
- bounded in concurrency

Handle:

- 403
- 429
- transient 5xx
- malformed pages
- structural extraction collapse
- zero-result false completeness
- retries and DLQ

Be polite to Lemonrock. Do not create uncontrolled request bursts.

If Lemonrock starts throttling, reduce concurrency and continue rather than repeatedly hammering it.

---

# Testing

Capture real Lemonrock fixtures.

Tests should include rich and sparse Artist/Venue pages and varied gigs:

- bio
- multiple genres
- Facebook/social
- free
- paid
- unknown admission
- sold out
- cancelled
- support artist
- multi-act
- festival if present
- unusual punctuation
- duplicate names
- sparse/unclaimed profiles

Run the repo's required build/test/check/synth gates before merging/deploying.

Do not mark something complete because code exists. Verify runtime evidence.

---

# Autonomy rules

You are expected to work autonomously for the full session.

**Do not stop to ask me routine implementation questions.**

Make sensible reversible engineering decisions consistent with the committed architecture.

When one path is blocked:

1. investigate it
2. document the blocker
3. take the next productive route
4. keep working

Do not spend hours arguing with yourself about theoretical perfect data quality.

The architectural answer to uncertainty is:

> **retain the source evidence and unresolved Claim in Backline; don't invent canonical truth.**

Do not wait for me to approve:

- parser implementation details
- fixture choices
- internal module naming
- test structure
- read-only Explorer UX
- sensible AWS worker sizing/rate limiting

Be more conservative about irreversible/destructive production mutations.

---

# Git workflow

Inspect current branches/PRs first because other work is active.

There is currently/was recently a large Brass PR in `bndy-enrichment`; do not accidentally overwrite or regress concurrent work.

Re-fetch files immediately before edits.

Keep Lemonrock changes coherent.

Commit meaningful milestones.

Use PRs where needed by the current repository workflow, but **do not leave the entire implementation sitting unmerged solely because creating a PR felt like the end of the task**.

Follow the repo's current deployment mechanics and verify what actually reached AWS.

Do not claim deployment without evidence.

---

# Workboard

Keep:

`flowency-live/bndy-website/public/workboard.json`

updated as substantive milestones are reached.

Re-fetch before every workboard write.

Preserve the existing `source-automation` and `intelligence` / **BNDY Backline** lanes rather than creating new duplicate lanes.

Update cards between `now`, `next`, `done` based on actual evidence.

Add commit/PR/deployment evidence.

Do not mark bootstrap complete merely because the crawler exists.

---

# What I want to see when I wake up

Leave a concise handoff containing:

## 1. What is running

Example:

```text
Lemonrock national bootstrap: RUNNING
Artists discovered: ...
Venues discovered: ...
Gigs discovered: ...
Artists hydrated: ...
Venues hydrated: ...
Claims: ...
Observations: ...
unresolved: ...
failures/retries: ...
```

## 2. Where I can see it

Backstage route / Explorer route and what is available there.

## 3. What reached production/AWS

Exact deployed commits/workflows/runtime evidence.

## 4. What did not complete

Only genuine remaining blockers/work, with no vague "next steps".

## 5. Git evidence

Commits / PRs / relevant deployment evidence.

---

## Final instruction

Start by reading the committed Lemonrock plan and current code.

Then **build**.

Do not reply with a new proposed plan unless you discover a material contradiction in the committed architecture.

The mission tonight is:

> **Get the national Lemonrock ecosystem into BNDY Backline, keep the bootstrap running unattended, and make the intelligence visible in Backline Explorer before the session ends.**

Keep going until you have exhausted productive implementation/deployment work.
