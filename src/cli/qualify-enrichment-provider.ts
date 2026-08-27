import { readFile } from 'node:fs/promises';
import {
  EnrichmentQualificationFixtureSchema,
  qualifyEnrichmentProvider,
} from '../enrichment/qualification.js';

async function main(): Promise<void> {
  const fixturePath = process.argv[2];
  if (!fixturePath) {
    throw new Error('Usage: npm run enrichment:qualify -- <reviewed-fixture.json>');
  }
  const fixture = EnrichmentQualificationFixtureSchema.parse(
    JSON.parse(await readFile(fixturePath, 'utf8')),
  );
  const report = qualifyEnrichmentProvider(fixture.cases);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: fixture.schemaVersion,
    providerId: fixture.providerId,
    capturedAt: fixture.capturedAt,
    adjudicatedAt: fixture.adjudicatedAt,
    adjudicatedBy: fixture.adjudicatedBy,
    report,
  }, null, 2)}\n`);
  if (!report.qualified) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
