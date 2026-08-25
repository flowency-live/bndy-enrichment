import { describe, expect, it } from 'vitest';
import type { SourceRunContext } from '../src/sources/runner/types.js';
import { gigId, lemonrockSlug } from '../src/sources/adapters/lemonrock/html.js';
import { parseLemonrock } from '../src/sources/adapters/lemonrock/parse.js';

function run(sourceId: string, task?: Record<string, unknown>): SourceRunContext {
  return {
    runId: 'run-test',
    sourceId,
    startedAt: '2026-08-24T00:00:00.000Z',
    runDate: '2026-08-24',
    reason: 'manual',
    requestedAt: '2026-08-24T00:00:00.000Z',
    task,
  };
}

describe('Lemonrock source-native identities', () => {
  it('keeps profile slugs and numeric gig IDs stable', () => {
    expect(lemonrockSlug('https://www.lemonrock.com/theexampleband')).toBe('theexampleband');
    expect(gigId('https://www.lemonrock.com/gig.php?id=939252')).toBe('939252');
    expect(gigId('https://www.lemonrock.com/gig.php?foo=bar')).toBeUndefined();
  });

  it('enumerates artist profiles and A-Z directory pages without canonical writes', () => {
    const html = `
      <html><head><title>Browse bands A - Z - Lemonrock Gig Guide</title></head><body>
        <a href="/alpha">Alpha</a>
        <a href="/beta">Beta</a>
        <a href="/allbands.php?_start=A&amp;all=0">A</a>
      </body></html>`;
    const parsed = parseLemonrock(html, 'https://www.lemonrock.com/allbands.php', run('lemonrock-artist-index'));
    const tasks = parsed.nextRequests ?? [];
    expect(tasks.some((item) => item.taskKey === 'artist:lemonrock:artist:alpha')).toBe(true);
    expect(tasks.some((item) => item.taskKey === 'artist:lemonrock:artist:beta')).toBe(true);
    expect(tasks.filter((item) => item.sourceId === 'lemonrock-artist-index')).toEqual([
      expect.objectContaining({ task: expect.objectContaining({ url: 'https://www.lemonrock.com/allbands.php?_start=A&all=1' }) }),
    ]);
    expect(parsed.events).toEqual([]);
  });

  it('turns a rich artist page into an artist-candidate profile with multi-valued claims', () => {
    const html = `
      <html><head><title>Example Band : Rock covers - Lemonrock Gig Guide</title></head><body>
        <p>Based: Manchester</p>
        <p>Band formats: 4-piece, 5-piece</p>
        <p>Genre tags: Rock, Indie</p>
        <p>Tel: 07123 456789</p>
        <p>Email: bookings@example.test</p>
        <p>Page maintained by the band. Last updated 20 August 2026</p>
        <p>Example Band play energetic live rock covers across the North West with a broad repertoire.</p>
        <a href="https://facebook.com/exampleband">Facebook</a>
        <a href="https://instagram.com/exampleband">Instagram</a>
        <a href="https://exampleband.test">Website</a>
        <a href="/gig.php?id=939252">Upcoming gig</a>
      </body></html>`;
    const parsed = parseLemonrock(
      html,
      'https://www.lemonrock.com/exampleband',
      run('lemonrock-artist-hydration', { kind: 'artist', nativeId: 'lemonrock:artist:exampleband', name: 'Example Band' }),
    );
    const entity = parsed.entities?.[0];
    expect(entity?.sourceEntityKey).toBe('lemonrock:artist:exampleband');
    expect(entity?.displayName).toBe('Example Band');
    expect(entity?.claims.filter((claim) => claim.predicate === 'hasGenre').map((claim) => claim.value)).toEqual(['Rock', 'Indie']);
    expect(entity?.claims.some((claim) => claim.predicate === 'hasFacebookUrl')).toBe(true);
    expect(entity?.claims.some((claim) => claim.predicate === 'hasInstagramUrl')).toBe(true);
    expect(entity?.claims.some((claim) => claim.predicate === 'hasBio')).toBe(true);
    expect(parsed.nextRequests?.some((item) => item.taskKey === 'gig:lemonrock:gig:939252')).toBe(true);
  });

  it('hydrates a venue without manufacturing unknown canonical fields', () => {
    const html = `
      <html><head><title>The Example Arms : Pub : Manchester - Lemonrock Gig Guide</title></head><body>
        <p>Address: 12 Example Street, Manchester M1 1AA</p>
        <p>Telephone: 0161 000 0000</p>
        <p>The Example Arms is a live music pub with a dedicated stage and accessible entrance.</p>
        <a href="https://theexamplearms.test">Website</a>
      </body></html>`;
    const parsed = parseLemonrock(
      html,
      'https://www.lemonrock.com/examplearms',
      run('lemonrock-venue-hydration', { kind: 'venue', nativeId: 'lemonrock:venue:examplearms', name: 'The Example Arms' }),
    );
    const entity = parsed.entities?.[0];
    expect(entity?.sourceEntityKey).toBe('lemonrock:venue:examplearms');
    expect(entity?.claims.some((claim) => claim.predicate === 'hasAddress' && String(claim.value).includes('M1 1AA'))).toBe(true);
    expect(entity?.claims.some((claim) => claim.predicate === 'derivedFrom' && JSON.stringify(claim.value).includes('postcode'))).toBe(true);
  });

  it('uses the numeric gig as event identity and preserves explicit cancellation evidence', () => {
    const html = `
      <html><head><title>Example Band gig at The Example Arms on Monday 24 August 2026 - Lemonrock Gig Guide</title></head><body>
        <h1>CANCELLED</h1>
        <p>Cancelled 23 August 2026. Venue unavailable.</p>
        <p>8.30pm - 11.00pm | £8 advance</p>
        <p>Posted by Example Band at 7.15pm on 1 August</p>
        <a href="/exampleband">Example Band</a>
        <a href="/examplearms">The Example Arms</a>
      </body></html>`;
    const parsed = parseLemonrock(
      html,
      'https://www.lemonrock.com/gig.php?id=939252',
      run('lemonrock-gig-hydration', { kind: 'gig', nativeId: 'lemonrock:gig:939252' }),
    );
    const event = parsed.events[0];
    expect(event?.sourceEventKey).toBe('lemonrock:gig:939252');
    expect(event?.sourceNativeId).toBe('lemonrock:gig:939252');
    expect(event?.date).toBe('2026-08-24');
    expect(event?.startTime).toBe('20:30');
    expect(event?.endTime).toBe('23:00');
    expect(event?.status).toBe('cancelled');
    expect(event?.artistExternalId).toBe('lemonrock:artist:exampleband');
    expect(event?.venueExternalId).toBe('lemonrock:venue:examplearms');
    expect(event?.claims?.some((claim) => claim.predicate === 'derivedFrom' && JSON.stringify(claim.value).includes('cancellationText'))).toBe(true);
  });

  it('enumerates national county gig indexes as completeness controls', () => {
    const html = `
      <html><body>
        <a href="/gigsincounty.php?county=Greater+Manchester">Greater Manchester (120 gigs)</a>
        <a href="/gigsincounty.php?county=London">London (900 gigs)</a>
      </body></html>`;
    const parsed = parseLemonrock(html, 'https://www.lemonrock.com/gigsbycounty.php', run('lemonrock-future-reconcile', { kind: 'future-index' }));
    expect(parsed.nextRequests?.map((item) => item.task.url)).toContain('https://www.lemonrock.com/gigsincounty.php?county=Greater+Manchester');
    expect(parsed.nextRequests?.map((item) => item.task.url)).toContain('https://www.lemonrock.com/gigsincounty.php?county=London');
    expect(parsed.nextRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({ task: expect.objectContaining({ expectedCount: 120, inventoryLevel: 'county' }) }),
      expect.objectContaining({ task: expect.objectContaining({ expectedCount: 900, inventoryLevel: 'county' }) }),
    ]));
  });

  it('enumerates every venue directory page including venues without current gigs', () => {
    const html = `
      <html><body>
        <a href="/allvenues.php?_start=A&amp;all=0">A</a>
        <a href="/allvenues.php?_start=B&amp;all=0">B</a>
      </body></html>`;
    const parsed = parseLemonrock(html, 'https://www.lemonrock.com/allvenues.php', run('lemonrock-venue-index'));
    expect(parsed.nextRequests?.map((item) => item.task.url)).toEqual(expect.arrayContaining([
      'https://www.lemonrock.com/allvenues.php?_start=A&all=1',
      'https://www.lemonrock.com/allvenues.php?_start=B&all=1',
    ]));
  });

  it('follows county pages into town and dated listing pages before hydrating gigs', () => {
    const html = `
      <html><body>
        <a href="/gigs-in-torquay">Gigs near Torquay</a>
        <a href="/?cityId=28398&amp;gigfromdate=2026-09-01&amp;listingPeriod=11&amp;maxMilesGig=20">September</a>
        <a href="/gig.php?id=930726&amp;rd=2026-08-25">Gig details</a>
      </body></html>`;
    const parsed = parseLemonrock(
      html,
      'https://www.lemonrock.com/gigsincounty.php?county=Devon',
      run('lemonrock-future-reconcile', { kind: 'gig-index' }),
    );
    expect(parsed.nextRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'lemonrock-future-reconcile',
        task: expect.objectContaining({ kind: 'gig-index', url: 'https://www.lemonrock.com/gigs-in-torquay' }),
      }),
      expect.objectContaining({
        sourceId: 'lemonrock-future-reconcile',
        task: expect.objectContaining({
          kind: 'gig-index',
          url: 'https://www.lemonrock.com/?cityId=28398&gigfromdate=2026-09-01&listingPeriod=11&maxMilesGig=20',
        }),
      }),
      expect.objectContaining({
        sourceId: 'lemonrock-gig-hydration',
        task: expect.objectContaining({ kind: 'gig', nativeId: 'lemonrock:gig:930726' }),
      }),
    ]));
  });

  it('fans a full reconciliation across every national Lemonrock surface', () => {
    const html = `
      <html><body>
        <a href="/gigs-in-london">London gigs</a>
        <a href="/gig.php?id=939252">Current gig</a>
      </body></html>`;
    const parsed = parseLemonrock(
      html,
      'https://www.lemonrock.com/',
      run('lemonrock-full-reconcile'),
    );
    const tasks = parsed.nextRequests ?? [];
    expect(tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'lemonrock-artist-index',
        task: expect.objectContaining({ kind: 'artist-index' }),
      }),
      expect.objectContaining({
        sourceId: 'lemonrock-venue-index',
        task: expect.objectContaining({ kind: 'venue-index' }),
      }),
      expect.objectContaining({
        sourceId: 'lemonrock-future-reconcile',
        task: expect.objectContaining({ kind: 'future-index' }),
      }),
      expect.objectContaining({
        sourceId: 'lemonrock-new-gigs',
        task: expect.objectContaining({ kind: 'new-gigs' }),
      }),
      expect.objectContaining({
        sourceId: 'lemonrock-cancellations',
        task: expect.objectContaining({ kind: 'cancellations' }),
      }),
    ]));
  });

});
