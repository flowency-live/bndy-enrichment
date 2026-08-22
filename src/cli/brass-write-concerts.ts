import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { EventCandidate } from '../domain/schema.js';
import { BrassCanonicalApi } from '../brass/canonical-api.js';

interface BandWriteOutcome {
  proposedId?: string;
  bandName?: string;
  status: 'planned' | 'created' | 'matched' | 'held' | 'conflict' | 'failed';
  canonicalId?: string;
}

interface BandWriteFile { outcomes?: BandWriteOutcome[] }
interface DiscoveryRow {
  proposedBandId: string;
  bandName: string;
  result?: { events?: EventCandidate[] };
}
interface DiscoveryFile { rows?: DiscoveryRow[] }

interface ConcertOutcome {
  proposedBandId: string;
  bandName: string;
  eventDate: string;
  venueName: string;
  mode: 'plan' | 'commit';
  status: 'planned' | 'created' | 'duplicate' | 'failed';
  canonicalBandId?: string;
  canonicalVenueId?: string;
  canonicalEventId?: string;
  venueAction?: 'created' | 'matched';
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
    if (!next || next.startsWith('--')) { out[key] = 'true'; continue; }
    out[key] = next;
    i += 1;
  }
  return out;
}

async function main() {
  const options = args();
  const discoveryPath = resolve(process.cwd(), options.discovery || 'brass-discovery-2026.json');
  const bandsPath = resolve(process.cwd(), options.bands || 'brass-write-2026.json');
  const outputPath = resolve(process.cwd(), options.out || 'brass-concert-write-2026.json');
  const commit = options.commit === 'true';
  const limit = Math.max(1, Number(options.limit || (commit ? 10 : 1000)));

  const discovery = JSON.parse(await readFile(discoveryPath, 'utf8')) as DiscoveryFile;
  const bandWrites = JSON.parse(await readFile(bandsPath, 'utf8')) as BandWriteFile;
  const canonicalBandByProposedId = new Map(
    (bandWrites.outcomes ?? [])
      .filter((row) => (row.status === 'created' || row.status === 'matched') && row.proposedId && row.canonicalId)
      .map((row) => [row.proposedId!, row.canonicalId!]),
  );

  const work = (discovery.rows ?? []).flatMap((row) =>
    (row.result?.events ?? []).map((event) => ({ row, event }))
  ).filter(({ row }) => canonicalBandByProposedId.has(row.proposedBandId)).slice(0, limit);

  const api = commit ? new BrassCanonicalApi() : undefined;
  const outcomes: ConcertOutcome[] = [];

  for (const { row, event } of work) {
    const canonicalBandId = canonicalBandByProposedId.get(row.proposedBandId)!;
    const base: Omit<ConcertOutcome, 'mode' | 'status'> = {
      proposedBandId: row.proposedBandId,
      bandName: row.bandName,
      eventDate: event.eventDate,
      venueName: event.venueName,
      canonicalBandId,
    };

    if (!commit) {
      outcomes.push({ ...base, mode: 'plan', status: 'planned', message: 'would resolve Venue with brass-safe scopes, then create brass-scoped Concert' });
      continue;
    }

    try {
      const venue = await api!.ensureVenue(event);
      const concert = await api!.ensureConcert(event, canonicalBandId, venue.id);
      outcomes.push({
        ...base,
        mode: 'commit',
        status: concert.duplicate ? 'duplicate' : 'created',
        canonicalVenueId: venue.id,
        canonicalEventId: concert.id,
        venueAction: venue.action,
      });
      console.log(`${concert.duplicate ? 'duplicate' : 'created'} ${row.bandName} ${event.eventDate} @ ${event.venueName} -> ${concert.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({ ...base, mode: 'commit', status: 'failed', message });
      console.error(`failed ${row.bandName} ${event.eventDate} @ ${event.venueName}: ${message}`);
    }

    await writeFile(outputPath, JSON.stringify({
      generatedAt: new Date().toISOString(), edition: 'brass', canonicalWrites: true, outcomes,
    }, null, 2), 'utf8');
  }

  await writeFile(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    edition: 'brass',
    canonicalWrites: commit,
    discoveryInput: discoveryPath,
    bandWriteInput: bandsPath,
    outcomes,
  }, null, 2), 'utf8');

  const counts = outcomes.reduce<Record<string, number>>((acc, outcome) => {
    acc[outcome.status] = (acc[outcome.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Wrote ${outputPath}`);
  console.log(JSON.stringify(counts));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
