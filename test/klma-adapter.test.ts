import { describe, expect, it } from 'vitest';
import type { GigSource } from '../src/knowledge/types.js';
import { KLMA_EXPORT_URL, KLMA_GVIZ_URL } from '../src/vertical-slice/klma-source.js';
import { klmaAdapter } from '../src/sources/adapters/klma/index.js';
import type { AcquisitionRouter } from '../src/sources/runner/acquisition.js';

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
    expect(parsed.parked.map((item) => item.reason)).toEqual(['past_event', 'invalid_date']);
    expect(parsed.warnings).toContain("No stage time in 'TBC'");
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
});
