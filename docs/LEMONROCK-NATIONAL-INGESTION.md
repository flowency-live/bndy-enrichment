# BNDY Backline — Lemonrock National Ingestion Implementation Plan

**Status:** Ready for build  
**Scope:** Full UK Lemonrock bootstrap into BNDY Backline (BBL), followed by continuous change detection and reconciliation  
**Primary repo:** `flowency-live/bndy-enrichment`  
**Supporting repos:** `flowency-live/bndy-serverless-api`, `flowency-live/bndy-backstage`  
**Target outcome:** A complete, durable, source-native Lemonrock knowledge set in Backline containing every discoverable current artist, venue and future gig, with the richest available profile data, provenance, change history and controlled projection into canonical BNDY.

---

## 1. Objective

Build Lemonrock as a first-class national Backline source.

The first production bootstrap should aim to ingest the **entire discoverable Lemonrock UK universe**, not one geography:

- all discoverable Lemonrock artists
- all discoverable Lemonrock venues
- all current/future Lemonrock gigs
- festival relationships where present
- explicit cancellations, TBC and sold-out state
- artist profile enrichment available on Lemonrock
- venue profile enrichment available on Lemonrock
- source-native identities and URLs
- raw source evidence
- atomised Claims
- links from Lemonrock source identities to canonical BNDY identities where resolution is safe

The operating principle is:

> **Ingest everything into Backline. Project selectively into canonical BNDY.**

A weak or ambiguous Lemonrock entity must not be discarded. It stays in Backline unresolved until enough evidence exists to resolve it safely.

---

## 2. Why Backline changes the ingestion model

The old Cowork pattern was effectively:

`source -> agent interpretation -> canonical BNDY write`

That made every ambiguity a production data-quality problem.

The Backline model is:

`source -> evidence -> source-native identity -> Claims -> resolution -> authority -> projection -> canonical BNDY`

Therefore:

- a Lemonrock artist can exist in Backline without becoming a BNDY Artist
- a Lemonrock venue can exist in Backline without becoming a BNDY Venue
- a Lemonrock gig can exist in Backline without being publicly projected
- conflicting evidence is retained rather than overwritten
- later sources can resolve previously ambiguous Lemonrock identities
- historical source observations can repair poor legacy Cowork imports

---

## 3. Current Backline capabilities to reuse

Do not build a parallel scraper platform.

The current `bndy-enrichment` strategic source runtime already provides the core machinery:

- Source Registry
- 15-minute EventBridge SourceDispatcher
- standard source queue + DLQ
- browser source queue + DLQ
- generic `SourceAdapter` contract
- generic Source Runner
- HTTP acquisition
- isolated Chromium acquisition
- immutable S3 source/evidence artefacts
- DynamoDB Observations and Claims
- deterministic diffing
- ProjectionQueue
- ProjectionWorker
- canonical Artist / Venue / Event writes
- read-back verification
- source-specific authority policy
- tombstones
- shadow mode
- single-writer authority
- parity artefacts and cutover gates

Lemonrock should plug into this runtime as a set of source adapters/jobs sharing one source family and one source-native identity model.

---

## 4. Lemonrock source surfaces

Lemonrock should be treated as a **source family**, not a single URL.

### 4.1 National gig discovery

Primary fast-change source:

- `https://www.lemonrock.com/newestgigs.php`

Capture, where present:

- event date
- artist
- artist format / genre text
- venue
- locality
- description
- who posted it
- posting timestamp
- start/end time
- admission
- cancellation markers
- links to gig / artist / venue pages

Purpose:

- discover newly posted gigs quickly
- discover previously unseen artists
- discover previously unseen venues
- capture posting provenance

Cadence target: **hourly**.

### 4.2 Explicit cancellations

Use Lemonrock's cancellation listings / explicit cancelled states as a separate authority path.

Purpose:

- create explicit `event.status = cancelled` Claims
- capture cancellation timestamp/text where present
- distinguish explicit cancellation from mere disappearance

Rule:

> **Never infer cancellation merely because a listing disappears.**

### 4.3 Artist directory / artist pages

National artist discovery should enumerate Lemonrock artist identities and hydrate each artist page.

Capture where available:

- source-native slug / identity
- artist name
- band format / solo / duo / trio etc.
- genres
- originals/covers
- based-in location
- biography / free-form profile text
- website
- Facebook URL or Facebook references
- Instagram references
- YouTube references
- Bandcamp references
- telephone
- email
- enquiry details
- availability / equipment / services info
- music/player presence
- media counts
- page-maintained / unclaimed state
- last-updated date
- page views
- upcoming gigs
- gig feed URL
- CSV / iCal export availability where exposed

