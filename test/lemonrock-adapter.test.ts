import { describe, expect, it } from 'vitest';
import type { GigSource } from '../src/knowledge/types.js';
import type { SourceRunContext } from '../src/sources/runner/types.js';
import { gigId, lemonrockSlug } from '../src/sources/adapters/lemonrock/html.js';
import { lemonrockAdapter } from '../src/sources/adapters/lemonrock/index.js';
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
  it('parks HTTP 410 as terminal gone evidence without inventing a cancellation', async () => {
    const parsed = await lemonrockAdapter.parse(
      {} as GigSource,
      run('lemonrock-gig-hydration', { kind: 'gig', nativeId: 'lemonrock:gig:939252' }),
      {
        kind: 'html',
        body: '<html><body>Gone</body></html>',
        sourceUrl: 'https://www.lemonrock.com/gig.php?id=939252',
        fetchMethod: 'http-lemonrock',
        fetchedAt: '2026-08-27T19:45:00.000Z',
        complete: false,
        httpStatus: 410,
        contentType: 'text/html',
      },
    );

    expect(parsed.events).toEqual([]);
    expect(parsed.nextRequests).toEqual([]);
    expect(parsed.parked).toEqual([
      expect.objectContaining({ reason: expect.stringContaining('HTTP 410') }),
    ]);
    expect(parsed.warnings).toEqual([
      expect.stringContaining('without inferring cancellation'),
    ]);
  });

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

  it('records source-advertised artist and venue directory inventory controls', () => {
    const artistHtml = `
      <html><head><title>All Bands (A) (551) - Lemonrock Gig Guide</title></head><body>
        <a href="a1covers"><strong>A1 Covers</strong></a>
      </body></html>`;
    const venueHtml = `
      <html><head><title>All Venues (A) (259) - Lemonrock Gig Guide</title></head><body>
        <a href="aardvarkarms"><strong>Aardvark Arms</strong></a>
      </body></html>`;

    const artists = parseLemonrock(
      artistHtml,
      'https://www.lemonrock.com/allbands.php?_start=A&all=1',
      run('lemonrock-artist-index', { kind: 'artist-index-page' }),
    );
    const venues = parseLemonrock(
      venueHtml,
      'https://www.lemonrock.com/allvenues.php?_start=A&all=1',
      run('lemonrock-venue-index', { kind: 'venue-index-page' }),
    );

    expect(artists.nextRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskKey: 'artist:lemonrock:artist:a1covers',
      }),
      expect.objectContaining({
        taskKey: 'artist-inventory-control:lemonrock:artist-directory:a',
        task: expect.objectContaining({ expectedCount: 551, observedCount: 1, inventoryLevel: 'directory-page' }),
      }),
    ]));
    expect(venues.nextRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskKey: 'venue:lemonrock:venue:aardvarkarms',
      }),
      expect.objectContaining({
        taskKey: 'venue-inventory-control:lemonrock:venue-directory:a',
        task: expect.objectContaining({ expectedCount: 259, observedCount: 1, inventoryLevel: 'directory-page' }),
      }),
    ]));
  });

  it('records a directory control from parsed profiles when the title omits a count', () => {
    const html = `
      <html><head><title>All Bands (0-9) - Lemonrock Gig Guide</title></head><body>
        <a href="2fortheroad"><strong>2 For The Road</strong></a>
        <a href="4play"><strong>4 Play</strong></a>
      </body></html>`;

    const parsed = parseLemonrock(
      html,
      'https://www.lemonrock.com/allbands.php?_start=0&all=1',
      run('lemonrock-artist-index', { kind: 'artist-index-page' }),
    );

    expect(parsed.nextRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        taskKey: 'artist-inventory-control:lemonrock:artist-directory:0',
        task: expect.objectContaining({
          expectedCount: 2,
          inventoryCountSource: 'parsed-profile-links',
          inventoryLevel: 'directory-page',
        }),
      }),
    ]));
  });

  it('turns a gig-linked artist page into a profile without recursively discovering more gigs', () => {
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
    expect(parsed.nextRequests).toEqual([]);
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

  it('matches live venue markup and ignores the Cancelled Dates navigation label', () => {
    const html = `
      <html><head><title>Matt Dean gig at The Devon Arms, Torquay on Friday 1 May 2026 at 9.00pm - Lemonrock Gig Guide</title></head><body>
        <nav><a href="/cancellations.php">Cancelled Dates</a></nav>
        <span class="greybold"><a href="/mattdean">Matt Dean</a></span>
        at <a href="/devonarms"><strong>The Devon Arms</strong>, Torquay</a>
        <p>9pm - 11.30pm | FREE!</p>
      </body></html>`;
    const parsed = parseLemonrock(
      html,
      'https://www.lemonrock.com/gig.php?id=939252',
      run('lemonrock-gig-hydration', { kind: 'gig', auditRun: true }),
    );

    expect(parsed.events[0]).toMatchObject({
      artistExternalId: 'lemonrock:artist:mattdean',
      venueExternalId: 'lemonrock:venue:devonarms',
      status: 'confirmed',
    });
    expect(parsed.events[0]?.claims?.some((claim) => JSON.stringify(claim.value).includes('cancellationText'))).toBe(false);
    expect(parsed.nextRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'lemonrock-artist-hydration' }),
      expect.objectContaining({ sourceId: 'lemonrock-venue-hydration' }),
    ]));
  });

  it('carries explicit cancellation authority from the cancellation feed to gig hydration', () => {
    const listing = parseLemonrock(
      '<html><body><a href="/gig.php?id=939252">Cancelled gig</a></body></html>',
      'https://www.lemonrock.com/cancellations.php',
      run('lemonrock-cancellations', { kind: 'cancellations' }),
    );
    const task = listing.nextRequests?.[0]?.task;
    expect(task).toMatchObject({ kind: 'gig', explicitCancellation: true });

    const gig = parseLemonrock(
      '<html><head><title>Example Band gig at Example Arms on 27 August 2026 - Lemonrock Gig Guide</title></head><body><a href="/exampleband">Example Band</a><a href="/examplearms">Example Arms</a></body></html>',
      'https://www.lemonrock.com/gig.php?id=939252',
      run('lemonrock-gig-hydration', task),
    );
    expect(gig.events[0]?.status).toBe('cancelled');
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

  it('performs a daily future health check without national fan-out', () => {
    const html = `
      <html><body>
        <a href="/gigsincounty.php?county=Greater+Manchester">Greater Manchester (120 gigs)</a>
        <a href="/gigsincounty.php?county=London">London (900 gigs)</a>
      </body></html>`;
    const parsed = parseLemonrock(
      html,
      'https://www.lemonrock.com/gigsbycounty.php',
      run('lemonrock-future-reconcile', { kind: 'future-health' }),
    );
    expect(parsed.nextRequests).toEqual([]);
    expect(parsed.warnings).toEqual([
      'Lemonrock future-gig health check observed 2 county/index links without fan-out',
    ]);
  });

  it('keeps hourly feeds bounded to current-page gigs', () => {
    const html = `
      <html><body>
        <a href="/gigs-in-torquay">Global navigation</a>
        <a href="/?cityId=28398&amp;gigfromdate=2026-09-01&amp;listingPeriod=11">Dated navigation</a>
        <a href="/gig.php?id=930726">Gig details</a>
      </body></html>`;
    const parsed = parseLemonrock(
      html,
      'https://www.lemonrock.com/newestgigs.php',
      run('lemonrock-new-gigs', { kind: 'new-gigs' }),
    );
    expect(parsed.nextRequests).toEqual([
      expect.objectContaining({
        sourceId: 'lemonrock-gig-hydration',
        task: expect.objectContaining({
          kind: 'gig',
          nativeId: 'lemonrock:gig:930726',
          refreshWindow: 'hourly',
        }),
      }),
    ]);
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
        task: expect.objectContaining({
          kind: 'gig',
          nativeId: 'lemonrock:gig:930726',
          refreshWindow: 'monthly',
        }),
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
        task: expect.objectContaining({ kind: 'artist-index', auditRun: true, directoryAuditOnly: true }),
      }),
      expect.objectContaining({
        sourceId: 'lemonrock-venue-index',
        task: expect.objectContaining({ kind: 'venue-index', auditRun: true, directoryAuditOnly: true }),
      }),
      expect.objectContaining({
        sourceId: 'lemonrock-future-reconcile',
        task: expect.objectContaining({ kind: 'future-index', auditRun: true }),
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

  it('counts directory inventory during a national audit without hydrating dormant profiles', () => {
    const html = `
      <html><head><title>All Bands (A) (2) - Lemonrock Gig Guide</title></head><body>
        <a href="/alpha"><strong>Alpha</strong></a>
        <a href="/beta"><strong>Beta</strong></a>
        <a href="/allbands.php?_start=B&amp;all=0">B</a>
      </body></html>`;
    const parsed = parseLemonrock(
      html,
      'https://www.lemonrock.com/allbands.php?_start=A&all=1',
      run('lemonrock-artist-index', {
        kind: 'artist-index-page',
        auditRun: true,
        directoryAuditOnly: true,
      }),
    );
    const tasks = parsed.nextRequests ?? [];
    expect(tasks.some((item) => item.sourceId === 'lemonrock-artist-hydration')).toBe(false);
    expect(tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'lemonrock-artist-index',
        task: expect.objectContaining({
          kind: 'artist-index-page',
          auditRun: true,
          directoryAuditOnly: true,
        }),
      }),
      expect.objectContaining({
        task: expect.objectContaining({
          kind: 'artist-inventory-control',
          auditRun: true,
          expectedCount: 2,
          observedCount: 2,
        }),
      }),
    ]));
  });

  it('propagates national-audit lineage from listings through gigs to attached profiles', () => {
    const listing = parseLemonrock(
      '<html><body><a href="/gig.php?id=939252">Example Band at Example Arms</a></body></html>',
      'https://www.lemonrock.com/gigs-in-manchester',
      run('lemonrock-future-reconcile', { kind: 'gig-index', auditRun: true }),
    );
    expect(listing.nextRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'lemonrock-gig-hydration',
        task: expect.objectContaining({ auditRun: true }),
      }),
    ]));

    const gig = parseLemonrock(
      `<html><head><title>Example Band gig at Example Arms on 27 August 2026 - Lemonrock Gig Guide</title></head><body>
        <a href="/exampleband">Example Band</a><a href="/examplearms">Example Arms</a>
      </body></html>`,
      'https://www.lemonrock.com/gig.php?id=939252',
      run('lemonrock-gig-hydration', { kind: 'gig', auditRun: true }),
    );
    expect(gig.nextRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'lemonrock-artist-hydration',
        task: expect.objectContaining({ auditRun: true }),
      }),
      expect.objectContaining({
        sourceId: 'lemonrock-venue-hydration',
        task: expect.objectContaining({ auditRun: true }),
      }),
    ]));
  });

});
