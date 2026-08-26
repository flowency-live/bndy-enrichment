import { describe, expect, it } from 'vitest';
import type { SourceRunContext } from '../src/sources/runner/types.js';
import { bandRef, gigRef, venueRef } from '../src/sources/adapters/onthecase/html.js';
import { parseOnTheCase } from '../src/sources/adapters/onthecase/parse.js';
import { ONTHECASE_SOURCES } from '../src/sources/adapters/onthecase/sources.js';

function run(sourceId: string, kind?: string): SourceRunContext {
  return {
    runId: 'run-test', sourceId, startedAt: '2026-08-26T00:00:00.000Z', runDate: '2026-08-26',
    reason: 'manual', requestedAt: '2026-08-26T00:00:00.000Z', task: kind ? { kind } : undefined,
  };
}

const gigPage = `
<html><head><title>Gigs : On The Case Music : Keeping North East Music Live</title></head><body>
<div class="list-item"><div class="list-item-left">Thursday 27 August 2026</div>
<div class="name"><a href="/venues/6011/old-fat-ox-holywell/131412">Buskers night at Old Fat Ox Holywell</a><br><span>Holywell Dene Road / Holywell Whitley Bay / 0191 366 0272</span><div class="price">8:00 PM / FREE</div></div></div>
<div class="list-item"><div class="list-item-left">Friday 28 August 2026</div>
<div class="name"><a href="/venues/6011/old-fat-ox-holywell/131413">3rd Stage Red at Old Fat Ox Holywell</a><div class="price">9:00 PM / £4.00</div></div></div>
</body></html>`;

const venuePage = `
<html><head><title>Venues : Old Fat Ox Holywell : On The Case Music</title></head><body>
<div class="gigs-item"><h2>Old Fat Ox Holywell<br>Holywell Dene Road / Holywell Whitley Bay / 0191 366 0272</h2></div>
<p>Capacity: 150 Accessible: Yes Food: Yes</p><p>A welcoming live music venue in Holywell.</p>
<h2 style="font-size:19px;">Friday 28 August 2026</h2><div class="name"><a href="/bands/12550/3rd-stage-red">3rd Stage Red</a><div class="price">9:00 PM / FREE</div></div>
</body></html>`;

const bandPage = `
<html><head><title>Bands : 3rd Stage Red : On The Case Music</title></head><body>
<div class="gigs-item"><h2>3rd Stage Red<br>Pop / Soul / Funk / Rock</h2></div><div style="clear:both;"></div><p>Covering a great selection of iconic songs.</p>
<h2 style="font-size:19px;">Saturday 29 August 2026</h2><div class="name"><a href="/venues/6011/old-fat-ox-holywell">Old Fat Ox Holywell</a><div class="price">9:00 PM / FREE</div></div>
</body></html>`;

describe('On The Case production adapter', () => {
  it('uses source-native numeric identities', () => {
    expect(bandRef('https://onthecasemusic.co.uk/bands/12550/3rd-stage-red')?.id).toBe('12550');
    expect(venueRef('https://onthecasemusic.co.uk/venues/6011/old-fat-ox-holywell')?.id).toBe('6011');
    expect(gigRef('https://onthecasemusic.co.uk/venues/6011/old-fat-ox-holywell/131412')?.gigId).toBe('131412');
  });

  it('keeps open-mic/buskers labels unresolved and hydrates each gig-linked venue once', () => {
    const parsed = parseOnTheCase(gigPage, 'https://onthecasemusic.co.uk/gigs', run('onthecase-gig-index'));
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0]).toMatchObject({
      sourceEventKey: 'onthecase:gig:131412', artistName: undefined, venueExternalId: 'onthecase:venue:6011',
      data: expect.objectContaining({ unresolvedPerformerLabel: 'Buskers night' }),
    });
    expect(parsed.events[1].artistName).toBe('3rd Stage Red');
    expect((parsed.nextRequests ?? []).filter((r) => r.sourceId === 'onthecase-venue-hydration')).toHaveLength(1);
    expect(parsed.nextRequests).toContainEqual(expect.objectContaining({ task: expect.objectContaining({ kind: 'gig-inventory-control', expectedCount: 2 }) }));
  });

  it('hydrates venue facts and fans out only linked bands', () => {
    const parsed = parseOnTheCase(venuePage, 'https://onthecasemusic.co.uk/venues/6011/old-fat-ox-holywell', run('onthecase-venue-hydration', 'venue'));
    expect(parsed.entities?.[0]).toMatchObject({ entityType: 'venue', sourceEntityKey: 'onthecase:venue:6011', displayName: 'Old Fat Ox Holywell' });
    expect(parsed.entities?.[0].claims).toContainEqual(expect.objectContaining({ predicate: 'derivedFrom', value: expect.objectContaining({ kind: 'venue-facts', capacity: '150' }) }));
    expect(parsed.nextRequests).toEqual([expect.objectContaining({ sourceId: 'onthecase-band-hydration', taskKey: 'band:onthecase:band:12550' })]);
  });

  it('hydrates band facts but does not recurse back to venues', () => {
    const parsed = parseOnTheCase(bandPage, 'https://onthecasemusic.co.uk/bands/12550/3rd-stage-red', run('onthecase-band-hydration', 'band'));
    expect(parsed.entities?.[0]).toMatchObject({ entityType: 'artist', sourceEntityKey: 'onthecase:band:12550', displayName: '3rd Stage Red' });
    expect(parsed.entities?.[0].claims).toContainEqual(expect.objectContaining({ predicate: 'hasGenre', value: 'Rock' }));
    expect(parsed.entities?.[0].claims).toContainEqual(expect.objectContaining({ predicate: 'derivedFrom', value: expect.objectContaining({ kind: 'performsAt', venue: 'onthecase:venue:6011' }) }));
    expect(parsed.nextRequests ?? []).toHaveLength(0);
  });

  it('fails closed on the 200-homepage not-found behaviour', () => {
    const homepage = '<html><head><title>On The Case Music Services</title></head><body>home</body></html>';
    expect(() => parseOnTheCase(homepage, 'https://onthecasemusic.co.uk/venues/999999/missing', run('onthecase-venue-hydration', 'venue'))).toThrow(/homepage/);
  });

  it('reconciliation is gig-led and directories remain unscheduled bootstrap/audit sources', () => {
    const parsed = parseOnTheCase('<html></html>', 'https://onthecasemusic.co.uk/gigs', run('onthecase-full-reconcile', 'full-reconcile'));
    expect((parsed.nextRequests ?? []).map((r) => r.sourceId)).toEqual(['onthecase-gig-index']);
    expect(ONTHECASE_SOURCES).toHaveLength(6);
    expect(ONTHECASE_SOURCES.every((s) => !s.enabled && s.shadow && s.writerAuthority === 'cowork')).toBe(true);
    expect(ONTHECASE_SOURCES.find((s) => s.id === 'onthecase-band-index')?.cadence).toBe('manual');
    expect(ONTHECASE_SOURCES.find((s) => s.id === 'onthecase-venue-index')?.cadence).toBe('manual');
  });
});