Backline should preserve **all useful source facts**, even where they are not currently canonical BNDY fields.

Do not discard richness simply because the current Artist API has no field for it.

### 4.4 Venue directory / venue pages

National venue discovery should enumerate Lemonrock venue identities and hydrate each venue page.

Capture, where available:

- venue name
- venue type
- locality
- postcode
- full address
- phone
- email
- website
- Facebook
- Instagram / other social links
- venue description
- live-music notes
- capacity if present
- accessibility / facilities if present
- contact/enquiry details
- last updated
- claimed / maintained state
- upcoming gigs
- gig feed URL
- CSV / iCal export availability

Again: preserve source richness in Backline even if projection into canonical BNDY is initially partial.

### 4.5 Artist / venue gig feeds

Lemonrock exposes per-page gig feeds and, for some pages, CSV/iCalendar links.

Examples include:

- `gigfeed.php?ref=<slug>`
- `gigfeed.php?ref=<slug>&all=1`
- `ical.php?...`
- `csv.php?t=<slug>&y=5`

Use these as structured reconciliation sources **where access is practical and permitted**.

Lemonrock documents restrictions for non-UK server access to CSV/iCal and may require an access key. The production runtime must test actual access from the deployed AWS region before treating CSV/iCal as a guaranteed source.

Preferred acquisition order:

1. direct stable HTML/HTTP endpoint
2. gigfeed HTML
3. CSV/iCal when usable
4. Chromium only where server-rendered HTTP is insufficient

Do not default to browser automation unless required.

### 4.6 National / county / region indexes

Use national/category/county/region gig indexes as **completeness controls**, not the primary fast ingest.

Purpose:

- detect missing source identities
- audit bootstrap completeness
- verify counts / coverage
- discover entities not surfaced recently

---

## 5. Source family design

Create a Lemonrock source family with explicit jobs.

Suggested IDs:

```text
lemonrock-new-gigs
lemonrock-cancellations
lemonrock-artist-index
lemonrock-venue-index
lemonrock-artist-hydration
lemonrock-venue-hydration
lemonrock-gig-hydration
lemonrock-future-reconcile
lemonrock-full-reconcile
```

Do not represent all of Lemonrock as one monolithic Source Runner execution.

The source family shares:

- Lemonrock identity rules
- parser utilities
- HTTP client behaviour
- evidence conventions
- Claim predicates
- resolver hooks
- authority policy
- rate limits
- metrics

---

## 6. Source-native identity model

This is non-negotiable.

Every Lemonrock object must have a stable source identity before BNDY resolution.

### Artist

```text
source = lemonrock
sourceEntityType = artist
sourceEntityKey = lemonrock:artist:<stable-slug-or-id>
sourceUrl = https://www.lemonrock.com/<slug>
```

### Venue

```text
source = lemonrock
sourceEntityType = venue
sourceEntityKey = lemonrock:venue:<stable-slug-or-id>
sourceUrl = https://www.lemonrock.com/<slug>
```

### Gig

Prefer the numeric Lemonrock gig ID where exposed.

```text
source = lemonrock
sourceEntityType = event
sourceEntityKey = lemonrock:gig:<gig-id>
sourceUrl = https://www.lemonrock.com/gig.php?id=<gig-id>
```

Never use only `artist + venue + date` as the Lemonrock source identity. That combination is a matching signal, not the authoritative source key.

---

## 7. Evidence model

Every acquisition produces immutable evidence.

Recommended S3 layout:

```text
evidence/
  lemonrock/
    newest-gigs/
      YYYY/MM/DD/<timestamp>-<hash>.html
    cancellations/
      YYYY/MM/DD/<timestamp>-<hash>.html
    artists/
      <source-key>/
        YYYY/MM/DD/<timestamp>-<hash>.html
    venues/
      <source-key>/
        YYYY/MM/DD/<timestamp>-<hash>.html
    gigs/
      <gig-id>/
        YYYY/MM/DD/<timestamp>-<hash>.html
    indexes/
      artists/
      venues/
      counties/
      regions/
```

Store:

- exact acquired bytes
- source URL
- acquiredAt
- HTTP metadata
- content hash
- parser version
- adapter version
- completeness assessment
- normalized payload
- parsing warnings

Source evidence is immutable.

---

## 8. Claim model

