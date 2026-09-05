import { describe, expect, it } from 'vitest';
import type { GigSource } from '../src/knowledge/types.js';
import { KLMA_EXPORT_URL, KLMA_GVIZ_URL } from '../src/vertical-slice/klma-source.js';
import { klmaAdapter } from '../src/sources/adapters/klma/index.js';
import type { AcquisitionRouter } from '../src/sources/runner/acquisition.js';
import { eventFingerprint } from '../src/sources/runner/diff.js';

const config: GigSource = {
  id: 'klma-stoke-gig-list', name: 'KLMA Stoke Gig List', type: 'CURATED_SOURCE',
  url: 'https://docs.google.com/spreadsheets/d/example', region: 'Staffordshire / Cheshire',
  timezone: 'Europe/London', cadence: 'daily', localTime: '09:00', mode: 'delta',
  snapshotSemantics: 'complete', authorityClass: 'curated', thresholds: {}, adapter: 'klma-stoke',
  runtimeClass: 'standard', enabled: false, shadow: true, writerAuthority: 'cowork', health: 'unknown',
};

const run = {
  runId: 'run-1', sourceId: config.id, startedAt: '2026-08-27T10:00:00.000Z',
  runDate: '2026-08-27', reason: 'manual' as const, requestedAt: '2026-08-27T10:00:00.000Z',
};

const csv = [
  'Date,Artist,Venue,Time,Genre,URL',
  '28/08/2026,The Test Band,"The Test Arms, Stoke-on-Trent",9pm,Rock,https://example.test/gig',
  '29/08/2026,The Test Band,"The Other Arms, Leek",TBC,Indie,',
  '20/08/2026,Past Band,Past Venue,8pm,,',
  'bad-date,Broken Band,Broken Venue,8pm,,',
].join('\n');

