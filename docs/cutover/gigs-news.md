# GigsNews WP-11 parity and cutover checklist

**Source:** `gigs-news-daily-import`  
**Target adapter:** `gigs-news`  
**Donor runtime:** `flowency-live/bndy-signals`  
**Cutover owner:** Jason only  
**Rule:** never allow Cowork and AWS to write production for this source at the same time.

## Current state

- AWS source config bootstrap remains `enabled: false`, `shadow: true`, `writerAuthority: cowork`.
- Cowork remains the production writer until every Gate B check below passes and Jason performs the cutover window.
- The AWS adapter is browser-only and consumes rendered `body.innerText`.

## Gate A: identical-evidence fixture parity

- [x] Stored raw evidence fixture exists: `test/fixtures/gigs-news/production-innertext.txt`.
- [x] Donor golden artifact records exact donor parser/normaliser blob SHAs: `test/fixtures/gigs-news/gate-a.donor.json`.
- [x] Target and donor evidence SHA-256 must match before output comparison.
- [x] Normalised event rows compare by stable `sourceEventKey`.
- [x] Identity inputs compare independently: artist source ID/name/location and venue source ID/name/location/address.
- [x] Parked/exception reason counts compare.
- [x] Harness supports added/updated/unchanged/withdrawn candidate comparison when a prior snapshot is supplied.
- [x] Any intentional rule change must be named explicitly as `EXPECTED_RULE_CHANGE`; undocumented differences fail the gate.
- [ ] Capture one fresh Cowork raw snapshot + donor output artifact and replay that exact raw evidence through AWS before Gate B. Do not substitute two separately fetched pages for this check.

Command for two saved parity artifacts:

```bash
npm run source:parity -- --expected donor.json --actual aws.json
```

A non-zero exit means a material parity difference exists.

## Gate B: live shadow parity

Run Cowork and AWS close together in time, but AWS must remain non-writing (`shadow: true`, `writerAuthority: cowork`). For each run record:

| Run | Cowork timestamp | AWS timestamp | Evidence hash | Output parity | Differences classified | Result |
|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  | PENDING |
| 2 |  |  |  |  |  | PENDING |
| 3 |  |  |  |  |  | PENDING |

Allowed classification vocabulary:

- `INPUT_DIFFERENCE`
- `EXPECTED_RULE_CHANGE`
- `IDENTITY_DIFFERENCE`
- `PROJECTION_DIFFERENCE`
- `DEFECT`

Gate B passes only after **three consecutive runs with no unexplained material difference**. Different evidence hashes do not prove implementation drift; classify them as `INPUT_DIFFERENCE` and compare what can still be compared.

## Cutover window: Jason only

Do not execute this section from an agent or automated PR.

1. Confirm Gate A complete and Gate B has three consecutive passes.
2. Confirm AWS source is still `shadow: true`, `writerAuthority: cowork` before the window starts.
3. Disable the Cowork GigsNews schedule.
4. Confirm no Cowork run is still executing.
5. In the Source Registry set `writerAuthority: aws` and `shadow: false`; enable/schedule the AWS source only in this same controlled window.
6. Trigger/observe the first AWS live run.
7. Verify every canonical mutation by the ProjectionWorker read-back records and ProjectionRun report.
8. Confirm no dual-writer run occurred.

## Rollback

1. Set AWS GigsNews back to `writerAuthority: cowork`, `shadow: true` and disable its production schedule.
2. Confirm AWS has no live writer execution in flight.
3. Re-enable the Cowork schedule.
4. Record the reason and affected Observation/ProjectionRun IDs.

Cowork may subsequently run as a non-writing shadow confidence check, but never as a second production writer.