Create atomised Claims rather than duplicated source documents.

### Artist predicates

```text
artist.name
artist.format
artist.genre
artist.originalsCovers
artist.basedIn
artist.bio
artist.websiteUrl
artist.facebookUrl
artist.instagramUrl
artist.youtubeUrl
artist.bandcampUrl
artist.phone
artist.email
artist.enquiryContact
artist.info
artist.lemonrockClaimed
artist.lemonrockMaintained
artist.sourceLastUpdatedAt
```

Multi-valued data such as genres and socials must remain multi-valued source Claims.

### Venue predicates

```text
venue.name
venue.type
venue.address
venue.locality
venue.postcode
venue.websiteUrl
venue.facebookUrl
venue.instagramUrl
venue.phone
venue.email
venue.bio
venue.capacity
venue.facilities
venue.liveMusicInfo
venue.lemonrockClaimed
venue.lemonrockMaintained
venue.sourceLastUpdatedAt
```

### Event predicates

```text
event.artist
event.supportArtist
event.venue
event.date
event.startTime
event.endTime
event.admissionText
event.price
event.ticketed
event.ticketUrl
event.description
event.status
event.cancelledAt
event.cancellationText
event.postedByType
event.postedAt
event.festival
event.sourceGigId
event.sourceUrl
```

Unknown is valid. Do not manufacture a value merely to satisfy canonical BNDY fields.

---

## 9. Rich data policy

The Lemonrock ingestion must be richer than the old Cowork import.

### Preserve raw and structured profile text

Artist bio/profile text and venue descriptive text should be stored in Backline even if not immediately projected.

### Preserve socials independently

Classify URLs by host:

- facebook.com -> Facebook
- instagram.com -> Instagram
- youtube.com / youtu.be -> YouTube
- bandcamp.com -> Bandcamp
- otherwise -> website

Also inspect free-text profile sections for explicitly linked socials where deterministic parsing is possible.

### Preserve source confidence context

The Lemonrock page state matters:

- claimed / maintained by artist
- claimed / maintained by venue
- unclaimed
- gig posted by artist
- gig posted by venue
- page last updated

These feed predicate-specific authority/confidence decisions.

---

## 10. Bootstrap strategy

The bootstrap is a national inventory build.

### Phase A — enumerate

Enumerate:

- artist directory
- venue directory
- all discoverable future gigs
- cancellation state
- festival relationships where surfaced

Output source-native identity queues only. Do not block enumeration on BNDY identity resolution.

### Phase B — hydrate

Hydrate all discovered source identities using bounded, resumable queues for Artists, Venues and Gigs.

Requirements:

- conservative concurrency
- adaptive delay
- retry with exponential backoff
- 429 / 403 / 5xx handling
- per-host concurrency cap
- no uncontrolled fan-out
- checkpointed progress

### Phase C — create Claims

For every hydrated object:

1. persist Observation
2. parse deterministic structured data
3. emit atomised Claims
4. record parse warnings / missing fields
5. link event -> artist source identity
6. link event -> venue source identity
7. link festival/support relationships

### Phase D — resolve source identities against BNDY

Resolution is asynchronous.

#### Artist ladder

1. existing Lemonrock externalId on BNDY Artist
2. exact known source URL
3. exact normalized name + strong location evidence
4. exact social URL
5. exact official website
6. stronger cross-source identity evidence
7. hold for review

#### Venue ladder

1. existing Lemonrock externalId
2. exact Lemonrock URL
3. exact name + postcode
4. exact name + address
5. exact website / Facebook URL
6. geo/address corroboration
7. hold for review

Never create a new canonical entity merely because the name is similar.

### Phase E — canonical projection

Only project when sufficient conditions are met.

Safe existing entities are linked and reused. Safe new entities may use canonical find-or-create plus read-back. Ambiguous entities remain in Backline and are surfaced through Backline Explorer.

---

## 11. Legacy Cowork Lemonrock repair

The bootstrap must explicitly reconcile existing BNDY data created by previous Lemonrock Cowork agents.

Do not treat canonical BNDY as clean.

For every Lemonrock source object:

1. search existing canonical records
2. inspect existing source/provenance metadata
3. detect likely Cowork Lemonrock imports
4. attempt source-native identity attachment
5. compare Lemonrock Claims against current BNDY fields
6. classify as exact match, enriched, likely duplicate, conflicting, or poor/ambiguous legacy record
7. do not destructively overwrite higher-authority curated/owner data
8. queue conflicts for Explorer review

