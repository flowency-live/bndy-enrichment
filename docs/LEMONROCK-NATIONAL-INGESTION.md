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

Cadence target: **every 10–15 minutes**.

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

### Fast loop — every 10 to 15 minutes

Scan:

- newest gigs
- explicit cancellations

Purpose:

- new gig discovery
- new artist discovery
- new venue discovery
- explicit cancellation

### Rolling future-gig reconciliation

Suggested adaptive cadence:

- >90 days away: every 7 days
- 30–90 days: every 3 days
- 7–30 days: daily
- 1–7 days: every 6–12 hours
- event day: every 2–4 hours

Detect date/time/venue/lineup/admission/ticketing/status/description changes.

### Artist directory diff

Daily or twice daily: enumerate, compare source keys, enqueue new identities, and periodically rehydrate stale/updated artists.

### Venue directory diff

Same pattern as artist directory.

### Full national reconciliation

Weekly: re-enumerate national indexes, compare counts/identities, detect silent drift, emit completeness report.

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

Begin **LR-01 + LR-02** in `bndy-enrichment`:

1. inspect current SourceAdapter/runtime contracts on `main`
2. add Lemonrock source family foundation
3. capture real production fixtures
4. implement national enumeration
5. run locally in zero-write mode
6. produce first national counts
7. then wire durable bootstrap queues and start the shadow bootstrap
