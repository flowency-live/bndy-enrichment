# Canonical BNDY → Backline baseline

The canonical BNDY corpus baseline is a one-way, shadow-only bootstrap from the current product projection into the BNDY Backline knowledge substrate.

## Purpose

Snapshot every canonical BNDY Artist, Venue, Event and Festival into Backline so the intelligence layer can account for the product state that existed before source-native Backline ingestion became authoritative.

Physical canonical tables:

- `bndy-artists`
- `bndy-venues`
- `bndy-events`

Festivals are logical `entityType: festival` records in `bndy-events`.

## Semantics

For each canonical entity the bootstrap creates:

1. immutable private JSON evidence in the existing Backline EvidenceBucket;
2. one `SourceObservation`;
3. atomised `KnowledgeClaim` rows for every non-null stored field;
4. semantic Claims where the mapping is unambiguous;
5. a `resolvesTo` Claim;
6. an `EntityResolution` with confidence `1.0` back to the same canonical BNDY ID.

Confidence `1.0` means only that **BNDY currently stores this assertion about this canonical entity**. It does not promote legacy BNDY data into independently verified real-world truth.

Where a canonical record contains a recoverable `source` label, that label is retained as provenance metadata. Where original provenance cannot be recovered, each field is explicitly classified as `bndy-legacy-canonical`. No external provenance is invented.

Ownership, protection state, stable IDs, external IDs and other stored fields are retained as atomised baseline Claims even where Backline has no current semantic predicate for them.

## Safety

The bootstrap deliberately has no ProjectionQueue or canonical API write path.

```text
canonical BNDY tables
        ↓ read only
private evidence
        ↓
Observations
        ↓
Claims
        ↓
EntityResolution → existing canonical ID
```

It must always report:

```json
{
  "shadow": true,
  "canonicalWritesEnabled": false
}
```

## Run

```bash
STATE_TABLE=<backline-state-table> \
EVIDENCE_BUCKET=<backline-evidence-bucket> \
npm run bndy:baseline -- \
  --snapshot-id=bndy-baseline-2026-08-24-v1 \
  --snapshot-at=2026-08-24T07:00:00.000Z \
  --confirm=WRITE_BACKLINE_CANONICAL_BASELINE
```

The snapshot ID, timestamp and exact confirmation are mandatory. The CLI also reads the live global projection control before its first write and fails closed if canonical writes are enabled. This protects the command boundary but does not replace explicit HITL approval or infrastructure-owner execution.

The command is resumable. Observations and Claims are content-addressed so a changed canonical record encountered during a resumed run creates new immutable evidence rather than overwriting an earlier observation.

A completed run writes `BASELINE#<snapshotId> / META` with exact logical-entity, observation, Claim, Resolution and evidence counts.

The baseline is not the ongoing sync mechanism. See `CANONICAL-CONTINUOUS-HYDRATION.md` for the content-delta catch-up and opt-in DynamoDB stream path that captures canonical changes made after this snapshot.
