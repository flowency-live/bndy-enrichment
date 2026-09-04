# ADR-115: Lemonrock Fact Fingerprint and Daily Gig Refresh

**Status:** Accepted  
**Date:** 4 September 2026

## Context

After ADR-114 shipped, Lemonrock showed no suppression at all. Measurement on 4 September: about 119 distinct gigs were hydrated each hour, the same 119 gigs, for 1,683 hydration runs and 26,301 Claims in the day. Two causes:

1. The Lemonrock gig fingerprint was a hash of the whole page. Adverts and served-at markers differ on every fetch, so every re-observation looked like new testimony.
2. Fast-feed gigs were re-hydrated with an hourly dedupe window. The separate cancellations feed already polls hourly for same-day changes.

## Decision

In the context of hourly Lemonrock hydration of the same gigs, facing a page-byte fingerprint that defeats testimony checkpoints and an hourly refresh that fetches unchanged pages, we decided to fingerprint a gig by its normalised facts and to re-hydrate fast-feed gigs daily, and neglected keeping the hourly window with a page hash, to achieve Claim volume proportional to real change and about one twenty-fourth of the hydration fetches, accepting that a change to a gig page is picked up on the next daily hydration or through the hourly cancellations feed rather than within the hour.

## Consequences

- Expected Lemonrock volume: about 120 hydration runs a day instead of about 1,700, and Claims only for new or changed gigs.
- The cancellations feed remains hourly and is the same-day change channel.
- OnTheCase already fingerprinted by facts; behaviour there is unchanged.