Poor imports should become attached to proper Lemonrock identities and gain evidence/history instead of being re-imported as duplicates.

---

## 12. Ongoing change detection

### Fast loop — hourly

Scan:

- newest gigs
- explicit cancellations

Purpose:

- new gig discovery
- hydrate the artist and venue identities referenced by a new gig
- explicit cancellation

Fast-feed parsing is deliberately bounded to the gig links on the current feed page. It must not follow global town/date navigation and accidentally start a national crawl every hour.

### Daily future-source health

Fetch the national future-gig root once per day and verify that its expected county/index structure remains present. This is a one-page structural health check with no child fan-out.

### Monthly future-gig reconciliation

Run the national future-gig discovery graph once per month to repair anything missed by the hourly new/cancellation feeds and refresh known future-gig details. Duplicate paths to the same gig collapse onto one monthly hydration key.

Detect date/time/venue/lineup/admission/ticketing/status/description changes. Disappearance is withdrawal evidence, not cancellation evidence.

### Gig-led artist and venue hydration

Do not run recurring national artist or venue directory crawls. Hydrate an artist and venue when a new or reconciled gig references the source-native identity. Profile hydration does not recursively fan back out into every gig on that profile.

Artists and venues without an attached gig remain in the completed bootstrap corpus but are not continually refreshed. A full artist/venue directory reconciliation remains available as a deliberate manual audit, not a schedule.

This operating model prioritises live-gig accuracy while keeping Lambda, SQS, DynamoDB and S3 activity bounded.

---

## 13. Snapshot semantics

Each Lemonrock job must explicitly declare semantics:

- Newly posted gigs: append/change feed. Absence means nothing.
- Cancellation feed: explicit event-state feed.
- Artist index: directory snapshot; absence is not deletion.
- Venue index: directory snapshot; absence is not deletion.
- Known future gig page: entity snapshot requiring source-specific interpretation.
- County/region indexes: completeness audits only.

---

## 14. Authority policy

Authority is predicate-specific.

### Strong

- explicit cancelled marker on source gig
- exact Lemonrock source gig ID
- event date/time directly on gig page
- artist/venue relationship directly on gig page
- artist-maintained artist-page social URL
- venue-maintained venue-page contact data

### Medium

- Lemonrock/member-edited profile fields
- unclaimed profile genres/location
- description text

### Weak

- inferred social from unstructured prose
- name-only identity match
- absence from an index
- historical Cowork interpretation

Weak Lemonrock evidence must not overwrite owner-managed/verified BNDY data or stronger source evidence.

---

## 15. Parser architecture

Suggested module shape:

```text
src/sources/lemonrock/
  index.ts
  types.ts
  identity.ts
  urls.ts
  acquisition.ts
  parseNewestGigs.ts
  parseCancelledGigs.ts
  parseArtistIndex.ts
  parseArtistPage.ts
  parseVenueIndex.ts
  parseVenuePage.ts
  parseGigPage.ts
  parseGigFeed.ts
  claims/
    artistClaims.ts
    venueClaims.ts
    eventClaims.ts
  normalize/
    artist.ts
    venue.ts
    event.ts
  authority.ts
  completeness.ts
  fixtures/
  __tests__/
```

Adapters wrap these parsers into the generic Source Runner contract.

---

## 16. Deterministic parsing first

Do not use Claude/Gemini for normal Lemonrock extraction.

Use model/search enrichment only for:

- ambiguous cross-source identity resolution
- unclear free-text social extraction when deterministic parsing fails
- canonical entity enrichment outside the source parser
- exceptional malformed listings

This keeps bootstrap cheap, reproducible, testable, debuggable and resumable.

---

## 17. Bootstrap runtime design

The bootstrap should be a resumable orchestrated job, not one Lambda trying to crawl the country.

```text
Bootstrap seeder / Step Functions if justified
        |
        +--> enumerate artist source keys
        +--> enumerate venue source keys
        +--> enumerate future gig source keys
        |
        +--> durable hydration queues
                 |
                 +--> bounded workers
                 +--> Observations + Claims
                 +--> resolution
                 +--> ProjectionQueue
```

Critical requirements:

- idempotent
- checkpointed
- safe to restart
- source-key dedupe
- queue depth visible
- rate-limited
- no single giant transaction
- no dependency on an interactive agent session

---

## 18. Operational metrics

Expose at source-family level:

