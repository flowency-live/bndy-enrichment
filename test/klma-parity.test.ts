import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GigSource } from '../src/knowledge/types.js';
import { klmaAdapter } from '../src/sources/adapters/klma/index.js';

const evidence = readFileSync('test/fixtures/klma/source-2026-06-13.gviz-raw.csv', 'utf8');
const manifest = JSON.parse(readFileSync('test/fixtures/klma/gate-a.manifest.json', 'utf8'));

const source: GigSource = {
  id: 'klma-stoke-gig-list', name: 'KLMA Stoke Gig List', type: 'CURATED_SOURCE',
  url: 'https://docs.google.com/spreadsheets/d/example', region: 'Staffordshire / Cheshire',
  timezone: 'Europe/London', cadence: 'daily', localTime: '09:00', mode: 'delta',
  snapshotSemantics: 'complete', authorityClass: 'curated', thresholds: {}, adapter: 'klma-stoke',
  runtimeClass: 'standard', enabled: false, shadow: true, writerAuthority: 'cowork', health: 'unknown',
  projectionPolicy: { mode: 'additive-only', minAcceptedEventsPerRun: 50, maxAcceptedEventsPerRun: 500 },
};

const run = {
  runId: 'klma-gate-a', sourceId: source.id, startedAt: '2026-06-13T08:00:00.000Z',
  runDate: '2026-06-13', reason: 'manual' as const, requestedAt: '2026-06-13T08:00:00.000Z',
};

describe('KLMA Gate A parity manifest', () => {
  it('replays the exact donor evidence and keeps every classified difference stable', async () => {
    const parsed = await klmaAdapter.parse(source, run, {
      kind: 'csv', body: evidence, sourceUrl: source.url, fetchMethod: 'stored-identical-evidence',
      fetchedAt: run.startedAt, complete: true,
    });
    const parkedByReason = parsed.parked.reduce<Record<string, number>>((counts, item) => {
      counts[item.reason] = (counts[item.reason] ?? 0) + 1;
      return counts;
    }, {});
    const unresolvedVenueRows = parsed.parked
      .filter((item) => item.reason === 'ambiguous_venue_location')
      .reduce<Record<string, number>>((counts, item) => {
        const venue = (item.raw as { venue: string }).venue.trim();
        counts[venue] = (counts[venue] ?? 0) + 1;
        return counts;
      }, {});

    expect(createHash('sha256').update(evidence).digest('hex')).toBe(manifest.evidenceSha256);
    expect(parsed.events.length + parsed.parked.length).toBe(manifest.donor.rawRows);
    expect(parsed.events).toHaveLength(manifest.backline.acceptedEvents);
    expect(parsed.entities).toHaveLength(manifest.backline.entityProfiles);
    expect(parsed.parked).toHaveLength(manifest.backline.parkedRows);
    expect(parkedByReason).toEqual(manifest.backline.parkedByReason);
    expect(new Set(parsed.events.map((event) => event.artistExternalId)).size).toBe(manifest.backline.distinctArtists);
    expect(new Set(parsed.events.map((event) => event.venueExternalId)).size).toBe(manifest.backline.distinctVenues);
    expect(new Set(parsed.events.map((event) => event.sourceEventKey)).size).toBe(parsed.events.length);
    expect(unresolvedVenueRows).toEqual(manifest.unresolvedVenueRows);
    expect(manifest.donor.acceptedEvents - manifest.backline.acceptedEvents).toBe(
      manifest.classifiedDifferences.reduce((total: number, item: { rows: number }) => total + item.rows, 0),
    );
    expect(manifest.operatorDisposition).toEqual(expect.objectContaining({
      policy: 'retain-and-park',
      ambiguousVenueLocality: 'PARK_RETAIN_EVIDENCE_NO_DEFAULT_LOCALITY',
      sourceIdentityCollision: 'PARK_RETAIN_EVIDENCE_NO_AUTOMATIC_MERGE',
      identicalDuplicate: 'ACCEPT_ONE_PARK_DUPLICATE_COPY',
    }));
    expect(manifest.cutoverReady).toBe(true);
    expect(manifest.blockingReason).toBeNull();
  });
});
