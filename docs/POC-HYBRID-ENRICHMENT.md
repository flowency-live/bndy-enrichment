# POC: Hybrid Enrichment Pipeline (SerpAPI + Haiku)

**Date:** 20 August 2026
**Status:** Proof of Concept
**Author:** CTO Session

> **Scope / authority boundary.** This document is a tactical cost-optimisation POC for the **existing enrichment engine**. It does not define BNDY target architecture and must not override or fork `docs/TARGET-ARCHITECTURE.md` or `docs/BUILD-PLAN.md`. The strategic programme remains the Observation/Claim/Reconciliation architecture in those documents. Any technique proved here may later be absorbed into that architecture, primarily through the model/search provider and routing work in WP-15.

## Two active workstreams in this repository

The repository currently contains two deliberately separate threads:

1. **Strategic build:** `TARGET-ARCHITECTURE.md` + `BUILD-PLAN.md`. This consolidates source ingestion, Capture, claims, reconciliation, source adapters and the future knowledge graph into one runtime.
2. **Cost POC:** this document + `src/serpapi/` + `src/hybrid/`. This asks a narrower question: *can the existing working enrichment capability be made dramatically cheaper without materially reducing quality?*

Rules for this POC:

- it may reuse today's `DiscoveryResult` and legacy write-back path purely to make an apples-to-apples quality/cost comparison;
- it must not introduce a second strategic orchestration, source registry, claim model or target-state write path;
- production rollout is not implied by POC success;
- if adopted strategically, SerpAPI/Haiku become provider implementations behind the target intelligence/model abstraction rather than a parallel pipeline;
- the existing Gemini path remains the quality baseline during evaluation;
- no change made for this POC should regress the currently working Capture/poster/Facebook enrichment behaviour.

---

## Problem Statement

The current Gemini-based enrichment pipeline costs **~£0.51 per artist** due to Google's Search Grounding API pricing. At this rate:

- 1,000 artists = £510
- The initial batch of ~1,100 artists without Facebook URLs exhausted £80 of credits after only ~158 artists

This cost is unsustainable for ongoing enrichment of grassroots artists.

## Alternative Approaches Considered

| Approach | Est. Cost/Artist | Quality | Notes |
|----------|------------------|---------|-------|
| Gemini + Search Grounding | £0.51 | High | Current production. Too expensive. |
| Two-stage (SerpAPI + Haiku) | £0.008-0.012 | Medium-High | This POC |
| Perplexity API | £0.03-0.08 | Medium | Lacks grounding citations |
| Direct API lookups (MusicBrainz, Spotify) | Free | N/A | Invalid for grassroots music |
| Facebook Graph API | Free | High for FB | Requires App Review approval |

## This POC: SerpAPI + Claude Haiku

A two-stage pipeline that separates search from reasoning:

### Stage 1: SerpAPI Google Search (~$0.005/search)
- Search for `"{artist name}" "{town}" site:facebook.com`
- Search for `"{artist name}" "{town}" band` (general results)
- Extract candidate Facebook URLs and official websites from results

### Stage 2: Claude Haiku Validation (~$0.00025/call)
- Validate if candidate Facebook page matches the artist
- Extract bio, genres, artist type from search snippets
- Confidence scoring

### Total Cost
- 2 SerpAPI searches: $0.01
- 2-3 Haiku calls: $0.0005-0.00075
- **Total: ~$0.01-0.015 per artist (~£0.008-0.012)**

This is **40-60x cheaper** than Gemini with Search Grounding.

## Files Created

```
src/serpapi/
  client.ts          # SerpAPI Google Search client

src/hybrid/
  scorer.ts          # Claude Haiku confidence scorer
  discover.ts        # Main hybrid discovery function

src/cli/
  search-hybrid.ts   # CLI for testing
```

## Usage

```bash
# Set environment variables
export SERPAPI_KEY=xxx          # Get from https://serpapi.com/
export ANTHROPIC_API_KEY=xxx    # Your Anthropic key

# Test single artist
npx tsx src/cli/search-hybrid.ts --name "Artist Name" --town "Location"

# Compare with Gemini (requires GEMINI_API_KEY)
npx tsx src/cli/search-hybrid.ts --name "Artist Name" --town "Location" --compare
```

