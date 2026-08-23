import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BRASS_2026_IDENTITY_SOURCES } from '../brass/sources.js';
import { fetchAndParse4BarsRestSource } from '../brass/parse-4barsrest.js';
import { groupExactIdentityCandidates, proposeAliasCandidates } from '../brass/identity.js';
import type { BrassBandObservation } from '../brass/types.js';

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
  const observations: BrassBandObservation[] = [];
  const errors: Array<{ sourceId: string; error: string }> = [];

  for (const source of [...BRASS_2026_IDENTITY_SOURCES].sort((a, b) => b.priority - a.priority)) {
    try {
      const rows = await fetchAndParse4BarsRestSource(source);
      observations.push(...rows);
      console.log(`${source.id}: ${rows.length} observations`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ sourceId: source.id, error: message });
      console.error(`${source.id}: ${message}`);
    }
  }

  const identities = groupExactIdentityCandidates(observations);
  const aliasProposals = proposeAliasCandidates(identities);
  const output = {
    generatedAt: new Date().toISOString(),
    edition: 'brass',
    policy: 'evidence-only; no canonical writes',
    sourceCount: BRASS_2026_IDENTITY_SOURCES.length,
    successfulSourceCount: BRASS_2026_IDENTITY_SOURCES.length - errors.length,
    observationCount: observations.length,
    exactIdentityCount: identities.length,
    aliasProposalCount: aliasProposals.length,
    errors,
    observations,
    identities,
    aliasProposals,
  };

  const outputPath = resolve(process.cwd(), options.out || 'brass-bootstrap-2026.json');
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Wrote ${outputPath}`);

  if (errors.length === BRASS_2026_IDENTITY_SOURCES.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
