# ADR-117: Evidence-gated entity creation for curated live sources

- Status: accepted
- Date: 05/09/2026
- Supersedes in part: ADR-113 (match-only stays available, no longer the only live policy)

## Context

The first live sources ran under `entityCreation: 'match-only'` (ADR-113). That was the
right first rule: it proved the write path without letting a scraper mint artists. It is
the wrong steady state. The KLMA bootstrap on 05/09/2026 projected 249 candidates and
recorded 106 unresolved-entity exceptions, most of them `likely-new`. Ethan Smith, a real
local act on a human-curated gig list, could not be added by the system that exists to
add him.

The same run produced 23 retryable failures that could never succeed: canonical refused
artist names such as `Troyen + Stonepit Drive` on data quality, and refused venues such
as `The Glebe Stoke` because Google Places resolved them to a road or a district.

## Decision

In the context of live projection from a curated source, facing artists and venues that
bndy does not yet hold, we decided for a third policy level, `entityCreation:
'evidence-gated'`, and against either keeping match-only or opening `allow` for every
source, to achieve creation only where the evidence and the authority justify it,
accepting that a human still decides every near-tie and every location conflict.

Under `evidence-gated`:

1. The venue is resolved first. The artist is only asked for, let alone created, once
   the venue is matched or has been created and verified through canonical Places.
2. Creation is allowed only when the source authority class is `curated`. Any other
   class behaves exactly as match-only under this policy.
3. Canonical's own guards remain in force: near-tie margins, same-name location
   conflicts and Places type checks all return `review` or `422`, never a record.
4. Every created artist or venue posts an enrichment job (already wired), so the
   enrichment worker (ADR-118) can attach public profiles or record that none exist.

A canonical `422` is a new handled exception class, `rejected-by-canonical`, carrying
the canonical code and message. It is never retried and never reaches the dead-letter
queue.

## Consequences

- KLMA moves to `evidence-gated`. OnTheCase stays match-only for one more observed day
  and then follows.
- Exceptions fall to the genuine human decisions: near-ties, location conflicts,
  malformed names the source should clean.
- Source adapters own name hygiene. Names carrying descriptions or several acts are the
  adapter's problem to split or park, not canonical's problem to reject.
- Godmode needs the exception index (backlog) to make the remaining decisions visible.
