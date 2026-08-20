# BNDY Intelligence Layer & Knowledge Graph — Visual Architecture

**Status:** Visual companion to `docs/TARGET-ARCHITECTURE.md`  
**Date:** 20 August 2026  
**Authority:** `docs/TARGET-ARCHITECTURE.md` remains the single authoritative target architecture. If this visual companion conflicts with it, `TARGET-ARCHITECTURE.md` wins.

---

## 1. The one-picture view

```mermaid
flowchart TB
  subgraph WORLD[Real-world evidence / sources]
    VW[Venue websites]
    AW[Artist websites / Facebook]
    CS[Curated sources\nGigsNews / KLMA / ScenicEye]
    CAP[BNDY Capture\nURL / poster / image]
    TKT[Ticketing sources]
  end

  subgraph ACQ[Acquisition]
    HTTP[HTTP / APIs / JSON-LD]
    BROWSER[Chromium / JS-rendered pages]
    IMAGE[Multimodal image intake]
  end

  subgraph EVIDENCE[Durable evidence substrate]
    OBS[Observations\nwhat BNDY actually saw]
    S3[(S3 immutable evidence)]
  end

  subgraph INTEL[BNDY INTELLIGENCE LAYER]
    EXT[Deterministic extraction]
    INTERP[AI interpretation\nGemini / Claude]
    CLAIM[Claims\nsubject → predicate → value]
    PACK[Evidence Packs\ncorroboration + contradiction]
    RESOLVE[Entity resolution]
    AUTH[Authority + conflict reasoning]
    INFER[Inference]
  end

  subgraph KNOWLEDGE[Durable knowledge substrate]
    KDB[(DynamoDB graph-shaped knowledge)]
    TOMBS[Tombstones / withdrawals]
    RES[Resolutions]
  end

  subgraph CANON[Canonical BNDY domain boundary]
    API[BNDY APIs]
    ART[Artist projection]
    VEN[Venue projection]
    EVT[Event projection]
  end

  VW --> HTTP
  AW --> HTTP
  CS --> HTTP
  CS --> BROWSER
  CAP --> HTTP
  CAP --> IMAGE
  TKT --> HTTP

  HTTP --> OBS
  BROWSER --> OBS
  IMAGE --> OBS
  OBS --> S3
  OBS --> EXT

  EXT -->|sufficient| CLAIM
  EXT -->|ambiguous / unstructured| INTERP
  INTERP --> CLAIM
  CLAIM --> PACK
  PACK --> RESOLVE
  CLAIM --> AUTH
  RESOLVE --> INFER
  AUTH --> INFER

  CLAIM --> KDB
  PACK --> KDB
  RESOLVE --> RES
  AUTH --> TOMBS
  INFER --> API

  API --> ART
  API --> VEN
  API --> EVT
```

The key architectural line is:

> **AI does not own truth. AI helps convert messy evidence into Claims and helps reason across them. The durable knowledge substrate remembers what was seen, what was inferred, who asserted it and why the current BNDY projection exists.**

---

## 2. Where the Intelligence Layer sits

```mermaid
flowchart LR
  SOURCE[Sources / evidence]
  KNOW[Knowledge substrate\nObservations + Claims + Evidence + Resolutions]
  INTEL[Intelligence Layer\nExtract · Interpret · Resolve · Reconcile · Infer]
  PROD[Operational BNDY\nArtist · Venue · Event]

  SOURCE --> KNOW
  KNOW <--> INTEL
  INTEL --> PROD
```

The Intelligence Layer is **not a datastore**. It is the reasoning/runtime layer between evidence and canonical BNDY projections.

Its responsibilities include:

- deterministic extraction;
- AI interpretation where deterministic methods are insufficient;
- artist and venue identity resolution;
- event candidate clustering;
- source authority evaluation;
- corroboration;
- contradiction handling;
- cancellation and reinstatement reasoning;
- bounded graph expansion;
- source reliability analysis;
- exception-only escalation.

---

## 3. Where the graph is

The graph exists **logically from the moment BNDY stores connected Claims, Candidates, Resolutions and canonical entities**.

Neptune is not required to make the model a graph.

### Phase 1 — graph-shaped knowledge in DynamoDB

```mermaid
flowchart LR
  SRC[Source]
  OBS[Observation]
  CLM[Claim]
  CAND[Candidate]
  ENT[Canonical Entity]

  SRC -->|produced| OBS
  OBS -->|supports| CLM
  CLM -->|describes| CAND
  CAND -->|resolvesTo| ENT
```

Initially, the relationships are persisted in DynamoDB/S3 because that is cheap, operationally simple and sufficient for the first reconciliation workloads.

