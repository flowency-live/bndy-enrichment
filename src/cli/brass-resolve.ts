import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveBrassBandIdentity } from '../brass/resolve-band.js';
import { buildBrassBandProjection } from '../brass/projection.js';
import type { BrassBandIdentityCandidate } from '../brass/types.js';

interface BootstrapFile {
  identities: BrassBandIdentityCandidate[];
}

interface ResolvedRow {
  candidate: BrassBandIdentityCandidate;
  resolved?: Awaited<ReturnType<typeof resolveBrassBandIdentity>>;
  projection?: ReturnType<typeof buildBrassBandProjection>;
  error?: string;
}

function args() {
  const values = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < values.length; i += 1) {
    if (!values[i].startsWith('--')) continue;
    out[values[i].slice(2)] = values[i + 1] ?? '';
    i += 1;
  }
  return out;
}

async function main() {
  const options = args();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Set GEMINI_API_KEY');

  const inputPath = resolve(process.cwd(), options.input || 'brass-bootstrap-2026.json');
  const outputPath = resolve(process.cwd(), options.out || 'brass-resolved-2026.json');
  const limit = Math.max(1, Number(options.limit || 25));
  const offset = Math.max(0, Number(options.offset || 0));
  const minObservationConfidence = Number(options['min-candidate-confidence'] || 0.78);

  const bootstrap = JSON.parse(await readFile(inputPath, 'utf8')) as BootstrapFile;
  const selected = bootstrap.identities
    .filter((candidate) => candidate.confidence >= minObservationConfidence)
    .slice(offset, offset + limit);

  let existing: { rows?: ResolvedRow[] } = {};
  try {
    existing = JSON.parse(await readFile(outputPath, 'utf8'));
  } catch {
    // First run.
  }
  const byCandidate = new Map((existing.rows ?? []).map((row) => [row.candidate.canonicalName.toLowerCase(), row]));

  for (const candidate of selected) {
    const key = candidate.canonicalName.toLowerCase();
    if (byCandidate.get(key)?.resolved) {
      console.log(`skip ${candidate.canonicalName}: already resolved`);
      continue;
    }

    try {
      console.log(`resolve ${candidate.canonicalName}`);
      const resolved = await resolveBrassBandIdentity(candidate, {
        apiKey,
        model: process.env.GEMINI_MODEL,
      });
      const projection = buildBrassBandProjection(candidate, resolved);
      byCandidate.set(key, { candidate, resolved, projection });
      console.log(`  ${resolved.officialName}: confidence=${resolved.identityConfidence.toFixed(2)} publishable=${projection.publishable}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      byCandidate.set(key, { candidate, error: message });
      console.error(`  failed: ${message}`);
    }

    await writeFile(outputPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      edition: 'brass',
      mode: 'resolution-and-projection-only',
      canonicalWrites: false,
      rows: [...byCandidate.values()],
    }, null, 2), 'utf8');
  }

  const rows = [...byCandidate.values()];
  const successful = rows.filter((row) => row.resolved);
  const publishable = rows.filter((row) => row.projection?.publishable);
  const held = rows.filter((row) => row.projection && !row.projection.publishable);
  console.log(`Wrote ${outputPath}`);
  console.log(`resolved=${successful.length} publishable=${publishable.length} held=${held.length} errors=${rows.filter((row) => row.error).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