describe('KLMA generic SourceAdapter', () => {
  it('uses the export CSV and produces gig plus entity knowledge without projection', async () => {
    const acquisition: AcquisitionRouter = { async acquire(request) {
      expect(request.url).toBe(KLMA_EXPORT_URL);
      return {
        kind: 'csv', body: csv, sourceUrl: request.url, fetchMethod: 'fixture',
        fetchedAt: run.startedAt, complete: true, httpStatus: 200, contentType: 'text/csv',
      };
    } };
    const raw = await klmaAdapter.fetch(config, run, acquisition);
    const parsed = await klmaAdapter.parse(config, run, raw);

    expect(raw).toMatchObject({ complete: true, paginationComplete: true, captureStable: true });
    expect(parsed.events).toHaveLength(2);
    expect(parsed.entities).toHaveLength(3);
    expect(parsed.entities?.find((entity) => entity.entityType === 'artist')?.claims).toEqual(expect.arrayContaining([
      { predicate: 'hasGenre', value: 'Rock' },
      { predicate: 'hasGenre', value: 'Indie' },
    ]));
    expect(parsed.parked.map((item) => item.reason)).toEqual(['past_event', 'unparseable']);
    expect(parsed.warnings).toContain("No stage time in 'TBC'");
  });

  it('fingerprints a gig by its facts, so a new row above it does not make it look changed', async () => {
    const shifted = csv.replace('28/08/2026,The Test Band', ['27/08/2026,New Top Band,"Top Arms, Stoke-on-Trent",8pm,Rock,', '28/08/2026,The Test Band'].join('\n'));
    const parseCsv = async (body: string) => {
      const acquisition: AcquisitionRouter = { async acquire(request) {
        return { kind: 'csv', body, sourceUrl: request.url, fetchMethod: 'fixture', fetchedAt: run.startedAt, complete: true, httpStatus: 200, contentType: 'text/csv' };
      } };
      return klmaAdapter.parse(config, run, await klmaAdapter.fetch(config, run, acquisition));
    };
    const [before, after] = await Promise.all([parseCsv(csv), parseCsv(shifted)]);
    const key = before.events[0]!.sourceEventKey;
    const original = before.events.find((event) => event.sourceEventKey === key)!;
    const moved = after.events.find((event) => event.sourceEventKey === key)!;
    expect(eventFingerprint(moved)).toBe(eventFingerprint(original));
    expect(JSON.stringify(moved)).not.toMatch(/row:\d+/);
  });

  it('falls back to gviz and realigns its leading row-number column', async () => {
    const gviz = csv.split('\n').map((line, index) => `${index},${line}`).join('\n');
    const seen: string[] = [];
    const acquisition: AcquisitionRouter = { async acquire(request) {
      seen.push(request.url);
      if (request.url === KLMA_EXPORT_URL) throw new Error('export unavailable');
      return {
        kind: 'csv', body: gviz, sourceUrl: request.url, fetchMethod: 'fixture',
        fetchedAt: run.startedAt, complete: true, httpStatus: 200, contentType: 'text/csv',
      };
    } };
    const raw = await klmaAdapter.fetch(config, run, acquisition);
    expect(seen).toEqual([KLMA_EXPORT_URL, KLMA_GVIZ_URL]);
    expect(raw.fetchMethod).toBe('google-sheets-gviz-csv');
    expect((await klmaAdapter.parse(config, run, raw)).events).toHaveLength(2);
  });

  it('fails closed when the sheet shape changes', async () => {
    await expect(klmaAdapter.parse(config, run, {
      kind: 'csv', body: 'Unexpected,Columns\nvalue,value', sourceUrl: KLMA_EXPORT_URL,
      fetchMethod: 'fixture', fetchedAt: run.startedAt, complete: true,
    })).rejects.toThrow('structural gate');
  });

  it('accepts the live headerless helper-column shape without changing stored evidence', async () => {
    const liveShape = [
      ',1/1/0125,Keep Live Music Alive In Stoke On Trent And Surrounding Areas,,,,',
      ',1/5/2026,You Can Add Your Own Gigs By Clicking On Gig List Form,,,,',
      ',"Saturday, August 29, 2026",Test Artist,"The Swan, Stone",9pm,Rock,https://example.test/one',
      ',"Sunday, August 30, 2026",Second Artist,"The Nags Head, Macclesfield",8.30pm,Indie,',
    ].join('\n');
    const acquisition: AcquisitionRouter = { async acquire(request) {
      return {
        kind: 'csv', body: liveShape, sourceUrl: request.url, fetchMethod: 'fixture',
        fetchedAt: run.startedAt, complete: true, httpStatus: 200, contentType: 'text/csv',
      };
    } };

    const raw = await klmaAdapter.fetch(config, run, acquisition);
    const parsed = await klmaAdapter.parse(config, run, raw);

    expect(raw.body).toBe(liveShape);
    expect(parsed.events.map((event) => event.sourceEventKey)).toHaveLength(2);
    expect(parsed.events[0]).toMatchObject({ date: '2026-08-29', venueName: 'The Swan, Stone' });
    expect(parsed.parked.map((item) => item.reason)).toEqual(['form_metadata', 'form_metadata']);
  });

  it('parks specialist, multi-act and location-ambiguous rows before projection', async () => {
    const body = [
      'Date,Artist,Venue,Time,Genre,URL',
      '29/08/2026,Specialist Act,Artisan Tap,9pm,,',
      '29/08/2026,Lineup,The Rigger Venue,8pm,,',
      '29/08/2026,Unknown Act,Venue With No Town,8pm,,',
    ].join('\n');
    const parsed = await klmaAdapter.parse(config, run, {
      kind: 'csv', body, sourceUrl: KLMA_EXPORT_URL, fetchMethod: 'fixture',
      fetchedAt: run.startedAt, complete: true,
    });

    expect(parsed.events).toHaveLength(0);
    expect(parsed.parked.map((item) => item.reason)).toEqual([
      'specialist_venue', 'multi_act', 'ambiguous_venue_location',
    ]);
  });

  it('deduplicates identical rows and parks conflicting source-identity collisions', async () => {
    const body = [
      'Date,Artist,Venue,Time,Genre,URL',
      '29/08/2026,Same Artist,"The Swan, Stone",9pm,Rock,',
      '29/08/2026,Same Artist,"The Swan, Stone",9pm,Rock,',
      '30/08/2026,Collision Artist,"The Swan, Stone",8pm,Rock,',
      '30/08/2026,Collision Artist,"The Swan, Stone",9pm,Rock,',
    ].join('\n');
    const parsed = await klmaAdapter.parse(config, run, {
      kind: 'csv', body, sourceUrl: KLMA_EXPORT_URL, fetchMethod: 'fixture',
      fetchedAt: run.startedAt, complete: true,
    });

    expect(parsed.events).toHaveLength(1);
    expect(parsed.parked.map((item) => item.reason)).toEqual([
      'duplicate_source_row', 'source_identity_collision', 'source_identity_collision',
    ]);
  });
});