```text
artistsDiscovered
artistsHydrated
artistsResolved
artistsProjected
artistsUnresolved
venuesDiscovered
venuesHydrated
venuesResolved
venuesProjected
venuesUnresolved
gigsDiscovered
gigsHydrated
gigsResolved
gigsProjected
gigsHeld
gigsCancelled
claimsCreated
observationsCreated
parseFailures
httpFailures
rateLimitedRequests
identityConflicts
projectionFailures
lastFastScanAt
lastDirectoryScanAt
lastFullReconcileAt
```

Also capture queue depth, oldest outstanding hydration item, average latency, source completeness and last successful acquisition.

---

## 19. Backline Explorer integration

Lemonrock should be the first flagship source shown in Backline Explorer.

### Lemonrock source dashboard

Show discovered/resolved/projected/unresolved Artist, Venue and Gig counts; conflicts; cancellations; scan timestamps; queue depth and failures.

### Entity view

Search any Artist/Venue/Gig and show:

- canonical BNDY entity if resolved
- Lemonrock source identity
- other source identities
- Claims grouped by predicate
- supporting/conflicting Claims
- confidence / authority
- Observation history
- raw evidence
- projection decision

### Graph view

Obsidian-style graph with nodes for BNDY entities, Lemonrock source entities, Source, Observation, Claim and Festival.

Edges include:

```text
sourceIdentityOf
performedBy
heldAt
supports
observedIn
conflictsWith
projectedAs
partOfFestival
```

Default graph should collapse Claim/Observation noise until expanded.

---

## 20. Testing strategy

Capture representative real fixtures covering rich/sparse/claimed/unclaimed artists and venues, socials, multi-genres, paid/free/TBC gigs, festivals, supports, multi-act gigs, cancellations, sold-out state, time edge cases and Unicode.

Unit-test parsing, identities, date/time normalization, multi-value fields, URL classification, source relationships, cancellation semantics, completeness, dedupe and Claim generation.

Integration-test Source Runner -> Observation -> Claims -> ProjectionWorkItem; existing/safe-new/ambiguous entity resolution; explicit cancellation; and legacy Cowork matching.

Before mutation run a national live shadow test that produces counts, parser errors and random samples and proves no catastrophic aliasing or false cancellation.

---

## 21. Deployment / cutover gates

1. **Acquisition:** enumerate the complete national source set reliably.
2. **Parsing:** representative fixtures/live samples are correct and rich.
3. **Evidence:** every object creates immutable evidence + Observation.
4. **Claims:** atomised Claims are correct/queryable.
5. **Source identity:** stable keys are deterministic.
6. **Resolution:** existing BNDY records matched conservatively; ambiguity held.
7. **National shadow bootstrap:** full bootstrap with zero canonical mutation; review counts/failures/unresolved/duplicates/conflicts.
8. **Controlled projection:** enable bounded safe cohort and read back.
9. **National projection:** enable policy-approved resolved identities nationally.
10. **Scheduled operation:** fast feeds + adaptive reconciliation + directory diff + weekly completeness sweep.

---

## 22. Bootstrap execution order

1. implement source identity + URL parser utilities
2. implement artist index
3. implement venue index
4. implement newest-gig parser
5. implement gig detail parser
6. implement artist detail parser
7. implement venue detail parser
8. implement explicit cancellation parsing
9. add Claim emitters
10. add Source Registry entries
11. add resumable bootstrap seeder
12. run fixture suite
13. run national enumeration only
14. inspect counts
15. run national hydration in shadow
16. inspect parse/error metrics
17. build initial Backline Explorer Lemonrock source dashboard
18. run canonical resolution in shadow
19. reconcile legacy Cowork imports
20. enable bounded safe projection
21. verify canonical read-back
22. expand to national projection
23. enable recurring schedules
24. watch first 24h of scheduled operation

---

## 23. First bootstrap acceptance criteria

The first national bootstrap succeeds when:

- every discoverable Lemonrock artist source identity has been enumerated
- every discoverable Lemonrock venue source identity has been enumerated
- every discoverable current/future Lemonrock gig source identity has been enumerated
- rich Artist/Venue pages have been hydrated or are explicitly queued/retryable
- all acquired pages have immutable evidence
- parsed source facts exist as Claims
- no entity is silently discarded because it cannot be resolved
- no ambiguous name-only match causes canonical data creation
- existing BNDY records are reused where confidently matched
- poor historic Cowork Lemonrock imports are classified for repair
- explicit Lemonrock cancellations are represented as cancellation Claims
- national run metrics are available
- Backline Explorer can visibly demonstrate Lemonrock -> source identity -> Claims -> canonical BNDY

