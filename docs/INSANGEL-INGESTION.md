# BNDY Backline - Insangel ingestion reconnaissance

**Status:** fixture-gated. No adapter implementation is authorised yet.
**Recon date:** 26 August 2026
**Source:** Insangel, "Music To Your Beers", North East England.

## Known surfaces

Search-index evidence identifies:

- gig guide: `/northeastgigguide`
- band directory: `/bands`
- band profiles: `/bands/<slug>`
- venue directory: `/venues`
- venue profiles: `/venues/<slug>`

No reliable numeric source-native IDs have yet been established. Slug identities are provisional only. Gig identity and complete-vs-incremental listing semantics remain unresolved.

## Fixture and reachability gate

Direct acquisition from the build environment failed during reconnaissance. No parser should be written from search snippets or guessed markup.

Before implementation:

1. capture a current full gig-guide fixture;
2. capture band and venue directory fixtures;
3. capture at least three band and three venue profiles;
4. capture an unknown-URL response and any pagination/filter variants;
5. prove AWS-origin reachability using the intended acquisition runtime;
6. establish gig identity and snapshot semantics from those fixtures.

If AWS-origin acquisition is not reliable or welcome, stop and decide whether the source stays external/manual or whether the operator should be approached for a feed. Do not escalate acquisition evasion.

## Intended Backline model after the gate

If the gate passes, use the same evidence-first model as other Backline sources: shadow acquisition, immutable evidence and claims, source-native identity where available, bounded fanout, explicit completion evidence and no canonical writes during onboarding.

Directory crawling is not automatically justified by the existence of directories. The eventual steady state should be gig-led wherever the source exposes enough identity to hydrate only entities referenced by gigs.
