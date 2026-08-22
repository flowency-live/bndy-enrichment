import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveBrassBandIdentity } from '../brass/resolve-band.js';
import { resolveViaBrassBandResults } from '../brass/brass-band-results.js';
import { buildBrassBandProjection } from '../brass/projection.js';
import type { BrassBandIdentityCandidate } from '../brass/types.js';
import type { ResolvedBrassBand } from '../brass/resolve-band.js';

interface BootstrapFile {
  identities: BrassBandIdentityCandidate[];
}

interface ResolvedRow {
  candidate: BrassBandIdentityCandidate;
  resolved?: ResolvedBrassBand;
  resolutionMethod?: 'brass_band_results' | 'gemini_search';
  projection?: ReturnType<typeof buildBrassBandProjection>;
  error?: string;
}

function args() {
  const values = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = values[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

async function resolveCandidate(candidate: BrassBandIdentityCandidate, allowGemini: boolean): Promise<{ resolved: ResolvedBrassBand; method: ResolvedRow['resolutionMethod'] }> {
  const free = await resolveViaBrassBandResults(candidate);
  if (free) return { resolved: free, method: 'brass_band_results' };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!allowGemini || !apiKey) {
    throw new Error('No deterministic Brass Band Results match. Gemini fallback unavailable/disabled.');
  }

  const resolved = await resolveBrassBandIdentity(candidate, {
    apiKey,
    model: process.env.GEMINI_MODEL,
  });
  return { resolved, method: 'gemini_search' };
}

async function main() {
  const options = args();
  const inputPath = resolve(process.cwd(), options.input || 'brass-bootstrap-2026.json');
  const outputPath = resolve(process.cwd(), options.out || 'brass-resolved-2026.json');
  const limit = Math.max(1, Number(options.limit || 25));
  const offset = Math.max(0, Number(options.offset || 0));
  const concurrency = Math.min(16, Math.max(1, Number(options.concurrency || 8)));
  const minObservationConfidence = Number(options['min-candidate-confidence'] || 0.78);
  const allowGemini = options['gemini-fallback'] === 'true';

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
  const queue = selected.filter((candidate) => !byCandidate.get(candidate.canonicalName.toLowerCase())?.resolved);

  let cursor = 0;
  let persistChain = Promise.resolve();
  const persist = () => {
    persistChain = persistChain.then(() => writeFile(outputPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      edition: 'brass',
      mode: 'resolution-and-projection-only',
      canonicalWrites: false,
      freeResolver: 'brassbandresults.co.uk',
      geminiFallbackAvailable: Boolean(process.env.GEMINI_API_KEY),
      rows: [...byCandidate.values()],
    }, null, 2), 'utf8'));
    return persistChain;
  };

  async function worker(workerId: number) {
    while (true) {
      const index = cursor++;
      const candidate = queue[index];
      if (!candidate) return;
      const key = candidate.canonicalName.toLowerCase();

      try {
        console.log(`[${workerId}] resolve ${candidate.canonicalName}`);
        const { resolved, method } = await resolveCandidate(candidate, allowGemini);
        const projection = buildBrassBandProjection(candidate, resolved);
        byCandidate.set(key, { candidate, resolved, resolutionMethod: method, projection });
        console.log(`[${workerId}]   ${resolved.officialName}: method=${method} confidence=${resolved.identityConfidence.toFixed(2)} publishable=${projection.publishable}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        byCandidate.set(key, { candidate, error: message });
        console.error(`[${workerId}]   failed ${candidate.canonicalName}: ${message}`);
      }
      await persist();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, queue.length)) }, (_, index) => worker(index + 1)));
  await persistChain;

  const rows = [...byCandidate.values()];
  const successful = rows.filter((row) => row.resolved);
  const publishable = rows.filter((row) => row.projection?.publishable);
  const held = rows.filter((row) => row.projection && !row.projection.publishable);
  const freeResolved = rows.filter((row) => row.resolutionMethod === 'brass_band_results');
  const geminiResolved = rows.filter((row) => row.resolutionMethod === 'gemini_search');
  console.log(`Wrote ${outputPath}`);
  console.log(`resolved=${successful.length} free=${freeResolved.length} gemini=${geminiResolved.length} publishable=${publishable.length} held=${held.length} errors=${rows.filter((row) => row.error).length} concurrency=${concurrency}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
