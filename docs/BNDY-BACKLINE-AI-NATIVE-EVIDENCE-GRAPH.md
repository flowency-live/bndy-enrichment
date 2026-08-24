# BNDY Backline: An AI-Native Evidence Graph for Grassroots Live Music

**Status:** Position paper  
**Date:** 24 August 2026  
**Audience:** Cultural funders, music-sector partners, technologists, cloud architects, AI practitioners and potential strategic partners  
**Primary implementation:** `flowency-live/bndy-enrichment`  
**Related architecture:** `docs/TARGET-ARCHITECTURE.md`, `docs/BUILD-PLAN.md`, `docs/LEMONROCK-NATIONAL-INGESTION.md`

---

## Executive summary

Most gig-discovery systems are databases of listings.

They collect an event, turn it into a row, show it to a user and eventually delete or expire it. In that model, the system usually retains very little understanding of **why** it believes a listing is correct, **where** each piece of information came from, **which sources agree or disagree**, or **how identities discovered in different places relate to one another**.

BNDY is taking a different approach.

> **BNDY is building a continuously learning model of the grassroots live-music ecosystem.**

At the centre of that approach is **BNDY Backline**: an AI-native evidence graph that stores observations, source-native identities, claims, relationships, provenance, confidence, authority and conflicts before projecting the best-supported current view into the public BNDY product.

The core principle is simple:

> **Sources do not create truth. Sources create evidence and claims. BNDY derives its current view from the evidence it holds.**

That distinction changes the architecture fundamentally.

A Lemonrock page, a venue website, a Facebook event, a poster, a WhatsApp submission, a community curator and an artist-owned profile can all describe the same real-world gig. Instead of allowing the last source to overwrite the database, Backline preserves those statements independently, links them to their evidence, resolves the entities they refer to and decides what should be projected into BNDY according to explicit authority rules.

The public Artist, Venue and Event records therefore become **materialised product projections of what BNDY currently believes**, rather than the only surviving representation of knowledge.

This is not a claim that BNDY invented knowledge graphs, event sourcing, graph databases, provenance or retrieval-augmented generation. Those ideas have long histories. The innovation is in their **combination and application to a messy, constantly changing real-world cultural ecosystem**, at a point when modern AI systems can finally exploit that structure effectively.

BNDY is therefore not simply adding AI features to a traditional gig database. It is designing the underlying data model so that deterministic software, human curators and AI agents can all work against the same evidence-based substrate.

That creates three complementary propositions:

1. **For audiences and the grassroots music sector:** better discovery, broader coverage and fewer missing or stale listings.
2. **For cultural funders:** durable digital infrastructure that can strengthen audience development, sector resilience, regional visibility and knowledge about grassroots live music.
3. **For technology partners:** a live, bounded, socially useful proving ground for evidence-grounded agentic AI, graph reasoning, entity resolution and low-cost serverless data infrastructure.

These are different conversations built on the same underlying model. The core of this paper explains the shared proposition; later sections deliberately translate it into the language of the music sector, cultural funding and technology partnership rather than assuming those audiences value the same details.

There is also a compounding strategic effect. Every observation retained today becomes historical context tomorrow. Over time Backline accumulates not only listings, but resolved identities, changes, cancellations, disagreements, source behaviour and relationship history. Another system can inspect the same public sources in future; it cannot instantly recreate years of reconciled historical evidence that was observed as the ecosystem changed. The usefulness of the substrate therefore compounds as BNDY operates.

---

# Part I — The non-technical explanation

## 1. The problem BNDY is trying to solve

Grassroots live music is unusually difficult to map.

A large concert promoted by a national ticketing company is relatively easy to discover. A local pub gig is not.

The information may exist only as:

- a Facebook event;
- a venue Facebook post;
- an artist's social account;
- a gig poster;
- a photograph of a chalkboard;
- a venue website;
- a regional listings site;
- Lemonrock;
- a community-maintained calendar;
- a WhatsApp message;
- a promoter announcement;
- a ticketing page;
- or knowledge held by somebody in the local scene.

Different sources frequently disagree. They may use different names for the same artist or venue. Times change. Gigs move. Events are cancelled. One source may be maintained by the artist while another is an aggregator that copied an older version.

A conventional aggregation system has two bad choices:

1. reject uncertain data and miss large parts of the grassroots ecosystem; or
2. import aggressively and gradually fill the product database with duplicates, stale information and poorly resolved identities.

BNDY has encountered this problem directly. That experience led to Backline.

---

## 2. From a listings database to a learning system

A conventional system might work like this:

