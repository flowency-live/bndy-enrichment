import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GigSource } from '../src/knowledge/types.js';
import { buildParityArtifact, compareParityArtifacts, type SourceParityArtifact } from '../src/parity/source-parity.js';
import { gigsNewsAdapter } from '../src/sources/adapters/gigs-news/index.js';
import { diffSourceEvents } from '../src/sources/runner/diff.js';
import type { NormalisedSourceEvent, SourceRunContext } from '../src/sources/runner/types.js';

const evidence = readFileSync('test/fixtures/gigs-news/production-innertext.txt', 'utf8');
const donor = JSON.parse(readFileSync('test/fixtures/gigs-news/gate-a.donor.json', 'utf8')) as SourceParityArtifact;

const source: GigSource = {
  id: 'gigs-news-daily-import',
  name: 'gigs-news',
  type: 'AGGREGATOR',
  url: 'https://gigs-news.uk',
  region: 'Greater Manchester / East Cheshire',
  timezone: 'Europe/London',
  cadence: 'daily',
  localTime: '09:00',
  mode: 'delta',
  snapshotSemantics: 'complete',
  authorityClass: 'aggregator',
  thresholds: { venueAutoMatch: 0.95, artistAutoMatch: 0.9, eventAutoCreate: 0.95, socialAutoAttach: 0.95 },
  adapter: 'gigs-news',
  runtimeClass: 'browser',
  enabled: false,
  shadow: true,
  writerAuthority: 'cowork',
  health: 'unknown',
};

const run: SourceRunContext = {
  runId: 'gate-a-fixture',
  sourceId: source.id,
  startedAt: '2026-06-17T08:00:00.000Z',
  runDate: '2026-06-17',
  reason: 'manual',
  requestedAt: '2026-06-17T08:00:00.000Z',
};

describe('WP-11 source parity', () => {
  it('passes GigsNews Gate A normalisation, identity and exception parity on identical evidence', async () => {
    const parsed = await gigsNewsAdapter.parse(source, run, {
      kind: 'text',
      body: evidence,
      sourceUrl: source.url,
      fetchMethod: 'stored-identical-evidence',
      fetchedAt: run.startedAt,
      complete: true,
    });
    const actual = buildParityArtifact({ sourceId: source.id, runDate: run.runDate, evidence, parsed });
    const comparison = compareParityArtifacts(donor, actual);

    expect(comparison.differences, JSON.stringify({ donor, actual, differences: comparison.differences }, null, 2)).toEqual([]);
    expect(comparison.passed).toBe(true);
  });

  it('classifies differing raw evidence as INPUT_DIFFERENCE', () => {
    const actual: SourceParityArtifact = { ...donor, evidenceSha256: 'different' };
    const result = compareParityArtifacts(donor, actual);
    expect(result.passed).toBe(false);
    expect(result.differences).toContainEqual(expect.objectContaining({
      classification: 'INPUT_DIFFERENCE', path: 'evidenceSha256', material: true,
    }));
  });

  it('classifies artist/venue identity drift separately from event projection drift', () => {
    const events = donor.events.map((event) => ({ ...event }));
    events[0] = { ...events[0]!, artistExternalId: 'artist_wrong', startTime: '21:00' };
    const result = compareParityArtifacts(donor, { ...donor, events });

    expect(result.differences).toContainEqual(expect.objectContaining({
      classification: 'IDENTITY_DIFFERENCE', path: `events.${events[0]!.sourceEventKey}.artistExternalId`,
    }));
    expect(result.differences).toContainEqual(expect.objectContaining({
      classification: 'PROJECTION_DIFFERENCE', path: `events.${events[0]!.sourceEventKey}.startTime`,
    }));
  });

  it('allows only explicitly documented expected rule changes to be non-material', () => {
    const events = donor.events.map((event) => ({ ...event }));
    const path = `events.${events[0]!.sourceEventKey}.startTime`;
    events[0] = { ...events[0]!, startTime: '21:00' };
    const result = compareParityArtifacts(donor, { ...donor, events }, { expectedRuleChanges: [path] });

    expect(result.passed).toBe(true);
    expect(result.differences).toContainEqual(expect.objectContaining({
      classification: 'EXPECTED_RULE_CHANGE', path, material: false,
    }));
  });

  it('summarises added/updated/unchanged/withdrawn candidates deterministically', () => {
    const previous: NormalisedSourceEvent[] = [
      { sourceEventKey: 'same', artistName: 'A', venueName: 'V', date: '2026-09-01', startTime: '20:00' },
      { sourceEventKey: 'changed', artistName: 'B', venueName: 'V', date: '2026-09-01', startTime: '20:00' },
      { sourceEventKey: 'gone', artistName: 'C', venueName: 'V', date: '2026-09-01', startTime: '20:00' },
    ];
    const current: NormalisedSourceEvent[] = [
      { sourceEventKey: 'same', artistName: 'A', venueName: 'V', date: '2026-09-01', startTime: '20:00' },
      { sourceEventKey: 'changed', artistName: 'B', venueName: 'V', date: '2026-09-01', startTime: '21:00' },
      { sourceEventKey: 'new', artistName: 'D', venueName: 'V', date: '2026-09-01', startTime: '20:00' },
    ];
    const diff = diffSourceEvents(previous, current, source, { runDate: '2026-08-21', captureComplete: true });
    const parsed = { events: current, parked: [], warnings: [] };
    const artifact = buildParityArtifact({ sourceId: source.id, runDate: '2026-08-21', evidence: 'fixture', parsed, diff });

    expect(artifact.diff).toEqual({
      added: ['new'], updated: ['changed'], unchanged: ['same'], withdrawn: ['gone'], pastDropped: [], ignoredAbsences: [],
    });
  });
});
