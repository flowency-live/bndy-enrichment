# Interactions evidence-first qualification contract

Status: approved run pending capture
Approved by: Jason (Product Owner/CTO), 2026-08-29, in the CTO working session
Provider under test: `gemini-interactions-evidence-first-v1` (inactive)

This is remaining-work item 3 of BACKLINE-TRUST-LAYER-TECHNICAL-STATUS-2026-08-29:
the full qualification contract for the approved 20-case cohort run. It binds
what the run may do, what must be recorded per case, and what passing means.
It does not activate the provider, create any schedule or authorise any
canonical write.

## Approved run parameters

| Parameter | Value |
| --- | --- |
| Cases | 20 (the existing 10 Artist + 10 Venue Trust Loop cohort, unchanged) |
| Model calls | Exactly one per case |
| Search budget | One to two Google Search grounding queries per case |
| Per-case reserved cost | $0.05 |
| Total reserved cost | $1.50 (hard stop before any case that could breach it) |
| Canonical writes | 0, structurally enforced |
| Output | `ops/enrichment/gemini-interactions-evidence-first-20-case-unreviewed.json`, one-shot |
| Runner | `npm run trust-loop:qualify-interactions-evidence-first` via the dispatch-gated workflow |

An unmeasured case is charged its full $0.05 reservation: missing usage data
must never create budget headroom.

## Per-case record (all mandatory)

1. Exact identity outcome and reason (confidence, or 0 with the exact failure).
2. Requested predicates for the case's entity type.
3. Every admitted fact and every rejected fact with its rejection reason.
4. Exact fact-to-citation mapping: the FACT line character range and the
   provider `url_citation` whose END offset falls inside it (PR 116 binding).
5. Provider citation URLs, immutable, plus their safely resolved public
   destinations via `resolveCitationDestination` where resolution succeeds;
   failed resolution is recorded failed-closed and never blocks retention of
   the provider URL.
6. Measured searches, model calls, input/output tokens, duration and cost.
7. Abstention quality: expected-park cases must return identity confidence
   below 0.98 with no admitted facts.
8. Any false match or wrong official link, verbatim.
9. Explicit no-official-presence outcomes where found.
10. The complete raw provider response.

## Hard gates for a QUALIFIED verdict

- Zero confident false identities across all 20 cases.
- Zero wrong official URLs admitted as facts.
- At least 80 per cent requested-predicate coverage where the answer is
  knowable, measured on expected-match cases only. Expected-park cases never
  count towards coverage.
- Every expected-park case actually parks.
- Every admitted fact carries a provider segment citation.
- Run stays inside the $1.50 reservation.

Any single breach fails the provider for this cohort. A failed provider may be
re-run only under a fresh approval.

## After capture

1. Human adjudication of all 20 identities and every admitted fact, recorded
   as a review artefact beside the capture.
2. Read-only publication of the outcome to Godmode.
3. Workboard update.
4. Only then a qualified/failed label. A qualified label still authorises
   neither scheduling nor canonical projection; those remain separate gates
   per docs/ENRICHMENT-PROVIDER-QUALIFICATION.md.