```text
Website / social post
        ↓
      scraper
        ↓
      parser
        ↓
 Artist + Venue + Gig records
        ↓
      website
```

Once the records have been created, much of the reasoning that produced them has disappeared.

Backline instead works like this:

```text
Source
   ↓
Immutable evidence
   ↓
Observation
   ↓
Source-native identity
   ↓
Atomised claims
   ↓
Relationships, confidence, authority and conflicts
   ↓
Identity resolution
   ↓
Current BNDY projection
```

The distinction matters because **uncertainty is no longer a failure state**.

If Lemonrock contains an artist that BNDY cannot yet confidently match to an existing Artist, Backline does not have to throw that information away or create a questionable duplicate. It can retain:

- the Lemonrock Artist identity;
- the original page;
- the artist name;
- genres;
- biography;
- location;
- social URLs;
- gigs associated with that artist;
- and the unresolved relationship to possible BNDY Artists.

Later, another source may supply the missing evidence required to make the identity clear.

The system gets smarter without having to forget what it saw previously.

---

## 3. A simple real-world example

Imagine three sources describe the same upcoming gig.

**Lemonrock says:**

- The Torrists
- The Rigger
- 12 September
- 9pm

**Facebook says:**

- The Torrists
- The Rigger
- 12 September
- 9pm

**The venue website says:**

- The Torrists
- The Rigger
- 12 September
- 9:30pm

A conventional system may simply contain:

```text
startTime = 21:30
```

The history is lost.

Backline can retain the more useful representation:

```text
Claim 1
Lemonrock says startTime = 21:00
Evidence: Lemonrock gig page
Observed: 22 Aug

Claim 2
Facebook says startTime = 21:00
Evidence: Facebook Event
Observed: 23 Aug

Claim 3
Venue website says startTime = 21:30
Evidence: official venue listing
Observed: 24 Aug
```

A policy can then decide that the venue's own current listing has stronger authority for the start time and project 21:30 into BNDY.

Crucially, the other claims have not been deleted.

BNDY can explain **what it believes, why it believes it and what evidence disagreed**.

---

## 4. The important idea: BNDY keeps the evidence behind its current view

This is the conceptual shift behind Backline.

A traditional application database tends to say:

> This is the value.

Backline can say:

> These are the observations. These are the claims made by different sources. These appear to refer to the same real-world thing. This is the current best-supported conclusion, and this is the evidence behind it.

Internally, this can be thought of as a system that stores and revises beliefs. For external audiences, **best-supported current view** is usually the clearer description. The important point is not the philosophical terminology: Backline preserves the evidence, uncertainty and decision path behind the current product state.

Information changes. Sources conflict. Identity can be uncertain. New evidence arrives.

Backline allows BNDY to **change its mind without rewriting history**.

---

# Part II — Why this becomes especially important in the AI era

## 5. Knowledge graphs are not new

Knowledge graphs are not a new invention.

Organisations have represented people, places, products, documents and other entities as connected graphs for decades. Graph databases and semantic technologies existed long before modern generative AI.

BNDY therefore should not claim that the graph itself is groundbreaking.

What has changed is the usefulness of a graph as an **operating substrate for modern AI**.

Large language models are powerful at interpreting unstructured information and reasoning across context, but their reliability improves when they are grounded in durable evidence rather than asked to invent or remember facts internally.

Simple retrieval-augmented generation, or RAG, usually retrieves chunks of text that appear semantically similar to a question. That works well for many document problems, but relationships may remain implicit.

GraphRAG and related approaches combine semantic retrieval with explicit relationships between entities. AWS now offers GraphRAG through Amazon Bedrock Knowledge Bases and Amazon Neptune Analytics, describing the benefit as improved retrieval across connected information and multiple logical steps. Microsoft and other researchers have developed similar graph-based retrieval approaches.

The significance for BNDY is that Backline is being structured for connected reasoning **before** an AI assistant is placed on top of it.

The AI is not the database and the model is not the truth.

The durable evidence is.

---

## 6. Why Backline is AI-native rather than merely AI-enabled

An application is **AI-enabled** when an existing product adds a chatbot, summarisation feature or model call.

Backline is intended to be **AI-native** in a deeper sense: the information architecture is designed around the kinds of ambiguity, evidence gathering and iterative reasoning that AI agents are good at handling.

### 6.1 The system preserves ambiguity

Traditional systems prefer a binary answer:

```text
artistId = 123
```

or failure.

Backline can retain competing hypotheses:

```text
Lemonrock Artist X

possible identity:
BNDY Artist 123     strong evidence
BNDY Artist 681     weak evidence

status: unresolved
```