---

## 24. Quality principles

1. **Completeness before projection.**
2. **Evidence before assertion.**
3. **Source identity before canonical identity.**
4. **Richness is retained.** Bio, genres, socials, profile state, contact detail and descriptive text belong in Backline.
5. **No source disappearance equals cancellation by default.**
6. **Canonical BNDY remains the product write authority.**
7. **Owner/verified BNDY data is protected from lower-authority source writes.**
8. **No LLM in the hot path where deterministic parsing works.**
9. **Bootstrap must be resumable.**
10. **Every unresolved object remains visible and actionable.**

---

## 25. Source-specific risks

### Blocking / rate limiting

Use low bounded concurrency, adaptive delay, exponential backoff, no burst crawling, monitor 403/429 and prefer index/feed endpoints over redundant page loads.

### HTML structure changes

Use structural parser tests, captured fixtures, completeness checks, zero-row guards, parser versioning and alert on extraction collapse.

### Skeleton / unclaimed profiles

Preserve claimed/maintained state and never promote sparse skeleton data above stronger sources.

### Duplicate names

Use source-native IDs first, then postcode/social/website/location corroboration; hold ambiguity.

### Existing bad canonical data

Use reconciliation mode, no destructive auto-fix without authority, and Explorer conflict review.

### CSV/iCal restrictions

Treat them as optional optimisations; test from deployed AWS and do not make bootstrap dependent on them.

---

## 26. Suggested implementation PR sequence

### LR-01 — Lemonrock foundation

- source family types
- stable identity utilities
- URL classification
- fixtures
- source config
- tests

### LR-02 — National enumeration

- artist index
- venue index
- national/current gig enumeration
- source-key queues
- completeness report

### LR-03 — Rich Artist/Venue hydration

- artist page parser
- venue page parser
- socials
- genres
- bio
- location
- source metadata
- Claims

### LR-04 — Gig + cancellation ingestion

- newest gigs
- gig detail
- festival/support relationships
- cancellations
- event Claims

### LR-05 — Resumable national bootstrap

- durable fan-out
- progress/checkpoints
- retry/backoff
- metrics
- shadow mode

### LR-06 — Identity resolution + legacy repair

- source identity -> canonical mapping
- Cowork import reconciliation
- conflict classifications
- held/unresolved states

### LR-07 — Controlled projection

- Lemonrock authority policy
- canonical safe projection
- read-back
- cancellation handling

### LR-08 — Continuous operation

- fast feed schedules
- adaptive future-event reconciliation
- artist/venue directory diff
- weekly full completeness sweep

### LR-09 — Backline Explorer Lemonrock view

- source dashboard
- entity search
- Claims/evidence panel
- Obsidian-style graph view

---

## 27. Immediate build target

The first development target is not a regional proof:

> **A national Lemonrock bootstrap running in Backline shadow mode, ingesting source-native Artist, Venue and Gig identities plus the richest deterministic profile/event data available, with no canonical mutation until the national evidence set and resolution quality are inspectable.**

Once the shadow bootstrap is healthy, projection can be enabled without repeating the source crawl.

---

## 28. Definition of done

Lemonrock is fully implemented as a Backline source when:

- national bootstrap is complete and repeatable
- new Lemonrock gigs enter Backline automatically
- new Lemonrock artists enter Backline automatically
- new Lemonrock venues enter Backline automatically
- artist/venue profile changes are eventually reconciled
- event changes are reconciled
- explicit cancellations are acted on safely
- rich Lemonrock metadata is preserved
- unresolved identities remain inspectable
- safe identities project to canonical BNDY
- legacy Cowork imports are reconciled
- source health and coverage are visible
- Backline Explorer can explain every Lemonrock-derived canonical decision
- the system runs unattended from AWS

---

## 29. External Lemonrock references used during planning

- Newly Posted Gigs: https://www.lemonrock.com/newestgigs.php
- Example artist page with genres/profile fields: https://www.lemonrock.com/extractor
- Example artist page with rich bio and contact fields: https://www.lemonrock.com/nitetrain2
- Example artist page with Facebook in Web field: https://www.lemonrock.com/theremastered
- Example gig feed / CSV / iCalendar exposure: https://www.lemonrock.com/userfriendly?page=gigs
- Example venue gig feed / CSV / iCalendar exposure: https://www.lemonrock.com/boxofficeloungetorquay?page=gigs
- Lemonrock FAQs / access-key note / source creation behaviour: https://www.lemonrock.com/faqs.php

