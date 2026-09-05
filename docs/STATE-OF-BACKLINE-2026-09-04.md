# State of Backline

**Status date:** 4 September 2026, end of day
**Supersedes:** the morning checkpoint of the same date, which misdescribed Lemonrock as disabled.
**Scope:** Backline application, data, source acquisition, projection safety, Godmode visibility and the route to controlled canonical writes.

## Position, updated 5 September 2026

Backline is the live writer of record for OnTheCase. Since 00:00 UTC on 5 September the global projection control is on and `onthecase-gig-index` runs additive-only, create-only, match-only with no allowlist (ADR-116). Every other source stays in shadow. The stop action is `python scripts/pilot-canonical-write.py close`.

The first pilot window on 4 September (`onthecase-pilot-2026-09-04-v1`) ran the live path for ten named candidates: five matched Events Cowork had already imported, five were refused by the canonical near-tie artist guard, nothing was created, nothing failed. Canonical already held every OnTheCase gig at the verified venues, which is the decommission evidence for the Cowork OnTheCase importer. It is retired after 48 clean hours of Backline writes.

Overnight 4 to 5 September: 15 hourly OnTheCase runs, zero Claims written, zero errors, no new gigs posted. Lemonrock dropped from 121 hydration runs and 1,893 Claims an hour to 2 runs and zero Claims from 18:15 UTC (ADR-115).

## What is live and verified today

| Item | Evidence |
|---|---|
| Lemonrock shadow BAU | Hourly ticks enabled. 1,683 runs, 26,301 Claims and 1,653 projection items on 4 September by mid afternoon. Zero errors. Zero dead-letter arrivals in 24 hours. |
| KLMA | Daily, ran 08:54, healthy |
| Gigs News | Ran 08:54. Live registry says weekly. Code contract says daily. Registry re-seed pending. |
| OnTheCase fresh proof | Root-only run `onthecase-fresh-shadow-2026-09-04-v2`: 250 gigs, 2,514 Claims, 250 projection items, zero fan-out, zero errors, 3 seconds |
| Canonical convergence | Delta `canonical-delta-write-2026-09-04-v1`: 17,977 scanned, 262 new, 50 modified, 1 removed, 11,017 Claims, zero errors |
| Global projection control | Absent. Writes off by default. |
| Godmode | Operations tab merged and built (Amplify 827). Its API route is merged but the Lambda code is not yet deployed, so the tab reports unavailable until then. |

## What broke today and what fixed it

238 of the 250 OnTheCase projection items failed with "Claim safety limit exceeded". Those gigs had been re-observed hourly for weeks, so each carried more than 1,000 Claims. Projection only needs the latest active Claim per predicate.

Fix: projection now reads the newest 300 Claims per candidate and stops (ADR-112, PR #143). The 239 failed messages are in the ProjectionDLQ, which now holds 11,148. They will be superseded by the next observation, not replayed.

## Merged today, awaiting deployment

| PR | Change |
|---|---|
| bndy-enrichment #142 | Stack reliability invariants back in CI |
| bndy-enrichment #143 | Bounded newest-first Claim window for projection (ADR-112) |
| bndy-enrichment #144 | `entityCreation: match-only` projection policy (ADR-113) |
| bndy-enrichment #145 | `pilotCandidateKeys` allowlist |
| bndy-serverless-api #78 | Backline operations route |
| bndy-backstage #20 | Godmode Operations tab |

The enrichment stack was deployed once today at 12:46, before #143 to #145 merged. SourceRunsFunc has not been redeployed since 1 September.

## Route to first canonical write

1. Deploy BndyEnrichmentStack from `main`. Deploy SourceRunsFunc code from `master`.
2. Re-seed the source registry so cadence and staleness match the code catalogue.
3. Run a second root-only OnTheCase acquisition. Expect about 250 unchanged, all projection items shadow, zero failed.
4. Re-enable the OnTheCase hourly rule.
5. Approve and run the pilot in `docs/PILOT-CANONICAL-WRITE-PACKET.md`.

## Open decision: write-side Claim churn

Every observation re-asserts every fact. Lemonrock writes about 50,000 Claims a day and every hydrated gig is a projection item. OnTheCase wrote 46,000 to 60,000 Claims a day before its pause, mostly for unchanged gigs. The read-side window removes the projection risk. It does not remove the storage and cost growth.

Options for Jason:

| Option | Effect | Cost |
|---|---|---|
| A. Suppress Claims for events the diff marks unchanged; write a re-observation checkpoint instead | Claim volume falls by roughly 90 percent on stable sources | Changes the evidence model: an unchanged gig no longer gets fresh testimony each run |
| B. Keep writing Claims, add a TTL on Claims older than N days for non-canonical sources | Storage bounded, evidence model unchanged | Old testimony expires; history for disputes is lost |
| C. Do nothing now | No change | Table and cost grow linearly with observation count |

Recommendation: A, with the checkpoint carrying the observation id and content hash so provenance is preserved.

## Human approval gates that remain

- No canonical writes outside the signed pilot packet.
- No schedule re-enablement before the repeat-run evidence is accepted.
- No stream enablement, IAM, queue or concurrency change from this workspace.
- No DLQ purge or bulk replay on the critical path.
- No deletion of Claims as an incident shortcut.