An AI agent can gather more evidence before committing the relationship.

### 6.2 The system preserves provenance

An AI agent should be able to answer:

> Where did this fact come from?

Backline can point to the exact Observation and evidence supporting a Claim.

### 6.3 The system preserves disagreement

Conflicts are first-class information rather than a database corruption problem.

### 6.4 The system separates observation from inference

A source may explicitly state that an artist is based in Manchester. That is an observation-backed Claim.

An AI agent may infer that two artist identities probably refer to the same act. That is a Resolution or inference, not the original evidence.

Keeping those concepts separate is vital for trustworthy automation.

### 6.5 The system can support iterative agent behaviour

A future Backline agent can reason like this:

```text
I have found a new Lemonrock Artist.

There is an existing BNDY Artist with the same name.
Their Facebook URLs differ.
Their locations overlap.
They share three venues.

I do not yet have enough evidence.

→ inspect official website
→ inspect recent Facebook evidence
→ examine aliases
→ compare gig history
→ resolve, or remain unresolved
```

This is very different from calling an LLM once and accepting its answer.

It is evidence-seeking, tool-using, **agentic reasoning**.

---

## 7. More than a conventional knowledge graph: an evidence graph

A basic entity graph might contain:

```text
The Torrists ──PLAY_AT──> The Rigger
```

Backline can represent a richer structure:

```text
Lemonrock
    ↓ observed
Lemonrock Gig 970838
    ↓ claims performer
Lemonrock Artist "The Torrists"
    ↓ resolved as
BNDY Artist 123

Lemonrock Gig 970838
    ↓ claims venue
Lemonrock Venue "The Rigger"
    ↓ resolved as
BNDY Venue 456
```

The relationship itself is therefore traceable to evidence.

That makes Backline better described as an **evidence graph** or **epistemic graph**: a graph concerned not only with facts, but with the basis on which those facts are believed.

This becomes particularly valuable as more system changes are performed autonomously by software agents.

---

# Part III — What is genuinely innovative about the BNDY approach

## 8. The novelty is the composition

None of the individual ideas below is unprecedented:

- knowledge graphs;
- immutable evidence;
- event-sourced thinking;
- source provenance;
- confidence scoring;
- entity resolution;
- materialised views;
- deterministic parsing;
- graph reasoning;
- RAG;
- GraphRAG;
- multimodal AI;
- autonomous agents.

The unusual part is combining them into a single operating model for a real-world grassroots cultural ecosystem.

The BNDY model can be summarised as:

> **Continuous real-world discovery + immutable evidence + atomised claims + source-native identity + uncertainty-preserving resolution + predicate-specific authority + controlled projection + agentic AI.**

That combination creates capabilities that are difficult to build on top of a conventional listings database later.

---

## 9. Continuous reconciliation rather than periodic scraping

The objective is not merely to scrape a source once.

Backline continuously observes the ecosystem and reconciles change.

For example, the Lemonrock implementation is designed to combine:

- national bootstrap discovery;
- rapid new-gig feeds;
- cancellation feeds;
- artist and venue directory reconciliation;
- rich profile hydration;
- known-future-gig rechecking;
- historical evidence;
- and canonical identity resolution.

A gig can therefore move through a lifecycle of beliefs rather than being imported once and forgotten.

---

## 10. Source-native identity before canonical identity

Every external object first exists as itself.

For example:

```text
lemonrock:artist:<source-id>
lemonrock:venue:<source-id>
lemonrock:gig:<source-id>
```

Only then does BNDY attempt to resolve that source identity onto the real-world Artist, Venue or Event represented in the public product.

This prevents a common aggregation error: forcing uncertain source data into the canonical database too early.

---

## 11. Predicate-specific authority

Not every source is equally trustworthy for every kind of statement.

An artist may be the strongest authority on its own biography.

A venue may be the strongest authority on tonight's start time.

A ticketing provider may be a strong authority for ticket status.

A community listings service may be excellent for discovery but weaker evidence of cancellation.

Backline therefore does not need a single simplistic ranking of sources. Authority can be assessed at the level of the Claim being made.

This makes the system both safer and more expressive.

---

## 12. The product database becomes a projection

This is one of the most important architectural decisions.

The canonical BNDY Artist, Venue and Event APIs remain the product write boundary, but the durable knowledge substrate sits behind them.

Conceptually:

```text
BACKLINE KNOWLEDGE
Evidence
Observations
Claims
Resolutions
Authority
Tombstones
Relationships
        ↓
     projection
        ↓
BNDY PRODUCT STATE
Artists
Venues
Events
Festivals
```

