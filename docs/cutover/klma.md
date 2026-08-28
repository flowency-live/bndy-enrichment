# KLMA shadow BAU and additive-only writer cutover checklist

**Source:** `klma-stoke-gig-list`  
**Target adapter:** `klma-stoke`  
**Donor runtime:** `flowency-live/bndy-signals`  
**Rule:** Cowork and AWS must never write KLMA production concurrently.

## Current state

- KLMA is healthy live shadow BAU: `enabled: true`, `shadow: true`, `writerAuthority: cowork`, daily cadence and standard runtime.
- The production stack and daily schedule are deployed. The accepted live run completed at `2026-08-28T08:09:19Z`.
- AWS persists raw evidence, an Observation and Claims, but canonical projection remains disabled. Cowork remains the canonical writer.
- Shadow BAU completion does not mean writer cutover completion. The later gates below still govern any transfer of writer authority or Cowork retirement.
- The Source Registry bootstrap applies `projectionPolicy.mode: additive-only` with 50 to 500 accepted events and at most 500 canonical actions per run.
- Additive-only means create or match an Event, verify its Artist, Venue and date, and link supporting Claims. It never updates, cancels, hides, restores or uncancels an Event.
- A manual `projectionBootstrap: true` run proposes every accepted current row as a bounded create-or-match action. Scheduled runs cannot request bootstrap mode.

## Shadow BAU acceptance, 2026-08-28

Authoritative manifest: `ops/klma-shadow-bau-manifest.json`

| Acceptance condition | Result |
|---|---|
| Live Google Sheet fetch | PASS |
| Observation persisted | PASS: `obs-bfcbd2f7-3944-4f8a-a41b-47c2ac38e43b` |
| Raw evidence persisted | PASS |
| Claims persisted | PASS: 2,771 |
| Daily schedule enabled | PASS |
| Canonical projection disabled | PASS |
| Cowork retained as writer | PASS |

This gate establishes safe daily Backline evidence ingestion. It does not authorise canonical writes.

## Gate A: identical-evidence fixture

Fixture: `test/fixtures/klma/source-2026-06-13.gviz-raw.csv`  
SHA-256: `c036562d71f063a5394c0c5d2d7b45896426ad40b25be028fe3b343e91cd663d`

| Result | Donor | Backline | Classified difference |
|---|---:|---:|---|
| Raw rows | 500 | 500 | none |
| Accepted events | 378 | 353 | 25 rows fail safer Backline gates |
| Parked rows | 122 | 147 | same 25 rows remain inspectable |
| Specialist Venue | 70 | 70 | none |
| Multi-act Venue | 24 | 24 | none |
| Form metadata | 19 | 19 | none |
| Non-artist row | 8 | 8 | none |
| Unparseable | 1 | 1 | none |
| Ambiguous Venue locality | 0 | 20 | `EXPECTED_RULE_CHANGE` |
| Source-identity collision | 0 | 4 | `EXPECTED_RULE_CHANGE` |
| Identical duplicate | 0 | 1 | `EXPECTED_RULE_CHANGE` |

The machine-checked manifest is `test/fixtures/klma/gate-a.manifest.json`. Gate A is not signed off until the 20 historical Venue-locality rows and four collision rows in that manifest have an explicit operator disposition. No row is silently dropped or defaulted to Stoke-on-Trent.

## Read-only live audit, 2026-08-27 14:27 UTC

Evidence SHA-256: `03d6b9eaed6d70d37867b1fb98eddbecc0a721aef0fbc0bbde43e5fa1dd420e8`

| Result | Count |
|---|---:|
| Raw rows | 410 |
| Accepted events | 306 |
| Entity profiles | 312 |
| Parked rows | 104 |
| Specialist Venue | 55 |
| Multi-act Venue | 19 |
| Form metadata | 18 |
| Non-artist row | 8 |
| Past event | 3 |
| Identical duplicate | 1 |
| Ambiguous Venue locality | 0 |
| Source-identity collision | 0 |
| Accepted events with a defaulted start time | 31 |

The raw Google export is preserved unchanged as Observation evidence. Header synthesis and helper-column removal happen only in parser memory after the structural gate recognises multiple real date, Artist and Venue rows.

The 31 time defaults remain explicit review items: 23 blank cells, two `TBC` cells, four known `07:12` spreadsheet-corruption values, one price-only cell and one malformed `8m` cell. They are not treated as observed 21:00 times in the parity review.

## Gate B: live shadow parity

Run Cowork and AWS close together, with AWS still non-writing. Compare every accepted event, every parked-row fingerprint and the complete added, updated, unchanged and withdrawn action manifest.

| Run | Cowork timestamp | AWS timestamp | Evidence hash | Accepted and parked parity | Actions reviewed | Result |
|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  | PENDING |
| 2 |  |  |  |  |  | PENDING |

Gate B passes only after two runs on different days have no unexplained material difference. Allowed classifications are `INPUT_DIFFERENCE`, `EXPECTED_RULE_CHANGE`, `IDENTITY_DIFFERENCE`, `PROJECTION_DIFFERENCE` and `DEFECT`.

## Cutover window

1. Confirm Gate A disposition and two Gate B passes on different days.
2. Confirm AWS is still disabled, shadowed and Cowork-owned.
3. Pause the Cowork KLMA schedule and confirm no Cowork run remains in flight.
4. Set AWS `writerAuthority: aws`, `shadow: false` and enable the source in the same controlled window.
5. Trigger one manual run with `task.projectionBootstrap: true`.
6. Stop if accepted rows fall outside 50 to 500, actions exceed 500, any identity needs review, or any read-back fails.
7. Verify every affected canonical Event and confirm no Event was updated, cancelled, hidden, restored or uncancelled.
8. Run daily. Require three clean daily runs before permanently retiring Cowork.

## Rollback

1. Disable the AWS source and restore `writerAuthority: cowork`, `shadow: true`.
2. Confirm no ProjectionQueue work from the live KLMA run remains in flight.
3. Re-enable the Cowork schedule.
4. Record the Observation, ProjectionRun and exception identifiers plus every affected canonical Event.

Updates, cancellations and withdrawals remain a separate later decision.
