#!/usr/bin/env npx tsx
/**
 * Push entities to the enrichment pipeline.
 * Invokes the ScanPlanner Lambda with entities from a JSON file.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { readFile } from 'fs/promises';

const lambda = new LambdaClient({ region: 'eu-west-2' });

const SCAN_PLANNER_FUNCTION = 'BndyEnrichmentStack-ScanPlannerBC522289-D9WXLIcdx9Wi';

interface SearchEntity {
  type: 'artist' | 'venue';
  bndyId: string;
  name: string;
  town?: string;
  facebookUrl?: string;
  officialWebsite?: string;
}

interface PushOptions {
  inputFile: string;
  limit?: number;
  offset?: number;
  force: boolean;
  dryRun: boolean;
}

async function push(options: PushOptions): Promise<void> {
  console.log(`\n📂 Reading entities from ${options.inputFile}...`);

  const content = await readFile(options.inputFile, 'utf-8');
  let entities: SearchEntity[] = JSON.parse(content);

  console.log(`  Total entities in file: ${entities.length}`);

  // Apply offset and limit
  if (options.offset) {
    entities = entities.slice(options.offset);
    console.log(`  After offset (${options.offset}): ${entities.length}`);
  }
  if (options.limit) {
    entities = entities.slice(0, options.limit);
    console.log(`  After limit (${options.limit}): ${entities.length}`);
  }

  const artists = entities.filter(e => e.type === 'artist');
  const venues = entities.filter(e => e.type === 'venue');

  console.log(`\n📋 Batch summary:`);
  console.log(`  Artists: ${artists.length}`);
  console.log(`  Venues: ${venues.length}`);
  console.log(`  Total: ${entities.length}`);
  console.log(`  Force (ignore suppression): ${options.force}`);

  if (options.dryRun) {
    console.log(`\n🔍 DRY RUN - would invoke ScanPlanner with ${entities.length} entities`);
    console.log(`\nFirst 3 entities:`);
    console.log(JSON.stringify(entities.slice(0, 3), null, 2));
    return;
  }

  console.log(`\n🚀 Invoking ScanPlanner Lambda...`);

  const response = await lambda.send(new InvokeCommand({
    FunctionName: SCAN_PLANNER_FUNCTION,
    Payload: JSON.stringify({
      entities,
      force: options.force,
    }),
  }));

  if (response.FunctionError) {
    console.error(`\n❌ Lambda error: ${response.FunctionError}`);
    const payload = response.Payload ? Buffer.from(response.Payload).toString() : '';
    console.error(payload);
    process.exit(1);
  }

  const result = response.Payload ? JSON.parse(Buffer.from(response.Payload).toString()) : {};

  console.log(`\n✅ ScanPlanner response:`);
  console.log(`  Supplied: ${result.supplied}`);
  console.log(`  Queued: ${result.queued}`);
  console.log(`  Suppressed: ${result.suppressed}`);

  if (result.queued > 0) {
    console.log(`\n⏳ ${result.queued} entities queued for enrichment.`);
    console.log(`   Results will appear in godmode within a few minutes.`);
    console.log(`   Check: enrichment_status='needs_review' in bndy-artists/bndy-venues`);
  }
}

// Parse CLI args
const args = process.argv.slice(2);
const options: PushOptions = {
  inputFile: '',
  force: false,
  dryRun: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--limit' && args[i + 1]) {
    options.limit = parseInt(args[++i], 10);
  } else if (arg === '--offset' && args[i + 1]) {
    options.offset = parseInt(args[++i], 10);
  } else if (arg === '--force') {
    options.force = true;
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: npx tsx src/cli/push-to-enrichment.ts <intake.json> [options]

Options:
  --limit <n>     Process only first N entities
  --offset <n>    Skip first N entities
  --force         Ignore suppression state (re-enrich suppressed entities)
  --dry-run       Show what would be sent without invoking Lambda
  --help, -h      Show this help

Examples:
  # Test with 5 entities
  npx tsx src/cli/push-to-enrichment.ts intake-50mi-28d.json --limit 5

  # Dry run to see what would be sent
  npx tsx src/cli/push-to-enrichment.ts intake-50mi-28d.json --dry-run

  # Push all entities
  npx tsx src/cli/push-to-enrichment.ts intake-50mi-28d.json

  # Push next batch (skip first 50, process next 50)
  npx tsx src/cli/push-to-enrichment.ts intake-50mi-28d.json --offset 50 --limit 50
`);
    process.exit(0);
  } else if (!arg.startsWith('--')) {
    options.inputFile = arg;
  }
}

if (!options.inputFile) {
  console.error('Error: No input file specified. Use --help for usage.');
  process.exit(1);
}

push(options).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