The product stays fast and simple for users.

The complexity required to understand the real world lives behind it.

---

## 13. Multimodal evidence enters the same model

The long-term importance of Backline is not Lemonrock specifically.

The same evidence model can accept:

- deterministic HTML;
- structured feeds;
- Facebook pages and events;
- posters interpreted by multimodal models;
- photographs;
- WhatsApp submissions;
- Messenger submissions;
- emails;
- venue calendars;
- community submissions;
- artist submissions;
- curator edits;
- ticketing feeds;
- search-discovered evidence.

Different acquisition techniques can therefore converge on one knowledge model.

```text
HTML parser ─────┐
Facebook ────────┤
Poster AI ───────┤
WhatsApp ────────┤
Curator ─────────┤──> Evidence → Claims → Backline
Artist input ────┤
Venue website ───┤
Ticketing ───────┘
```

The intelligence is not trapped inside whichever tool collected the information.

---

## 14. Explainability is architectural, not cosmetic

If BNDY is asked:

> Why do you think this gig exists?

Backline should eventually be able to answer with the evidence chain.

If asked:

> Why did this time change?

Backline can show the newer higher-authority Claim.

If asked:

> Why did BNDY decide these two artist pages refer to the same band?

Backline can expose the resolution evidence.

This is increasingly important as AI takes on more autonomous responsibilities.

Explainability is therefore not a dashboard added after the fact. It is a consequence of preserving provenance from the beginning.

---

# Part IV — What BNDY can learn that no source explicitly states

## 15. Derived knowledge

Once enough relationships and history exist, BNDY can infer patterns that were never explicitly published by any source.

Examples could include:

- a venue is becoming strongly associated with a particular genre;
- an artist's geographic reach is expanding;
- a group of artists and venues form a distinctive local scene;
- a venue appears to have stopped programming live music;
- one promoter is a major connective hub in a region;
- a town's grassroots circuit is growing or shrinking;
- an artist identity is probably an alias or renamed act;
- a venue typically announces gigs a particular number of days in advance;
- one source is reliable for dates but poor at recording cancellations;
- a recurring relationship exists between a group of artists and venues;
- an area has significant grassroots activity but very weak commercial ticketing coverage.

These are not scraped facts.

They are **derived knowledge created from the structure and history of the evidence graph**.

That is where Backline can become strategically useful beyond the BNDY consumer application.

---

## 16. A potential cultural observatory

Over time, an appropriately governed and aggregated version of Backline could become a form of live cultural observatory.

It could help answer questions such as:

- Where is grassroots live-music activity increasing?
- Which areas have active artists but few venues?
- Which venues provide unusually important opportunities for emerging acts?
- How far do artists travel to perform?
- Which local scenes are interconnected?
- Where does free-to-attend live music remain particularly important?
- Where do commercial ticketing datasets systematically under-represent activity?
- What happens to local live-music activity when a venue closes?

Any use of this capability would require suitable privacy, governance and methodological controls. The underlying opportunity, however, is significant: BNDY could produce evidence about grassroots cultural activity that is currently fragmented across thousands of ephemeral web pages and social posts.

### 16.1 The compounding data asset

Backline's value can compound with time in a way that a conventional listings database does not.

Each cycle through the ecosystem adds observations, identity evidence, changes and relationships. Those improve later resolution and interpretation, which in turn improve the quality and coverage of the public product.

Conceptually, the flywheel is:

```text
more observation
      ↓
richer evidence
      ↓
better identity resolution
      ↓
better projections and derived knowledge
      ↓
wider coverage, participation and trust
      ↓
more observation
```

Historical evidence has particular value because it cannot always be recreated retrospectively. Social posts disappear, websites change, venues close, artists rename themselves and event pages expire. A future competitor may be able to copy a user interface, reproduce a source adapter or inspect the same sources that remain available. It cannot instantly reproduce the sequence of observations, reconciliations and relationships that Backline has accumulated while those changes were happening.

This should not be described as an unassailable moat. Source access, software patterns and AI models can all be copied. The defensibility comes from the **depth of historical evidence, resolved identity graph, learned source behaviour, participation and accumulated trust** built over time.

---

# Part V — Technical architecture

## 17. Current strategic stack

The strategic Backline runtime is `bndy-enrichment`.

It is deliberately serverless and low-cost.

Current architecture and build plans use:

| Layer | Technology / approach |
|---|---|
| Primary language | TypeScript |
| Runtime | Node.js 22 |
| Infrastructure as code | AWS CDK v2 |
| Compute | AWS Lambda |
| Work orchestration | Amazon SQS |
| Scheduling | Amazon EventBridge |
| Durable knowledge/state | Amazon DynamoDB |
| Immutable/raw evidence | Amazon S3 |
| Secrets | AWS Secrets Manager |
| Validation | Zod |
| Tests | Vitest |
| CI/CD | GitHub Actions + existing deployment workflows |
| Public product write boundary | Canonical BNDY APIs |
| Browser acquisition when unavoidable | Chromium / Puppeteer-compatible runtime |
| Deterministic acquisition | HTTP-first source adapters |
| AI/model layer | Model abstraction, currently including Gemini in existing enrichment paths; Bedrock-compatible evolution is architecturally possible |
| Admin/inspection surface | BNDY Backstage / Godmode |

The core strategic flow is:

```text
Source Registry
      ↓
EventBridge dispatcher
      ↓
SQS source queues
      ↓
Source workers
      ↓
S3 immutable evidence
      ↓
DynamoDB Observations + Claims
      ↓
resolution / authority / conflict policy
      ↓
ProjectionQueue
      ↓
ProjectionWorker
      ↓
canonical BNDY APIs
      ↓
Artist / Venue / Event product records
```

The architecture deliberately avoids making a graph database the initial system of record.

Backline currently stores graph-shaped durable knowledge using S3 and DynamoDB because those services are inexpensive, operationally simple and already fit the required write patterns.

A future graph database may become a derived projection/index if query patterns justify it.

That is an important distinction: **the semantics of Backline do not depend on buying a graph database.**

---

## 18. The data model

At the conceptual level Backline separates several things that traditional systems often collapse together.

### Evidence

The original acquired source material.

Examples:

- HTML page;
- JSON response;
- poster image;
- social URL and captured representation;
- submitted text.

Evidence is preserved so later decisions can be audited or reprocessed.

### Observation

A record that BNDY observed a source at a particular point in time.

### Claim

One atomic assertion derived from an Observation.

Examples:

```text
artist.name = "The Torrists"
artist.facebookUrl = "..."
event.date = "2026-09-12"
event.startTime = "21:00"
event.venue = lemonrock:venue:...
event.status = "cancelled"
```

### Source-native identity

The identity of the object in the source system itself.

### Resolution

The conclusion that one or more source-native identities refer to a canonical real-world BNDY entity.

### Authority

The policy determining how strongly a Claim should influence the product projection.

### Tombstone / withdrawal state

Durable knowledge that an Event should not simply be recreated after stronger evidence has cancelled or withdrawn it.

### Projection

The current product representation written through canonical BNDY APIs.

---

## 19. Why DynamoDB and S3 first, graph store later

The first priority is to capture durable knowledge correctly.

S3 is well suited to immutable evidence. DynamoDB is well suited to inexpensive key-addressable observations, claims, source state and indexes.

This gives BNDY:

- very low idle cost;
- serverless scaling;
- durable evidence;
- simple operational behaviour;
- explicit access patterns;
- independence from a particular graph database product.

The graph representation can then be generated from the authoritative substrate.

This avoids an architectural trap where a technology choice such as Neptune becomes synonymous with the knowledge model itself.

The knowledge model comes first.

---

## 20. Where Amazon Neptune and GraphRAG could fit later

AWS now offers managed GraphRAG capabilities through Amazon Bedrock Knowledge Bases with Amazon Neptune Analytics. AWS describes this approach as combining vector retrieval with graph traversal so connected entities and relationships can improve retrieval and multi-step reasoning.

That is directly relevant to Backline, but it should be considered an **evolution path**, not a requirement for the initial system.

A possible future architecture is:

```text
Authoritative Backline substrate
S3 Evidence + DynamoDB Claims/Observations
                 ↓
        graph projection/index
                 ↓
       Neptune / Neptune Analytics
                 ↓
        graph + vector retrieval
                 ↓
        Bedrock / AI agents
```

This preserves BNDY's most important rule:

> The graph database is an index/projection of durable knowledge unless an explicit future architecture decision changes that authority.

This also creates an interesting AWS partnership discussion: BNDY has a real operational graph with provenance, conflicts and source authority, rather than a synthetic demo graph generated from a static document corpus.

---

## 21. Backline Explorer

The human counterpart to agentic reasoning is **Backline Explorer**, exposed through BNDY Backstage/Godmode.

The target experience is an operational view of the knowledge substrate:

```text
Source
  ↓
Source identity
  ↓
Observation
  ↓
Claims
  ↓
Resolution
  ↓
Canonical BNDY entity
```