### Phase 2 — graph projection into Neptune

```mermaid
flowchart LR
  DURABLE[Durable knowledge substrate\nDynamoDB + S3]
  PROJECTOR[Graph projector]
  NEPTUNE[(Amazon Neptune)]
  QUERY[Graph traversal / inference]
  PROJECTION[Projection engine]
  BNDY[BNDY read model]

  DURABLE --> PROJECTOR --> NEPTUNE --> QUERY --> PROJECTION --> BNDY
```

**Important:** Neptune is initially a **graph projection/index**, not the only copy of truth.

The durable substrate remains:

- immutable Observations;
- Claims;
- Resolutions;
- Evidence Packs;
- Tombstones / withdrawals;
- raw evidence in S3.

---

## 4. Example: three sources, one gig

```mermaid
flowchart LR
  VWEB[Fishpond website]
  AFB[Artist Facebook]
  GN[GigsNews]

  C1[Claim\nLegacy of Crows\nFishpond\n12 Sep\n21:00]
  C2[Claim\nLegacy of Crows\nFishpond\n12 Sep\n21:00]
  C3[Claim\nLegacy of Crows\nFishpond\n12 Sep\n20:30]

  EP[Evidence Pack\nSame real-world performance]
  EVENT[Canonical Event]

  VWEB --> C1
  AFB --> C2
  GN --> C3

  C1 --> EP
  C2 --> EP
  C3 --> EP
  EP --> EVENT
```

The graph retains all three claims.

The Intelligence Layer can reason:

```text
Venue-owned source: 21:00
Artist-owned source: 21:00
Curated source:      20:30

Projection: 21:00
Reason: two higher-authority owned sources agree.
```

The `20:30` claim is **not deleted**. It remains provenance and disagreement evidence.

---

## 5. Example: cancellation reasoning

```mermaid
flowchart TD
  ARTIST[Artist-owned source\nCANCELLED]
  VENUE[Venue website\nprevious listing withdrawn]
  AGG[Aggregator\nstill lists event]

  C1[Explicit cancellation claim]
  C2[Claim withdrawal]
  C3[Stale existence claim]

  REASON[Authority + freshness + corroboration]
  TOMB[Durable tombstone]
  PROJ[Canonical event projection\ninterim delete/hide\nfuture status=cancelled]

  ARTIST --> C1
  VENUE --> C2
  AGG --> C3

  C1 --> REASON
  C2 --> REASON
  C3 --> REASON

  REASON --> TOMB
  REASON --> PROJ
```

The graph allows BNDY to distinguish:

- explicit cancellation;
- source disappearance;
- stale third-party listings;
- later reinstatement.

---

## 6. What AI makes newly practical

These capabilities are either impossible or uneconomic with traditional deterministic ETL alone.

```mermaid
mindmap
  root((BNDY Intelligence))
    Multimodal understanding
      Gig posters
      Flyers
      Screenshots
      Mixed text + image evidence
    Entity resolution
      Name variants
      Facebook identities
      Geographic context
      Gig footprint similarity
    Cross-source reasoning
      Contradictions
      Source authority
      Freshness
      Corroboration
    Natural-language graph queries
      Why does this gig exist?
      Are these artists aliases?
      Which sources go stale?
      Which venues are becoming active?
    Autonomous exception resolution
      Candidate comparison
      Evidence inspection
      Confidence scoring
      Human only for real ambiguity
    Reinterpretation
      Better future model
      Same immutable evidence
      New interpretation version
    Source reliability learning
      Discovery accuracy
      Time accuracy
      Cancellation accuracy
```

### Practical AI-native use cases

#### Multimodal evidence understanding

A poster image can become structured claims about:

- artist;
- event name;
- physical venue;
- date;
- stage time;
- admission;
- ticket information.

#### Identity from relationship footprint

Two artist names can be inferred as likely aliases using more than string similarity:

```text
name similarity
+ same Facebook identity
+ same region
+ recurring appearance at the same venues
+ overlapping gig dates / promoters
```

#### Contradiction reasoning

BNDY can preserve disagreement rather than flattening source data into last-write-wins.

#### Natural-language interrogation

Future internal queries could include:

```text
Why does BNDY believe this gig exists?

Which Stoke artists have no Facebook URL but share a venue footprint with known originals bands?

Show sources that regularly retain gigs after venue-owned sources cancel them.

Which venues appear to be increasing their grassroots live-music activity over the last six months?

Show unresolved artist candidates that are probably aliases.
```

#### Reinterpretation of historical evidence

Because evidence is immutable, a future model can reinterpret old evidence without rewriting history.

