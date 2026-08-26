# BNDY Backline - Norfolk Gig Guide ingestion reconnaissance

**Status:** fixture and AWS-reachability gated. No adapter implementation yet.
**Recon date:** 26 August 2026
**Source:** Norfolk Gig Guide, Norfolk and Norwich.

## Why it matters

This source would add East Anglia coverage and appears strongly aligned with grassroots live music. Reconnaissance found paginated band, venue and solo/duo directories plus band and venue detail pages.

## Established source facts

- band directory: `/Band-list?pg=<n>`, approximately 20 acts per page and around 130 pages observed during recon;
- venue directory: `/Venue-list?pg=<n>`;
- solo/duo directory: `/Solo+and+Duo-list?pg=<n>`;
- band detail pages: `/band-details/<slug>`;
- venue detail pages: `/venue-details/<slug>`;
- band pages expose upcoming gig rows with date, time, venue and address;
- numeric band account IDs were observed, so band identity should prefer that native ID over the name slug;
- no stable per-gig URL was found during recon, so gig identity may require a documented deterministic derived key unless fixtures reveal something stronger.

## Acquisition gate

The origin returned 403 to non-browser datacentre clients during reconnaissance. Browser runtime is therefore only a hypothesis, not approval to bypass the site's controls.

Before implementation:

1. capture raw fixtures for the home/date listing, early and later band-directory pages, venue directory, solo/duo directory, multiple band and venue profiles, a town page and an unknown URL;
2. confirm gig-row semantics and whether venues expose a stronger native ID;
3. prove that the intended AWS browser worker can reach the source reliably and courteously;
4. if AWS acquisition remains fragile or unwelcome, stop and consider contacting the operator for access/feed rather than escalating evasion.

## Provisional identities

- band: `norfolkgigguide:band:<numeric-account-id>`
- venue: source-native ID if fixtures reveal one, otherwise a carefully normalised slug identity
- gig: derived only as a last resort, for example date + resolved band key + resolved venue key

## Intended operating principle

Do not adopt the donor patch's proposed recurring directory crawl as steady state by default. If implementation becomes viable, prefer a gig-led model and hydrate only entities needed by gig evidence. Large directories are bootstrap/completeness tools unless a later requirement proves recurring directory enumeration is necessary.