For an Artist, Venue or Event, an authorised operator should be able to inspect:

- supporting Claims;
- conflicting Claims;
- source identity;
- confidence;
- authority decisions;
- raw evidence;
- Observation history;
- canonical projection;
- graph neighbourhood.

An Obsidian-style graph view is useful, but the graph must be operational rather than decorative. Selecting a node should explain the evidence and relationships behind it.

---

# Part VI — Why this matters to the grassroots music sector

## 22. The commercial data gap

Commercial event discovery naturally prioritises events with strong structured feeds, ticket inventories and large enough audiences to justify commercial distribution.

Grassroots live music often operates outside that infrastructure.

Many gigs are:

- free entry;
- pay on the door;
- announced only socially;
- organised by very small venues;
- promoted by volunteers;
- created by artists themselves;
- recurring local events;
- or distributed through informal community networks.

These events can be culturally important while remaining digitally almost invisible.

Backline is designed specifically to absorb fragmented evidence rather than requiring every participant in the sector to adopt a single publishing system.

---

## 23. Reducing the burden on artists and venues

The ideal future is not to ask every small venue and artist to maintain yet another platform.

BNDY should increasingly be able to understand information they already publish in the places they already use.

Where direct contribution is practical, BNDY can provide simple submission routes. Where it is not, Backline can discover, reconcile and maintain the information from public evidence.

This can reduce digital administration while increasing discoverability.

---

## 24. Supporting audiences

Better grassroots data can improve:

- local discovery;
- spontaneous attendance;
- awareness of free and low-cost culture;
- discovery of unfamiliar artists;
- discovery outside major city centres;
- visibility for venues that do not have sophisticated digital marketing;
- continuity when event information changes.

The public BNDY experience can remain simple even though the evidence infrastructure behind it is sophisticated.

---

# Part VII — Relevance to cultural funding and Arts Council England

## 25. BNDY as cultural infrastructure, not only a consumer app

For funding purposes, the strongest framing is not that BNDY is building another gig-listing website.

The stronger proposition is:

> **BNDY is building shared digital discovery and knowledge infrastructure for grassroots live music.**

The technology supports cultural outcomes rather than being the outcome itself.

Potential public-value outcomes include:

- widening audiences for grassroots live music;
- increasing visibility for small artists and venues;
- improving discovery of free and low-cost cultural activity;
- reducing reliance on commercial ticketing data as the only representation of live-music activity;
- preserving otherwise ephemeral evidence of local cultural activity;
- supporting experimentation with new technology in the cultural sector;
- creating reusable sector knowledge and learning;
- providing better evidence about the health and connectivity of grassroots scenes;
- strengthening relationships between cultural organisations, communities and the technology sector.

---

## 26. Alignment with Arts Council England themes

Arts Council England's **Let's Create** strategy explicitly discusses innovation, adoption of new technologies and partnerships between cultural organisations and the technology sector. It also recognises the importance of research and development and a willingness to support experimentation.

Current 2026 National Lottery Project Grants guidance includes information for **Digital and technology-based projects**, **Research and development**, and a time-limited priority for **Supporting Grassroots Live Music**.

That does not by itself establish that a particular BNDY application is eligible or will be funded. It does establish a credible strategic context for a proposal that combines:

- grassroots live music;
- audience development;
- digital innovation;
- research and development;
- sector resilience;
- partnership with technology expertise.

A funding case should therefore lead with the cultural need and measurable outcomes, then explain Backline as the enabling infrastructure.

---

## 27. A funder-friendly explanation

A concise funding explanation could read:

> Grassroots live music is poorly represented by commercial event datasets because much of it is free, pay-on-the-door, locally promoted or published only through fragmented social channels. BNDY is developing digital infrastructure that can discover and reconcile that activity without asking every small artist and venue to adopt a new administrative system. Its Backline technology preserves the evidence behind listings, reconciles conflicting sources and creates a continuously improving map of artists, venues and gigs. The public outcome is better discovery and audience reach; the sector outcome is richer, more durable knowledge about grassroots cultural activity.

---

## 28. What a funded R&D programme could prove

A credible cultural R&D programme around Backline could measure:

- increase in discoverable grassroots gigs within selected regions;
- proportion of discovered events absent from mainstream ticketing feeds;
- increase in representation of free/pay-on-door events;
- number of artists and venues gaining discoverability without direct data entry;
- accuracy and freshness of automatically reconciled listings;
- reduction in manual curation effort;
- number of conflicts resolved through multi-source evidence;
- audience discovery/engagement changes;
- geographic coverage and inclusion;
- value of aggregated ecosystem insight to venues, artists, funders and local cultural partners.

