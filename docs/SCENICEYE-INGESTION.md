# Scenic Eye Backline ingestion

**Status:** adapter implemented, shadow/manual only pending source-specific production decision.

Scenic Eye is a single server-rendered weekly edition rather than an entity directory. The adapter therefore ingests one complete weekly document and derives gig identity from date + act + venue because no stronger source-native gig ID has been observed.

## Safety

The weekly edition is only allowed to behave as a complete snapshot while it is fresh. If every dated heading is before the run date, acquisition marks the capture `complete=false` and `captureStable=false`; this suppresses destructive withdrawal inference from a stale edition.

The parser also fails closed if the expected Scenic Eye title, dated headings or gig rows disappear.

## Identity

- gig: `sceniceye:gig:<date>:<act-slug>:<venue-slug>`
- act: `sceniceye:act:<slug>`
- venue: `sceniceye:venue:<venue-slug>[-<postcode-slug>]`

These are derived identities, not native numeric IDs. Date/name corrections can therefore appear as withdraw-plus-add. That weakness is explicit and must remain visible in provenance.

## Operating model

The source definition remains disabled, shadowed and `writerAuthority: cowork`. No production schedule is introduced by the adapter PR. A cadence should only be enabled after observing how often the weekly edition changes and choosing the cheapest cadence that reliably captures a new edition.

There are no artist or venue directories to crawl and no recursive profile fanout.