## SerpAPI Pricing

- Free tier: 100 searches/month
- Paid: $50 for 5,000 searches ($0.01/search)
- With our 2 searches per artist: 2,500 artists per $50

## Quality Trade-offs

### What we lose vs Gemini:
- No live page content fetching (relies on search snippets)
- Less rich bio extraction
- No multimodal analysis (can't read FB page images)

### What we gain:
- 40-60x cost reduction
- Faster processing (no complex grounding)
- More predictable costs
- Can scale to full artist database

## Evaluation contract

The POC is successful only if it demonstrates both **cost reduction and acceptable output parity** against the current Gemini path.

For each comparison artist, record at minimum:

- Gemini result;
- hybrid result;
- canonical Facebook URL match correctness;
- artist identity correctness;
- location correctness;
- artist type / act type correctness where available;
- bio/genre usefulness where available;
- false-positive and false-negative differences;
- search/model calls used;
- measured or calculated cost;
- latency.

A cheaper result that materially increases wrong-artist matches is a failed POC regardless of nominal confidence score.

## Recommended Next Steps

1. **Test quality** on 20-30 artists from the existing intake files, deliberately including easy, ambiguous and sparse grassroots acts.
2. **Compare results** with the Gemini enrichments we already have using the evaluation contract above.
3. If quality is acceptable, determine the cheapest routing strategy rather than immediately replacing Gemini everywhere.
4. Only after that decision, consider a `HybridDiscoveryWorker` or provider integration.
5. Consider **Facebook Graph API** integration for verified FB URL validation if App Review provides useful access.

## Integration with Existing Pipeline

This POC outputs `HybridDiscoveryResult` which can be converted to `DiscoveryResult` via `toDiscoveryResult()`. This allows:

- Direct comparison with Gemini results
- Temporary reuse of existing `writeEnrichmentToEntity` write-back logic for POC parity testing
- Minimal disturbance to the working current pipeline while the experiment runs

**Important:** `writeEnrichmentToEntity` is a legacy/as-built compatibility path, not the strategic destination. If the hybrid approach is adopted into the target architecture, its output should become an `Interpretation` / Claims input and canonical mutations should continue through the target reconciliation/projection path defined by `TARGET-ARCHITECTURE.md` and `BUILD-PLAN.md`.

## Strategic absorption path

If the POC succeeds, port the useful pieces rather than the POC pipeline itself:

```text
SerpAPI search provider ─┐
                        ├─> WP-15 provider/routing layer
Haiku reasoning provider┘
              ↓
Extraction / Interpretation
              ↓
Claims
              ↓
Reconciliation / Projection
```

Likely retained components:

- SerpAPI client/search strategy;
- Haiku provider/scoring prompts where they outperform on cost/quality;
- quality/cost benchmark fixtures;
- provider-level metrics;
- routing rules such as cheap-first then Gemini escalation.

Likely retired after strategic absorption:

- a standalone `HybridDiscoveryWorker` if the generic provider/runtime can perform the same job;
- any POC-only direct-write glue;
- duplicate routing/orchestration that overlaps WP-15.

## Decision Required

Before scaling this POC:

1. Run quality comparison on real artists.
2. Quantify accuracy by field and wrong-identity rate, not just an aggregate confidence score.
3. Decide the escalation/routing threshold at which Gemini remains worthwhile.
4. Decide whether the hybrid method is a bulk-enrichment tier, the default cheap tier, or merely another provider option.

The hybrid pipeline may be best suited for:
- Initial bulk enrichment (cost-sensitive)
- Artists without Facebook (lower expectations)
- Re-enrichment campaigns

Gemini may remain better for:
- High-value artists (with upcoming events)
- Cases where deep page analysis is needed
- Poster/multimodal cases
- Ambiguous identity cases where grounded search materially improves confidence
