import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BRASS_2026_IDENTITY_SOURCES } from '../brass/sources';
import { fetchAndParse4BarsRestSource } from '../brass/parse-4barsrest';
import { groupExactIdentityCandidates, proposeAliasCandidates } from '../brass/identity';

async function main() {
  const observations = [];
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

  const outputPath = resolve(process.cwd(), process.argv[2] || 'brass-bootstrap-2026.json');
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Wrote ${outputPath}`);

  if (errors.length === BRASS_2026_IDENTITY_SOURCES.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
