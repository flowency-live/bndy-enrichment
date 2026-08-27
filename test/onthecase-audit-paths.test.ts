import { describe, expect, it } from 'vitest';
import type { SourceRunContext } from '../src/sources/runner/types.js';
import { parseOnTheCase } from '../src/sources/adapters/onthecase/parse.js';
import { ONTHECASE_SOURCES } from '../src/sources/adapters/onthecase/sources.js';

function run(sourceId: string, kind: string): SourceRunContext {
  return {
    runId: 'run-audit-test', sourceId, startedAt: '2026-08-27T00:00:00.000Z', runDate: '2026-08-27',
    reason: 'manual', requestedAt: '2026-08-27T00:00:00.000Z', task: { kind },
  };
}

describe('On The Case manual directory/audit paths', () => {
  it('band directory emits unique native-ID hydration tasks plus inventory control', () => {
    const html = `<html><head><title>Bands : On The Case Music</title></head><body>
      <a href="/bands/12550/3rd-stage-red">3rd Stage Red</a>
      <a href="/bands/12550/3rd-stage-red">3rd Stage Red duplicate</a>
      <a href="/bands/999/another-band">Another Band</a>
    </body></html>`;
    const parsed = parseOnTheCase(html, 'https://onthecasemusic.co.uk/bands', run('onthecase-band-index', 'band-index'));
    const hydration = (parsed.nextRequests ?? []).filter((r) => r.sourceId === 'onthecase-band-hydration');
    expect(hydration).toHaveLength(2);
    expect(hydration.map((r) => r.taskKey)).toEqual(['band:onthecase:band:12550', 'band:onthecase:band:999']);
    expect(parsed.nextRequests).toContainEqual(expect.objectContaining({ task: expect.objectContaining({ kind: 'band-inventory-control', expectedCount: 2, inventoryLevel: 'band-directory' }) }));
  });

  it('default venue directory discovers venue profiles and location branches', () => {
    const html = `<html><head><title>Venues : On The Case Music</title></head><body>
      <a href="/venues/6011/old-fat-ox-holywell">Old Fat Ox Holywell</a>
      <a href="/venues?location=newcastle">Newcastle</a>
      <a href="/venues?location=durham">Durham</a>
    </body></html>`;
    const parsed = parseOnTheCase(html, 'https://onthecasemusic.co.uk/venues', run('onthecase-venue-index', 'venue-index'));
    expect(parsed.nextRequests).toContainEqual(expect.objectContaining({ sourceId: 'onthecase-venue-hydration', taskKey: 'venue:onthecase:venue:6011' }));
    expect((parsed.nextRequests ?? []).filter((r) => r.sourceId === 'onthecase-venue-index' && r.task?.kind === 'venue-index')).toHaveLength(2);
    expect(parsed.nextRequests).toContainEqual(expect.objectContaining({ task: expect.objectContaining({ kind: 'venue-inventory-control', expectedCount: 1, location: 'default' }) }));
  });

  it('filtered venue directory does not recursively rediscover location branches', () => {
    const html = `<html><head><title>Venues : Newcastle : On The Case Music</title></head><body>
      <a href="/venues/42/the-cluny">The Cluny</a>
      <a href="/venues?location=durham">Durham</a>
    </body></html>`;
    const parsed = parseOnTheCase(html, 'https://onthecasemusic.co.uk/venues?location=newcastle', run('onthecase-venue-index', 'venue-index'));
    expect((parsed.nextRequests ?? []).filter((r) => r.task?.kind === 'venue-index')).toHaveLength(0);
    expect(parsed.nextRequests).toContainEqual(expect.objectContaining({ sourceId: 'onthecase-venue-hydration', taskKey: 'venue:onthecase:venue:42' }));
    expect(parsed.nextRequests).toContainEqual(expect.objectContaining({ task: expect.objectContaining({ kind: 'venue-inventory-control', expectedCount: 1, location: 'newcastle' }) }));
  });

  it('fails closed when a task receives a structurally wrong non-homepage page', () => {
    const html = '<html><head><title>Bands : Wrong Surface : On The Case Music</title></head><body></body></html>';
    expect(() => parseOnTheCase(html, 'https://onthecasemusic.co.uk/venues/6011/old-fat-ox', run('onthecase-venue-hydration', 'venue'))).toThrow(/unexpected title/);
  });

  it('fails closed when the historically non-empty root gig listing parses zero gigs', () => {
    const html = '<html><head><title>Gigs : On The Case Music</title></head><body><p>No parseable rows</p></body></html>';
    expect(() => parseOnTheCase(html, 'https://onthecasemusic.co.uk/gigs', run('onthecase-gig-index', 'gig-index'))).toThrow(/parsed to zero gigs/);
  });

  it('does not add root inventory control to a filtered gig listing', () => {
    const html = `<html><head><title>Gigs : On The Case Music</title></head><body>
      <div class="list-item"><div class="list-item-left">Thursday 27 August 2026</div>
      <div class="name"><a href="/venues/6011/old-fat-ox/131412">3rd Stage Red at Old Fat Ox</a><div class="price">8:00 PM / FREE</div></div></div>
    </body></html>`;
    const parsed = parseOnTheCase(html, 'https://onthecasemusic.co.uk/gigs?location=newcastle', run('onthecase-gig-index', 'gig-index'));
    expect(parsed.events).toHaveLength(1);
    expect((parsed.nextRequests ?? []).filter((r) => r.task?.kind === 'gig-inventory-control')).toHaveLength(0);
  });

  it('keeps all registry seeds manual so directory audit paths cannot self-schedule', () => {
    const band = ONTHECASE_SOURCES.find((s) => s.id === 'onthecase-band-index');
    const venue = ONTHECASE_SOURCES.find((s) => s.id === 'onthecase-venue-index');
    const full = ONTHECASE_SOURCES.find((s) => s.id === 'onthecase-full-reconcile');
    const gig = ONTHECASE_SOURCES.find((s) => s.id === 'onthecase-gig-index');
    expect(band?.cadence).toBe('manual');
    expect(venue?.cadence).toBe('manual');
    expect(full?.cadence).toBe('manual');
    expect(gig?.cadence).toBe('manual');
  });
});
