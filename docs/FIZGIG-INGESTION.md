# Fizgig ingestion plan

Status: canonical-first recovery plan, reconnaissance incomplete, shadow-only

Prepared: 2026-08-31

Source: [Fizgig gigs](http://www.fizgig.epizy.com/fizgig-gigs.htm)

## Decision

Fizgig is a useful Lincolnshire and East Midlands source candidate, and some of its data is already in canonical BNDY. Backline must first represent those canonical records, recover their import lineage and then acquire Fizgig as an independent source. It must not replay the old import into canonical BNDY.

Search indexing confirms Fizgig-branded 2026 gig and Artist pages, but the supplied root and indexed pages could not be fetched reliably during this review. The page model, robots policy, native identities, completeness and cancellation behaviour remain unproved. Adapter work is therefore fixture-gated.

## Canonical-first sequence

1. Include the existing Fizgig-derived canonical records in the controlled delta hydration from `bndy-baseline-2026-08-24-v1`.
2. Find recoverable Fizgig source labels, URLs, external IDs and legacy import timestamps.
3. Treat those values as lineage for the canonical assertion, not as a substitute for source-native evidence.
4. Capture a fresh immutable Fizgig fixture set through a permitted route.
5. derive stable source keys from proved native fields or, only if necessary, documented composites;
6. resolve Fizgig candidates to existing canonical IDs and expose conflicts;
7. begin shadow BAU acquisition with canonical projection disabled.

## Reconnaissance questions

The fixture pass must answer:

- Which page is the authoritative current and future gig index?
- Are listings split by month, county, town, Venue or Artist?
- Does each gig, Artist or Venue expose a stable native ID?
- What dates, times, localities, links and cancellation signals are present?
- Is the listing a complete forward snapshot, a rolling window or append-only publication?
- Are older monthly pages immutable?
- Does `robots.txt` permit the required routes?
- Is browser rendering required?
- What request rate is respectful for the host?
- Which exact legacy canonical records came from Fizgig?

Until those questions are answered, do not invent endpoint paths, parser fields, withdrawal rules or a destructive baseline.

## Provisional source family

The final names depend on fixtures. The minimum likely shape is:

```text
fizgig-gig-index
fizgig-artist-index       if independently enumerable
fizgig-venue-index        if independently enumerable
fizgig-detail-hydration   only if detail pages add evidence
fizgig-full-reconcile
```

Every source record starts disabled, shadow and non-authoritative. The intended steady-state owner is the Backline source runtime. No Cowork, Signals or other legacy schedule may run concurrently after cutover.

## Fixture gate

Commit raw fixtures under `test/fixtures/fizgig/` for:

- the supplied gig root and its final redirected URL, if any;
- `robots.txt`;
- the current listing surface;
- two adjacent month or archive surfaces if those exist;
- at least three gig detail examples if detail pages exist;
- two Artist and two Venue surfaces if independently represented;
- an empty, unknown or error route;
- one historical page to establish archive behaviour.

Record status, final URL, headers, content type, body hash, encoding and acquisition method for every fixture. Preserve the raw body before parsing.

Definition of ready:

1. acquisition succeeds through a permitted route without bypassing access controls;
2. the robots and courtesy policy is recorded;
3. structural invariants and inventory controls are identified;
4. identity and horizon decisions are documented;
5. malformed, empty and partial captures fail closed;
6. canonical lineage can be queried without creating or updating canonical records.

## Identity policy

Prefer a stable publisher key if fixtures reveal one. Otherwise derive source identities from the smallest proved composite and retain every raw component used.

A fallback event key may use local date, normalised Artist and normalised Venue with locality, but only after collision tests demonstrate that the source does not publish multiple same-day performances with the same tuple. Derived keys remain source identities, never canonical IDs.

Ambiguous same-name entities are parked. A legacy canonical match is evidence to consider, not permission to force the resolution.

## Snapshot semantics

Start as `incremental` and never infer cancellation from disappearance. Upgrade a surface to `complete` only after repeated fixtures prove its exact inventory and time horizon.

Explicit cancellation wording may produce a cancellation Claim. Missing rows, failed fetches, unexpected layouts and partial pages may not.

## Provisional cadence

| Job | Initial cadence | Freshness role |
| --- | --- | --- |
| Current gig index | Daily after qualification | Coverage root, maximum staleness 26 hours |
| Artist or Venue indexes | Weekly if present | Discovery child |
| Detail hydration | On discovery if useful | Child job |
| Full reconcile | Monthly | Maintenance only |

Cadence can be reduced only if publisher behaviour proves that a slower check still meets Backline's daily acquisition contract. An unchanged daily check is still a successful freshness heartbeat.

## Shadow acceptance

Fizgig can enter shadow BAU only when:

1. fixtures, parsers and structural-failure tests pass;
2. two live captures produce stable source identities;
3. capture counts reconcile to a source control or have explained exclusions;
4. a partial run cannot advance a complete baseline;
5. canonical-first resolution reports matched, unresolved and conflicting items without mutating canonical BNDY;
6. evidence, Observations, Claims, metrics, run report and heartbeat are retained;
7. the legacy Fizgig schedule or writer is confirmed off;
8. source freshness is covered by the 26-hour alarm;
9. canonical projection remains disabled.

## Initial product proof

The first report should show what changed between the legacy canonical import and the current Fizgig source:

- existing canonical matches;
- genuinely new source candidates;
- listings no longer visible within the proved source horizon;
- Artist, Venue, locality, date and time conflicts;
- duplicates or identity collisions;
- source freshness and last successful unchanged check.

No source activation, AWS action, canonical hydration or canonical write is authorised by this plan.