```mermaid
flowchart LR
  OLD[Poster captured in 2026]
  OBS[Immutable Observation]
  V1[Interpretation v1\nGemini 2026]
  V2[Interpretation v2\nfuture model]
  C1[Claims v1]
  C2[Claims v2]

  OLD --> OBS
  OBS --> V1 --> C1
  OBS --> V2 --> C2
```

---

## 7. BNDY Graph Explorer

A visual explorer should eventually sit in Godmode/backstage over the knowledge graph.

This is not required for the first AWS source migration, but it is a deliberate future capability.

### Concept

```mermaid
flowchart LR
  SEARCH[Search / natural language]
  EXPLORER[BNDY Graph Explorer]
  GRAPH[Graph API / Neptune]
  EVIDENCE[Observation / Claim / Evidence APIs]

  SEARCH --> EXPLORER
  EXPLORER --> GRAPH
  EXPLORER --> EVIDENCE
```

### Example visual neighbourhood

```mermaid
flowchart TD
  LC[Legacy of Crows\nARTIST]
  FB[Facebook\nSOURCE]
  SITE[Official website\nSOURCE]
  FISH[The Fishpond\nVENUE]
  SUGAR[The Sugarmill\nVENUE]
  GIG1[12 Sep performance\nEVENT]
  GN[GigsNews\nSOURCE]
  CLAIM21[startsAt 21:00\nCLAIM]
  CLAIM2030[startsAt 20:30\nCLAIM]

  FB -->|identity evidence| LC
  SITE -->|identity evidence| LC
  LC -->|performs at| GIG1
  GIG1 -->|occurs at| FISH
  LC -->|has performed at| SUGAR
  FISH --> CLAIM21
  GN --> CLAIM2030
  CLAIM21 --> GIG1
  CLAIM2030 --> GIG1
```

### Interaction model

The explorer should support:

- search any artist, venue, event or source;
- expand one hop / two hops;
- filter by entity type;
- filter by date/freshness;
- show source authority;
- show confidence;
- highlight contradictions;
- show inferred vs directly asserted edges;
- click an edge to inspect the Claim;
- click a Claim to inspect the raw evidence;
- ask natural-language questions about the visible subgraph.

Potential browser visualisation libraries:

```text
Cytoscape.js
Sigma.js
```

The graph API can later be backed by Neptune, while evidence drill-down continues to use the durable DynamoDB/S3 substrate.

---

## 8. Obsidian / local visualisation

Yes: the BNDY graph can be exported for local exploration.

Useful export formats:

```text
Markdown + wikilinks   → Obsidian
GraphML                → Gephi / yEd / Cytoscape
JSON                   → custom tooling
CSV nodes + edges      → general graph analysis
```

Example Obsidian projection:

```markdown
# Legacy of Crows

Type: Artist

## Relationships
- Performs at [[The Fishpond]]
- Performs at [[The Sugarmill]]
- Appears in [[Gig 2026-09-12 Fishpond]]
- Identity supported by [[Facebook Source - Legacy of Crows]]
```

This would be an **export/view**, not the canonical knowledge store.

---

## 9. Product read model vs knowledge graph

```mermaid
flowchart TB
  KNOW[Durable knowledge substrate\nrich, historical, contradictory]
  INTEL[Intelligence Layer]
  GRAPH[Neptune graph projection\nwhen justified]
  READ[BNDY product read model\nfast Artist / Venue / Event records]
  APP[BNDY PWA / map / website]

  KNOW <--> INTEL
  KNOW --> GRAPH
  GRAPH <--> INTEL
  INTEL --> READ
  READ --> APP
```

The PWA should **not** perform graph traversals just to render the normal gig map.

The operational database answers:

> What does BNDY currently believe?

The knowledge graph answers:

> Why does BNDY believe it, what disagrees with it, and what else can be inferred?

---

## 10. Build position

The Graph Explorer and Neptune are deliberately **not on the first production critical path**.

The correct sequence is:

```mermaid
flowchart LR
  A[Observations]
  B[Claims]
  C[Reconciliation]
  D[Canonical projections]
  E[Evidence Packs + richer inference]
  F[Neptune projection]
  G[Graph Explorer]
  H[Natural-language graph intelligence]

  A --> B --> C --> D --> E --> F --> G --> H
```

The crucial step is to build **graph-native data contracts now** so that adding Neptune and visualisation later does not require rewriting every source collector.

---

## 11. Architectural principle

> **BNDY is not ultimately a gig-listing database. It is a living, evidence-backed model of the grassroots live-music ecosystem, with Artist, Venue and Event records as operational projections of that knowledge.**
