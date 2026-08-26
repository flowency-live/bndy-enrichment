# On The Case Backline ingestion

## Decision

On The Case is integrated as a **gig-led, low-cost Backline source**. The source adapter preserves source-native identities and evidence, but it does not continuously crawl the band or venue directories.

Steady state:

- `/gigs` is the change surface and complete future-gig snapshot.
- the gig sweep cadence is hourly once production activation is explicitly enabled.
- gig rows hydrate only the venues referenced by those gigs.
- venue profiles may resolve and hydrate bands referenced by those venue gig rows.
- band hydration records profile and venue-relationship claims but does **not** fan back out to venue hydration.
- `/bands` and `/venues` are manual bootstrap/audit surfaces only.
- `/cancellations` is not a cancellation feed and is never treated as cancellation evidence.
- withdrawal from a structurally valid complete `/gigs` snapshot is the only On The Case absence signal.

## Source-native identity

- Artist: `onthecase:band:<numeric-id>`
- Venue: `onthecase:venue:<numeric-id>`
- Gig: `onthecase:gig:<numeric-id>`

Gig rows expose gig and venue IDs but do not reliably expose band IDs. Performer resolution therefore remains name-based at the gig edge until a venue profile supplies a band link or later Backline identity resolution matches the performer.

## Unresolved event labels

Open-mic, buskers, jam-night, open-stage and music-club style labels are retained as event context in `data.unresolvedPerformerLabel`. They do not force Artist creation. A genuine Artist can still be attached later if independent evidence resolves one.

## Structural safety

The site can return its marketing homepage with HTTP 200 for unknown URLs. Every task kind therefore validates the page title before accepting the response. The root `/gigs` parser also fails closed if a historically non-empty complete snapshot parses to zero gigs.

## Profile evidence

Band profiles can contribute source-verbatim name, genre, bio and `performsAt` relationship claims. Venue profiles can contribute name, address, phone, bio, capacity/accessibility/food facts and `performedBy` relationship claims.

These remain source claims. Authority policy and entity resolution decide what becomes BNDY truth.

## Fanout boundary

The steady-state graph is intentionally bounded:

`gig index -> venue hydration -> band hydration`

Band hydration does not recursively expand back to venues. This prevents the source from turning one gig discovery into an accidental crawl of the entire On The Case corpus.

## Reconciliation

The bootstrap CLI creates an owned `reconciliationId` and propagates it through child work. `--mode=gig-led` queues only `/gigs`. `--mode=inventory-audit` is an explicit operator action that may additionally enumerate the band and venue directories.

A production completion manifest must be generated from the reconciliation lineage and queue/DLQ state before any source is promoted beyond shadow mode.

## Production controls

All On The Case source definitions seed with:

- `enabled: false`
- `shadow: true`
- `writerAuthority: cowork`
- standard HTTP runtime

No canonical-write cutover is part of source onboarding. Production activation is a separate controlled step after CI, shadow acquisition and completion evidence are green.