---

## 30. Next action

LR-01 to LR-05 have progressed into the deployed shadow ingestion runtime. Execution now follows the owned completion control in section 31: recover remaining work, deploy and run the full reconciliation, prove completeness, then verify recurring diffs.

## 31. Owned completion execution control

**Execution status:** Active until the completion gate below is satisfied.  
**Delivery owner:** Backline delivery workstream.  
**Current truth source:** live AWS state, with sanitised aggregate evidence recorded by the repository audit.  
**Current gate:** incomplete. Evidence exists at national scale, but completeness has not yet been proven by a successful full reconciliation.

This section turns LR-01 to LR-09 into a completion-controlled production run. It does not replace the architecture or implementation sections above.


### 31.0 Live execution checkpoint

Authoritative audit: `2026-08-24T18:53:51Z`.

| Control | Live result |
|---|---:|
| Lemonrock Observations | 4,050 |
| Lemonrock Claims | 34,618 |
| Lemonrock Resolutions | 0 |
| Current logical tasks | 2,663 |
| Completed tasks | 2,662 |
| Failed tasks | 1 |
| Source queue visible / in-flight | 0 / 0 |
| Dead-letter queue visible | 2 |
| Full-reconcile Observations | 0 |

At this historical checkpoint the weekly rule still targeted the Artist and Venue index sources directly. That bootstrap configuration is replaced after completion by the low-cost gig-led model in section 12: hourly new/cancellation feeds, a one-page daily health check, monthly future-gig reconciliation and no recurring Artist/Venue directory crawl. The completion runtime carries a single reconciliation ID through all fan-out levels, records deduped identities as discovered by the current run, verifies the national Artist/Venue/Gig branches, recovers source-scan dead letters, and refuses to mark completion unless the queues are clear and all discovered tasks are terminal.

**Execution action:** deploy this revision, recover the two dead-letter messages, start the immediate national reconciliation, and publish the sanitised reconciliation manifest.

