# Live Band Photos ingestion plan

Status: canonical-first recovery plan, fixture-gated, shadow-only

Prepared: 2026-08-31

Source: [Live Band Photos](https://www.livebandphotos.co.uk/)

## Decision

Live Band Photos should become a Backline-owned shadow source after its existing canonical BNDY imports have been caught up into Backline. We must not replay the source as a new canonical import or infer that a canonical source label is source-native evidence.

The initial source research is useful, but its reported counts are already volatile. The 27 August research recorded 254 current-month gigs; the live page observed on 31 August reported 205. Counts therefore belong in timestamped observations and reconciliation controls, never as hard-coded acceptance constants.

## Canonical-first sequence

1. Include existing canonical records in the controlled delta hydration from `bndy-baseline-2026-08-24-v1`.
2. Identify records with recoverable Live Band Photos source labels, external IDs or import metadata.
3. Record that lineage as metadata about the canonical assertion, not independent publisher evidence.
4. Capture and retain the first source-native snapshot.
5. Resolve source candidates to existing canonical IDs and report matched, unresolved and conflicting records.
6. Start shadow BAU acquisition only after the fixture and identity gates pass.
7. Keep canonical projection disabled.

This sequence prevents duplicate Artists, Venues and Events while restoring the provenance that a legacy canonical import alone cannot supply.

## Observed source surfaces

| Surface | Observed shape | Intended role |
| --- | --- | --- |
| Home page | Server-rendered dated gig listing with Artist, Venue, locality and optional start/end times | Daily coverage root |
| County pages | Venue indexes with venue names and listed-gig counts | Weekly venue discovery and inventory control |
| Bands A-Z | Band directory with a publisher-advertised count | Weekly Artist discovery and inventory control |
| Band detail | Name-based query route | Pending fixture proof |
| Venue detail | Name-based query route | Pending fixture proof |
| Month pages | Forward gig listings | Horizon and completeness evidence |
| Music links | Disallowed by the captured robots policy | Human scouting only, never automated |

The site describes itself as cover and tribute band listings for Essex, Herts and surrounding areas. Its current listing count and future horizon must be captured per observation because both can change during a day.

## Proposed source family

```text
livebandphotos-gig-listing
livebandphotos-county-index
livebandphotos-band-index
livebandphotos-band-hydration   pending fixture proof
livebandphotos-venue-hydration  pending fixture proof
livebandphotos-full-reconcile
```

All records start disabled, shadow and non-authoritative. The intended steady-state owner is the Backline source runtime. A Cowork or legacy writer must be confirmed off before an AWS schedule is enabled.

## Identity model

The source exposes no proven native IDs. Until fixtures establish otherwise, use derived source identities:

```text
livebandphotos:band:<normalised-name>
livebandphotos:venue:<normalised-name-with-locality>
livebandphotos:gig:<local-date>:<band-key>:<venue-key>
```

These are source keys, not canonical IDs. Renames may appear as withdrawal plus addition. The resolver must park ambiguous same-name Artists and Venues. Locality is evidence, not permission to merge.

If a detail page exposes a stable native key, prefer that key and retain aliases from the derived identity.

## Snapshot semantics

Begin as `incremental` with no disappearance-based withdrawal. Do not label the listing complete until fixtures and repeated observations prove:

- the exact forward horizon;
- whether month navigation contains the full future set;
- whether late additions appear on both root and month views;
- whether records disappear only when removed or when a rolling window moves;
- whether explicit cancellations are represented.

Only a structurally complete observation may advance a destructive comparison baseline. A failed or partial capture cannot infer cancellation or withdrawal.

## Fixture gate

Commit raw fixtures under `test/fixtures/livebandphotos/` for:

- the full home page;
- two county pages, including Essex and a smaller county;
- the Bands A-Z page;
- two month pages that straddle the visible horizon;
- three known-active and one unknown Band detail routes with exact query strings;
- three known-active and one unknown Venue detail routes with exact query strings;
- `robots.txt`;
- one changed listing observed on two dates if available.

Before adapter work begins, record:

- response status, final URL, content type and body hash;
- server-rendered versus browser-rendered decision for detail pages;
- parsed count against the publisher-advertised count for every indexed surface;
- courtesy rate, cache behaviour and any robots exclusions;
- whether the live runtime can acquire the source without bypassing access controls.

If detail pages contain no additional source evidence, omit their hydration jobs.

## Proposed cadence

| Job | Cadence | Freshness role |
| --- | --- | --- |
| Gig listing | Daily | Coverage root, maximum staleness 26 hours |
| County indexes | Weekly | Discovery child |
| Band index | Weekly | Discovery child |
| Detail hydration | On discovery, if retained | Child job |
| Full reconcile | Monthly | Maintenance only |

Twice-daily acquisition requires measured change-rate value and a courtesy review. Default concurrency is at most two, subject to the shared runtime cap.

## Shadow acceptance

The source can enter shadow BAU only when:

1. fixtures and structural-failure tests pass;
2. two live captures produce stable source identities;
3. counts reconcile to the captured publisher count or have explained exclusions;
4. no incomplete capture produces a withdrawal;
5. canonical-first resolution reports matches, conflicts and unresolved candidates without creating canonical entities;
6. raw evidence, Observations, Claims, run report and source heartbeat are retained;
7. the prior Live Band Photos writer or schedule is confirmed off;
8. the 26-hour freshness check covers the root;
9. ProjectionQueue receives no authorised canonical work.

## Initial product proof

The first useful report should compare the source-native snapshot with the newly hydrated canonical set:

- matched Artists, Venues and future Events;
- source records that never reached canonical BNDY;
- canonical records no longer present in the current source horizon;
- time, locality and naming conflicts;
- duplicate candidates caused by spelling or locality variants;
- source changes since the initial legacy import.

This report is the reason to onboard the source. It turns a one-off import into explainable, continuously observed intelligence without writing back to BNDY.

No source activation, AWS action, canonical hydration or canonical write is authorised by this plan.
