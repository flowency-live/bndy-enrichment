#!/usr/bin/env npx tsx
/**
 * CLI for testing the hybrid SerpAPI + Haiku enrichment pipeline.
 *
 * Usage:
 *   SERPAPI_KEY=xxx ANTHROPIC_API_KEY=xxx npx tsx src/cli/search-hybrid.ts --name "Artist Name" --town "Location"
 *
 * Environment variables:
 *   SERPAPI_KEY - SerpAPI key (get from https://serpapi.com/)
 *   ANTHROPIC_API_KEY - Anthropic API key for Claude Haiku
 *
 * Options:
 *   --name <name>     Artist name (required)
 *   --town <town>     Artist location (optional but recommended)
 *   --id <id>         Entity ID (default: prototype)
 *   --out <file>      Write JSON output to file
 *   --compare         Also run Gemini pipeline for comparison (requires GEMINI_API_KEY)
 */

import fs from 'node:fs/promises';
import { SearchEntitySchema } from '../domain/schema.js';
import { discoverWithHybrid, toDiscoveryResult } from '../hybrid/discover.js';

function parseArgs(): Record<string, string> {
  const pairs = process.argv.slice(2)
    .map((v, i, a) => v.startsWith('--') ? [v.slice(2), a[i + 1] ?? 'true'] : null)
    .filter(Boolean) as [string, string][];
  return Object.fromEntries(pairs);
}

async function main() {
  const args = parseArgs();

  if (args.help === 'true' || !args.name) {
    console.log(`
Hybrid Enrichment POC - SerpAPI + Claude Haiku

Usage:
  SERPAPI_KEY=xxx ANTHROPIC_API_KEY=xxx npx tsx src/cli/search-hybrid.ts --name "Artist" [options]

Options:
  --name <name>     Artist name (required)
  --town <town>     Location (recommended for accuracy)
  --id <id>         Entity ID (default: prototype)
  --out <file>      Write JSON to file
  --compare         Compare with Gemini pipeline (requires GEMINI_API_KEY)
  --help            Show this help

Environment:
  SERPAPI_KEY        Your SerpAPI key
  ANTHROPIC_API_KEY  Your Anthropic API key

Cost Estimate:
  Hybrid: ~$0.01-0.015 per artist (~£0.008-0.012)
  Gemini: ~$0.65 per artist (~£0.51)

Example:
  SERPAPI_KEY=xxx ANTHROPIC_API_KEY=xxx npx tsx src/cli/search-hybrid.ts \\
    --name "The Midnight Runners" --town "Manchester"
`);
    process.exit(0);
  }

  const serpApiKey = process.env.SERPAPI_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!serpApiKey) {
    console.error('Error: Set SERPAPI_KEY environment variable');
    console.error('Get a key at https://serpapi.com/ (100 free searches/month)');
    process.exit(1);
  }

  if (!anthropicApiKey) {
    console.error('Error: Set ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  const entity = SearchEntitySchema.parse({
    type: 'artist',
    bndyId: args.id ?? 'prototype',
    name: args.name,
    town: args.town,
  });

  console.log(`\n🔍 Searching for: ${entity.name}${entity.town ? ` (${entity.town})` : ''}`);
  console.log('─'.repeat(60));

  const result = await discoverWithHybrid(entity, {
    serpApiKey,
    anthropicApiKey,
  });

  // Display results
  console.log(`\n📊 Results:`);
  console.log(`  Identity Confidence: ${(result.identityConfidence * 100).toFixed(0)}%`);
  console.log(`  Facebook: ${result.facebook.status}${result.facebook.url ? ` - ${result.facebook.url}` : ''}`);
  if (result.officialWebsite) console.log(`  Website: ${result.officialWebsite}`);
  if (result.bio) console.log(`  Bio: ${result.bio.slice(0, 100)}...`);
  if (result.genres.length > 0) console.log(`  Genres: ${result.genres.join(', ')}`);
  if (result.artistType) console.log(`  Artist Type: ${result.artistType}`);
  if (result.actTypes.length > 0) console.log(`  Act Types: ${result.actTypes.join(', ')}`);

  console.log(`\n📈 Metrics:`);
  console.log(`  Latency: ${result.metrics.latencyMs}ms`);
  console.log(`  SerpAPI searches: ${result.metrics.serpApiSearches}`);
  console.log(`  Haiku calls: ${result.metrics.haikuCalls}`);
  console.log(`  Estimated cost: $${result.metrics.estimatedCostUsd.toFixed(4)} (~£${(result.metrics.estimatedCostUsd * 0.79).toFixed(4)})`);

  console.log(`\n🔗 Evidence URLs:`);
  for (const url of result.evidenceUrls.slice(0, 5)) {
    console.log(`  - ${url}`);
  }

  // Compare with Gemini if requested
  if (args.compare === 'true') {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.warn('\n⚠️  --compare requires GEMINI_API_KEY to be set');
    } else {
      console.log('\n─'.repeat(60));
      console.log('🆚 Comparing with Gemini pipeline...\n');

      const { discoverWithGemini } = await import('../google/gemini.js');
      const geminiResult = await discoverWithGemini(entity, { apiKey: geminiKey });

      console.log(`Gemini Results:`);
      console.log(`  Identity Confidence: ${(geminiResult.identityConfidence * 100).toFixed(0)}%`);
      console.log(`  Facebook: ${geminiResult.entityEnrichment.facebook.status}`);
      if (geminiResult.entityEnrichment.facebook.url) {
        console.log(`    URL: ${geminiResult.entityEnrichment.facebook.url}`);
      }
      if (geminiResult.entityEnrichment.officialWebsite) {
        console.log(`  Website: ${geminiResult.entityEnrichment.officialWebsite}`);
      }
      if (geminiResult.entityEnrichment.artistProfile?.genres.length) {
        console.log(`  Genres: ${geminiResult.entityEnrichment.artistProfile.genres.join(', ')}`);
      }
      console.log(`\n  Latency: ${geminiResult.metrics.latencyMs}ms`);
      console.log(`  Search queries: ${geminiResult.metrics.searchQueries}`);

      console.log('\n📊 Comparison Summary:');
      console.log(`  | Metric         | Hybrid      | Gemini      |`);
      console.log(`  |----------------|-------------|-------------|`);
      console.log(`  | Confidence     | ${(result.identityConfidence * 100).toFixed(0).padStart(10)}% | ${(geminiResult.identityConfidence * 100).toFixed(0).padStart(10)}% |`);
      console.log(`  | FB Match       | ${result.facebook.status.padStart(11)} | ${geminiResult.entityEnrichment.facebook.status.padStart(11)} |`);
      console.log(`  | Latency        | ${(result.metrics.latencyMs + 'ms').padStart(11)} | ${(geminiResult.metrics.latencyMs + 'ms').padStart(11)} |`);
      console.log(`  | Est. Cost (£)  | ${('£' + (result.metrics.estimatedCostUsd * 0.79).toFixed(3)).padStart(11)} | ${('~£0.51').padStart(11)} |`);
    }
  }

  // Output JSON
  const output = {
    hybrid: result,
    discoveryResult: toDiscoveryResult(result),
  };

  if (args.out) {
    await fs.writeFile(args.out, JSON.stringify(output, null, 2));
    console.log(`\n✅ Wrote results to ${args.out}`);
  }

  console.log('\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