**Latest execution attempt:** GitHub Actions run [32766907880](https://github.com/flowency-live/bndy-enrichment/actions/runs/32766907880) stopped before any AWS mutation because the `production` environment does not yet contain `AWS_DEPLOY_ROLE_ARN`. CI run [32766907999](https://github.com/flowency-live/bndy-enrichment/actions/runs/32766907999) passed. The read-only audit role remains separate and operational.

### 31.1 Completion claim

“Lemonrock is fully ingested into Backline” may be stated only when all of the following are true for a named snapshot and timestamp:

- national Artist, Venue and current/future Gig enumeration completed;
- every enumerated source-native identity has a terminal disposition;
- retry-pending, queued and running bootstrap work are zero;
- failed work and dead-letter work are zero after recovery;
- every successfully acquired object has immutable evidence, an Observation and atomised Claims;
- no source-native object was discarded because canonical identity was uncertain;
- unresolved and conflicting identities remain durable and inspectable;
- a full national reconciliation completed after bootstrap recovery;
- the final completeness manifest reconciles enumeration, hydration, Observation, Claim and evidence totals;
- the recurring schedules below exist in deployed AWS and have completed at least one successful execution;
- canonical writes remain disabled unless separately approved through the projection gates.

A terminal disposition is one of:

- `hydrated`: evidence, Observation and Claims exist;
- `source-withdrawn`: the identity was enumerated but the source now explicitly reports it absent/unavailable, with evidence;
- `unresolved`: source data is fully retained but no canonical BNDY identity is yet safe;
- `conflicted`: source data is fully retained and competing identity evidence requires later resolution.

`retry-pending`, `failed` and unexplained `missing` are not completion states.

### 31.2 Execution stages

#### Stage A — recover the bootstrap

- classify every failed task by source and task kind;
- fix the underlying acquisition, parsing or persistence defect;
- replay only the affected idempotent work;
- reconcile duplicate task-history rows to the current logical task inventory;
- finish with no failed or dead-letter work.

**Gate A:** every enumerated task has a valid terminal disposition and the active queues are drained.

#### Stage B — deploy full national reconciliation

- attach `lemonrock-full-reconcile` to the deployed weekly completeness rule;
- verify the deployed target, not only the CDK source;
- run an immediate full reconciliation after bootstrap recovery;
- record a completeness manifest containing discovered identities, hydrated identities, missing identities, terminal dispositions and evidence/Observation/Claim totals;
- enqueue and recover any gaps found by the reconciliation;
- run the final reconciliation again after gap recovery.

**Gate B:** the final full-reconcile manifest contains zero unexplained missing identities and zero pending recovery work.

#### Stage C — prove Backline integrity

For Artist, Venue and Gig separately, verify:

```text
enumerated source identities
= hydrated
+ explicitly source-withdrawn
+ unresolved
+ conflicted
```

Additionally verify:

- every hydrated identity has at least one current Observation;
- every current Observation has immutable evidence;
- expected semantic/source Claims are present;
- source-native keys are stable and unique;
- no ambiguous name-only match created canonical data;
- the canonical BNDY baseline remains unchanged by the shadow ingestion.

**Gate C:** a reproducible, sanitised completion report passes all invariants.

#### Stage D — verify recurring diffs

The deployed operating model must include:

| Loop | Target cadence | Purpose |
|---|---|---|
| New gigs | hourly | discover newly posted gigs and their attached Artist/Venue identities |
| Explicit cancellations | hourly | retain explicit cancellation evidence |
| Future-source health | daily | prove the national future-gig root is reachable and structurally recognisable without fan-out |
| Future-gig reconciliation | monthly | repair silent gaps and refresh future-gig details with monthly logical dedupe |
| Artist profile hydration | gig-triggered | hydrate only Artists referenced by new or reconciled gigs |
| Venue profile hydration | gig-triggered | hydrate only Venues referenced by new or reconciled gigs |
| Full artist/venue directory reconciliation | manual only | exceptional audit/bootstrap repair, never routine ingestion |

Every loop must record:

- last run;
- last successful run;
- last change detected;
- items discovered/changed;
- failures and consecutive failures;
- next due run;
- source health;
- resulting work and queue outcome.

**Gate D:** every loop is present in deployed AWS and its first scheduled execution completes successfully.

#### Stage E — hand off to the next Backline stage

Once Gates A to D pass:

- mark national Lemonrock ingestion complete on the workboard;
- freeze the successful snapshot/manifest as completion evidence;
- continue recurring diffs;
- hand the corpus to the identity-resolution, Godmode graph and shadow-projection workstreams;
- keep all canonical mass writes disabled until their separate review gates pass.

### 31.3 Execution order

1. Failed-task and dead-letter diagnosis.
2. Idempotent recovery and queue drain.
3. Full-reconcile target deployment.
4. Immediate national reconciliation.
5. Gap hydration/recovery.
6. Final national reconciliation and invariant report.
7. Scheduled-loop verification.
8. Workboard completion update and next-stage handoff.

### 31.4 Reporting rule

Progress reports must distinguish:

- **evidence captured**;
- **identity hydrated**;
- **identity resolved**;
- **projection proposed**;
- **projection applied**.

Large Observation or Claim totals alone do not prove national completeness. Only the reconciliation manifest and the gates above can support the completion claim.

## 32. Fresh national verification contract

The historical bootstrap and the low-cost steady state answer different questions. A drained queue proves that previously discovered work finished. It does not prove that the current national source inventory was completely enumerated.

The owned national verification therefore performs one fresh, rate-limited, shadow-only reconciliation with these boundaries:

- traverse every current future-gig county, town and dated listing branch;
- fetch every unique future gig discovered in that reconciliation;
- hydrate only Artist and Venue profiles referenced by those gigs;
- enumerate all Artist and Venue directory pages as inventory controls;
- count directory identities without hydrating dormant directory members;
- include the current new-gig and explicit-cancellation feeds;
- scope every audit task to the owned reconciliation so BAU time-bucket dedupe cannot hide stale work;
- leave canonical writes disabled;
- never redrive a pre-existing DLQ automatically.

The launch workflow requires the source queue and DLQ to be empty before it starts. If either contains work, the verification stops at preflight and publishes a sanitised blocked status for diagnosis.

Completion requires:

1. every audit task terminal with no failed tasks;
2. all required source branches seen;
3. all 28 Artist and 28 Venue directory controls present;
4. observed directory identities meeting or exceeding the advertised controls;
5. unique future-gig identities meeting or exceeding Lemonrock's advertised county total;
6. every gig-linked Artist and Venue hydration task terminal;
7. main queue and DLQ clear;
8. shadow mode still enabled and canonical writes still disabled.

While the verification is active, the hourly monitor dispatches a fresh sanitised manifest. It stops requesting AWS manifests once the run is complete or reaches an attention state. The temporary hourly monitor schedule should be removed after the verification closes.