This makes the technical R&D testable in cultural terms.

---

# Part VIII — Relevance to AWS and technology partnership

## 29. Why this is an interesting AWS architecture problem

Backline is a useful real-world architecture challenge because it combines several characteristics that are often demonstrated separately:

- graph-shaped knowledge;
- unstructured and structured evidence;
- event-driven serverless ingestion;
- durable provenance;
- high-volume but low-value individual records;
- multimodal AI;
- deterministic parsing;
- entity resolution;
- conflicting sources;
- temporal change;
- agentic reasoning;
- low-cost operation;
- human explainability.

It is also bounded enough to experiment safely while being large and messy enough to expose genuine architectural problems.

---

## 30. Specific AWS conversations worth having

An AWS architecture discussion could explore:

### Serverless economics

How far can Lambda, SQS, EventBridge, DynamoDB and S3 take a continuously reconciled cultural evidence system before graph-specific infrastructure is justified?

### Graph projection

At what scale/query complexity would Neptune or Neptune Analytics materially outperform generated graph views or DynamoDB access patterns?

### GraphRAG

How could Bedrock Knowledge Bases GraphRAG or a custom graph/vector retrieval layer sit above the Backline graph without replacing the authoritative evidence model?

### Agentic AI

How should agents use graph context, retrieval, source tools and explicit policy to gather additional evidence before modifying a canonical projection?

### Explainability

How can a model answer not only *what* BNDY believes but *why*, with citations back to Claim and Observation evidence?

### Multimodal evidence

How should poster images, screenshots, public pages and structured feeds converge into one claim vocabulary?

### Cost governance

How can an architecture capable of national-scale ingestion remain affordable for a grassroots cultural platform?

### Observability

What telemetry best demonstrates confidence, coverage, source health, reconciliation quality and agent behaviour?

---

## 31. A concise AWS architect pitch

> BNDY Backline is a serverless evidence and claim graph for a continuously changing real-world domain. We ingest structured pages, social evidence, posters and community input, retain immutable provenance, atomise each assertion into claims, resolve source identities onto canonical entities and project the best-supported state into the public product. The durable graph is currently S3 + DynamoDB rather than a graph database by design; Neptune/GraphRAG is a potential projection layer when relationship queries justify it. The interesting problem is how to make autonomous AI reason over that evidence, seek corroboration and update beliefs without turning the model itself into the authority.

That is a technically serious proposition without claiming novelty that BNDY does not own.

---

# Part IX — The AI-led development model

## 32. A second innovation: how BNDY itself is being built

Separate from the Backline architecture, BNDY is also an experiment in an AI-led software delivery lifecycle.

The project increasingly uses AI agents for:

- architecture exploration;
- code implementation;
- test generation;
- repository inspection;
- documentation;
- source research;
- data-quality investigation;
- deployment diagnostics;
- operational handoff;
- product design;
- continuous workboard updates.

Humans retain product intent, architectural accountability and high-impact decisions, while agents execute increasingly large bounded work packages.

This matters because Backline is both **built by agentic tooling** and **designed to become an agent-operable system**.

Those are separate innovations but mutually reinforcing ones.

---

# Part X — Claims BNDY can make responsibly

## 33. What not to claim

BNDY should not say:

- "we invented knowledge graphs";
- "we invented GraphRAG";
- "this is the world's first AI event platform";
- "AI guarantees our listings are correct";
- "the graph database is our breakthrough";
- "our model knows the truth".

Those statements are either indefensible or miss the interesting part.

---

## 34. Stronger, defensible claims

### Short public claim

> **Most gig platforms store listings. BNDY is building a continuously learning model of the grassroots live-music ecosystem.**

### Backline definition

> **BNDY Backline is an AI-native evidence graph for grassroots live music. It continuously observes public and community sources, retains the evidence behind each assertion, reconciles conflicting information and projects the best-supported current view into BNDY.**

### Technology claim

> **BNDY combines event-driven evidence capture, claim-level provenance, source-native identity, entity resolution, graph-structured knowledge and agentic AI to maintain a continuously reconciled digital model of a real-world cultural ecosystem.**

### Trust claim

> **The AI is not the source of truth. Backline preserves the evidence and makes automated decisions explainable.**

### Sector claim

> **BNDY is building digital infrastructure for the part of live music that commercial event systems routinely miss.**

### Strategic asset claim

