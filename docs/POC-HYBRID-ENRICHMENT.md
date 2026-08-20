# POC: Hybrid Enrichment Pipeline (SerpAPI + Haiku)

**Date:** 20 August 2026
**Status:** Proof of Concept
**Author:** CTO Session

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

## Recommended Next Steps

1. **Test quality** on 20-30 artists from the existing intake files
2. **Compare results** with the Gemini enrichments we already have
3. If quality is acceptable:
   - Add a `HybridDiscoveryWorker` Lambda handler
   - Create a hybrid queue alongside the Google queue
   - Route based on cost/quality requirements
4. Consider **Facebook Graph API** integration for verified FB URL validation (requires App Review)

## Integration with Existing Pipeline

This POC outputs `HybridDiscoveryResult` which can be converted to `DiscoveryResult` via `toDiscoveryResult()`. This allows:

- Direct comparison with Gemini results
- Use of existing `writeEnrichmentToEntity` write-back logic
- Gradual migration without pipeline changes

## Decision Required

Before scaling this POC:

1. Run quality comparison on real artists
2. Decide acceptable confidence threshold
3. Determine if hybrid should replace Gemini or supplement it

The hybrid pipeline may be best suited for:
- Initial bulk enrichment (cost-sensitive)
- Artists without Facebook (lower expectations)
- Re-enrichment campaigns

Gemini may remain better for:
- High-value artists (with upcoming events)
- Cases where deep page analysis is needed
- When budget allows
