import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BrassCanonicalApi } from '../brass/canonical-api.js';
import { consolidateBrassBandProjections } from '../brass/consolidate-projections.js';
import { applyReviewedLocationClaim } from '../brass/reviewed-location-claims.js';
import type { BrassBandProjectionPackage } from '../brass/projection.js';

interface ResolvedRow {
  projection?: BrassBandProjectionPackage;
  resolved?: { officialName?: string };
  error?: string;
}

interface ResolutionFile {
  rows?: ResolvedRow[];
}

interface WriteOutcome {
  proposedId?: string;
  bandName?: string;
  mode: 'plan' | 'commit';
  status: 'planned' | 'created' | 'matched' | 'held' | 'conflict' | 'failed';
  canonicalId?: string;
  message?: string;
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

function canonicalNameKey(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function readAllowlist(path?: string): Promise<Set<string> | null> {
  if (!path) return null;
  const text = await readFile(resolve(process.cwd(), path), 'utf8');
  const names = text
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map(canonicalNameKey);
  if (!names.length) throw new Error(`Allowlist ${path} contains no Band names`);
  return new Set(names);
}

async function main() {
  const options = args();
  const inputPath = resolve(process.cwd(), options.input || 'brass-resolved-2026.json');
  const outputPath = resolve(process.cwd(), options.out || 'brass-write-2026.json');
  const commit = options.commit === 'true';
  const limit = Math.max(1, Number(options.limit || (commit ? 10 : 1000)));
  const offset = Math.max(0, Number(options.offset || 0));
  const mapReadyOnly = options['map-ready-only'] === 'true';
  const allowlist = await readAllowlist(options.allowlist);

  if (commit && !allowlist) {
    throw new Error('Production brass writes require --allowlist <file>; bulk commit without an explicit reviewed Band list is disabled');
  }

  const input = JSON.parse(await readFile(inputPath, 'utf8')) as ResolutionFile;
  const rawProjections = (input.rows ?? []).map((row) => row.projection).filter((projection): projection is BrassBandProjectionPackage => Boolean(projection));
  const consolidated = consolidateBrassBandProjections(rawProjections).map(applyReviewedLocationClaim);
  const scopeEligible = mapReadyOnly
    ? consolidated.filter((projection) => Boolean(projection.record.domainProfiles.brass.postcode))
    : consolidated;
  const eligible = allowlist
    ? scopeEligible.filter((projection) => allowlist.has(canonicalNameKey(projection.record.name)))
    : scopeEligible;

  if (allowlist) {
    const found = new Set(eligible.map((projection) => canonicalNameKey(projection.record.name)));
    const missing = [...allowlist].filter((name) => !found.has(name));
    if (missing.length) throw new Error(`Allowlisted Bands not found in eligible projections: ${missing.join(', ')}`);
  }

  const projections = eligible.slice(offset, offset + limit);
  const api = commit ? new BrassCanonicalApi() : undefined;
  const outcomes: WriteOutcome[] = [];

  for (const projection of projections) {
    if (!projection.publishable) {
      outcomes.push({ proposedId: projection.proposedId, bandName: projection.record.name, mode: commit ? 'commit' : 'plan', status: 'held', message: projection.holdReasons.join(', ') });
      continue;
    }

    if (!commit) {
      const postcode = projection.record.domainProfiles.brass.postcode;
      outcomes.push({
        proposedId: projection.proposedId,
        bandName: projection.record.name,
        mode: 'plan',
        status: 'planned',
        message: `would POST brass-scoped Band to canonical Artist gate; aliases=${projection.record.name_variants.length}${postcode ? `; postcode=${postcode}; map-geocode=required` : ''}`,
      });
      continue;
    }

    try {
      const result = await api!.ensureBand(projection);
      outcomes.push({
        proposedId: projection.proposedId,
        bandName: projection.record.name,
        mode: 'commit',
        status: result.action,
        canonicalId: result.id,
        message: `publicationScopes=${JSON.stringify(result.publicationScopes)} matchedBy=${result.matchedBy ?? ''}${result.locationLat !== undefined && result.locationLng !== undefined ? ` coordinates=${result.locationLat},${result.locationLng}` : ''}`,
      });
      console.log(`${result.action} ${projection.record.name} -> ${result.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const conflict = message.startsWith('SCOPE_CONFLICT:');
      outcomes.push({ proposedId: projection.proposedId, bandName: projection.record.name, mode: 'commit', status: conflict ? 'conflict' : 'failed', message });
      console.error(`${conflict ? 'conflict' : 'failed'} ${projection.record.name}: ${message}`);
    }

    await writeFile(outputPath, JSON.stringify({
      generatedAt: new Date().toISOString(), edition: 'brass', canonicalWrites: true,
      rawProjectionCount: rawProjections.length, consolidatedProjectionCount: consolidated.length,
      mapReadyOnly, allowlist: options.allowlist || null, outcomes,
    }, null, 2), 'utf8');
  }

  await writeFile(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(), edition: 'brass', canonicalWrites: commit, input: inputPath,
    rawProjectionCount: rawProjections.length, consolidatedProjectionCount: consolidated.length,
    duplicateProjectionCount: rawProjections.length - consolidated.length, mapReadyOnly,
    allowlist: options.allowlist || null, eligibleProjectionCount: eligible.length, offset, limit, outcomes,
  }, null, 2), 'utf8');

  const counts = outcomes.reduce<Record<string, number>>((acc, outcome) => {
    acc[outcome.status] = (acc[outcome.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Wrote ${outputPath}`);
  console.log(JSON.stringify({ rawProjectionCount: rawProjections.length, consolidatedProjectionCount: consolidated.length, duplicateProjectionCount: rawProjections.length - consolidated.length, mapReadyOnly, allowlist: options.allowlist || null, eligibleProjectionCount: eligible.length, ...counts }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