> **Backline becomes more useful as its history deepens: current listings can be copied, but years of reconciled evidence, identity history and source behaviour cannot be recreated instantly.**

### R&D claim

> **The innovation is not the knowledge graph alone; it is making a living evidence graph the operating substrate for autonomous discovery, reconciliation and cultural insight.**

---

# Part XI — Website-ready explainer

## 35. How BNDY knows what's on

Most gig websites store listings.

BNDY is trying to understand the live-music world behind those listings.

A local gig might appear on a venue website, Facebook, Lemonrock, a poster or an artist's own page. Those sources can disagree, change or disappear. Instead of simply copying the latest thing we find into a database, **BNDY Backline keeps the evidence**.

Backline breaks what we observe into small claims:

- this artist has this name;
- this venue is at this address;
- this gig is on this date;
- this source says it starts at 9pm;
- the venue now says it starts at 9:30pm;
- this event has been cancelled.

It also remembers where every claim came from.

That allows BNDY to compare sources, recognise when different pages refer to the same artist or venue, preserve disagreements and change its view when better evidence appears.

The result shown on BNDY is therefore not just the last thing a scraper copied. It is the **best-supported current view** produced from the evidence Backline holds.

AI helps BNDY interpret messy information, discover relationships and investigate uncertainty. But the AI itself is not treated as truth. The original evidence remains underneath every decision.

Over time this means BNDY can learn much more than a list of gigs. It can understand how artists, venues, scenes and places connect, where grassroots music is growing, and which parts of live music are being missed by conventional commercial datasets.

> **Most gig platforms store listings. BNDY is building a continuously learning model of grassroots live music.**

---

# Part XII — Future direction

## 36. Near-term

The current engineering priorities are to make Backline operational at national scale across real sources and expose the knowledge clearly through Backline Explorer.

Important near-term capabilities include:

- national Lemonrock ingestion;
- rich Artist and Venue Claims;
- recurring source reconciliation;
- explicit cancellation handling;
- legacy data repair;
- source-health telemetry;
- graph/entity inspection in Backstage;
- wider migration of BNDY ingestion paths into the shared evidence model.

---

## 37. Medium-term

The next layer is increasingly intelligent reconciliation:

- cross-source identity evidence;
- temporal confidence;
- source reliability learning;
- richer graph inference;
- agent-assisted conflict investigation;
- scene and network analysis;
- funding/sector insight views;
- privacy-safe aggregated analytics.

---

## 38. Long-term

The long-term ambition is larger than event aggregation.

BNDY could become a continuously maintained digital model of grassroots live music in which:

- public discovery becomes more complete;
- artists and venues become easier to find;
- local cultural activity becomes more visible;
- AI agents can investigate and reconcile changes;
- every automated conclusion remains grounded in inspectable evidence;
- historical evidence and resolution quality compound rather than disappearing when listings expire;
- and aggregated knowledge can help the sector understand itself.

That is the direction in which Backline turns BNDY from a gig-listing application into **cultural knowledge infrastructure**.

---

# References and related material

## Internal BNDY architecture

- `docs/TARGET-ARCHITECTURE.md` — authoritative target source reconciliation and knowledge architecture
- `docs/BUILD-PLAN.md` — execution plan for the strategic Backline runtime
- `docs/LEMONROCK-NATIONAL-INGESTION.md` — first national source-family implementation plan

## AWS

- Amazon Bedrock Knowledge Bases: https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html
- Building an Amazon Bedrock Knowledge Base with Amazon Neptune Analytics graphs: https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-build-graphs.html
- AWS Graph and AI / Amazon Neptune: https://aws.amazon.com/neptune/graph-and-ai/
- GraphRAG general availability announcement: https://aws.amazon.com/about-aws/whats-new/2025/03/amazon-bedrock-knowledge-bases-graphrag-generally-available/

AWS describes GraphRAG as combining semantic/vector retrieval with graph relationships and traversal to improve connected and multi-step retrieval. These services are potential future components of Backline, not dependencies of the current authority model.

## Arts Council England

- Let's Create strategy 2020–2030: https://www.artscouncil.org.uk/lets-create
- National Lottery Project Grants: https://www.artscouncil.org.uk/projectgrants

Current 2026 Project Grants guidance includes information sheets for digital and technology-based projects, research and development, and Supporting Grassroots Live Music. A future funding application should use the current guidance applicable at the date of submission and should not infer eligibility solely from this paper.

---

## One-sentence summary

> **BNDY Backline is an AI-native evidence graph that allows BNDY to continuously observe, reconcile and explain the grassroots live-music ecosystem rather than merely storing a collection of listings.**
