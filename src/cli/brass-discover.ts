import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { discoverWithGemini } from '../google/gemini.js';
import { applyBrassDiscoveryPolicy } from '../brass/discovery-policy.js';
import type { BrassBandProjectionPackage } from '../brass/projection.js';

interface ResolvedFile {
  rows: Array<{
    projection?: BrassBandProjectionPackage;
    error?: string;
  }>;
}

interface DiscoveryRow {
  proposedBandId: string;
  bandName: string;
  result?: ReturnType<typeof applyBrassDiscoveryPolicy>;
  error?: string;
}

function cliArgs() {
  const values = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (let i = 0; i < values.length; i += 1) {
    if (!values[i].startsWith('--')) continue;
    result[values[i].slice(2)] = values[i + 1] ?? '';
    i += 1;
  }
  return result;
}

async function main() {
  const args = cliArgs();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Set GEMINI_API_KEY');

  const inputPath = resolve(process.cwd(), args.input || 'brass-resolved-2026.json');
  const outputPath = resolve(process.cwd(), args.out || 'brass-discovery-2026.json');
  const horizonDays = Math.max(1, Number(args.days || process.env.BRASS_SEARCH_HORIZON_DAYS || 365));
  const limit = Math.max(1, Number(args.limit || 25));
  const offset = Math.max(0, Number(args.offset || 0));

  const resolved = JSON.parse(await readFile(inputPath, 'utf8')) as ResolvedFile;
  const candidates = resolved.rows
    .map((row) => row.projection)
    .filter((projection): projection is BrassBandProjectionPackage => !!projection?.publishable)
    .slice(offset, offset + limit);

  let existing: { rows?: DiscoveryRow[] } = {};
  try {
    existing = JSON.parse(await readFile(outputPath, 'utf8'));
  } catch {
    // First run.
  }
  const rows = new Map((existing.rows ?? []).map((row) => [row.proposedBandId, row]));

  for (const projection of candidates) {
    if (rows.get(projection.proposedId)?.result) {
      console.log(`skip ${projection.record.name}: already discovered`);
      continue;
    }

    try {
      console.log(`discover ${projection.record.name}`);
      const result = await discoverWithGemini({
        type: 'artist',
        bndyId: projection.proposedId,
        name: projection.record.name,
        town: projection.record.domainProfiles.brass.town,
        region: projection.record.domainProfiles.brass.county,
      }, {
        apiKey,
        model: process.env.GEMINI_MODEL,
        horizonDays,
      });
      const brass = applyBrassDiscoveryPolicy(result);
      rows.set(projection.proposedId, {
        proposedBandId: projection.proposedId,
        bandName: projection.record.name,
        result: brass,
      });
      console.log(`  events=${brass.events.length} held=${brass.heldEvents.length} expand=${brass.expansionEligibleEvents.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rows.set(projection.proposedId, {
        proposedBandId: projection.proposedId,
        bandName: projection.record.name,
        error: message,
      });
      console.error(`  failed: ${message}`);
    }

    await writeFile(outputPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      edition: 'brass',
      mode: 'concert-discovery-only',
      canonicalWrites: false,
      horizonDays,
      rows: [...rows.values()],
    }, null, 2), 'utf8');
  }

  const outputRows = [...rows.values()];
  const totalEvents = outputRows.reduce((sum, row) => sum + (row.result?.events.length ?? 0), 0);
  const expansionEvents = outputRows.reduce((sum, row) => sum + (row.result?.expansionEligibleEvents.length ?? 0), 0);
  console.log(`Wrote ${outputPath}`);
  console.log(`bands=${outputRows.length} events=${totalEvents} expansionEligible=${expansionEvents} errors=${outputRows.filter((row) => row.error).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
