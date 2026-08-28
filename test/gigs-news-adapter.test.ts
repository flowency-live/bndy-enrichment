import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GigSource } from '../src/knowledge/types.js';
import type { AcquisitionRequest, AcquisitionRouter } from '../src/sources/runner/acquisition.js';
import type { FetchedSource, SourceRunContext } from '../src/sources/runner/types.js';
import { gigsNewsAdapter } from '../src/sources/adapters/gigs-news/index.js';
import { normaliseGigsNewsGig } from '../src/sources/adapters/gigs-news/normalise.js';
import { parseDayHeader, parseGigRow, parseGigsNewsPage } from '../src/sources/adapters/gigs-news/parse.js';

const fixture = readFileSync('test/fixtures/gigs-news/production-innertext.txt', 'utf8');
const expected = JSON.parse(readFileSync('test/fixtures/gigs-news/production-innertext.expected.json', 'utf8')) as Array<Record<string, unknown>>;

function config(overrides: Partial<GigSource> = {}): GigSource {
  return {
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
    ...overrides,
  };
}

const run: SourceRunContext = {
  runId: 'run-fixture',
  sourceId: 'gigs-news-daily-import',
  startedAt: '2026-06-17T08:00:00.000Z',
  runDate: '2026-06-17',
  reason: 'manual',
  requestedAt: '2026-06-17T08:00:00.000Z',
};

describe('GigsNews donor parser parity', () => {
  it('parses ordinal day headers', () => {
    expect(parseDayHeader('Friday 13th June')).toEqual({ dayOfWeek: 'Friday', dayOfMonth: 13, month: 'June' });
    expect(parseDayHeader('Saturday 2nd June')?.dayOfMonth).toBe(2);
    expect(parseDayHeader('The Ashes at The Royal Oak')).toBeNull();
  });

  it('preserves at-format time parsing and aliases', () => {
    const row = parseGigRow("Callum Carter at The Bull's Head, 8pm");
    expect(row.artist).toBe('Callum Carter');
    expect(row.venueCanonical).toBe("The Bull's Head");
    expect(row.time).toBe('20:00');

    expect(parseGigRow('60% Angels at Mash Guru').venueCanonical).toBe('Mash');
    expect(parseGigRow('Band at Marple Con & Social Club, 8pm').venueCanonical).toBe('Marple Con Club');
  });

  it('preserves donor skip and parking rules', () => {
    expect(parseGigRow('Open Mic at The Local').skipReason).toBe('generic_recurring');
    expect(parseGigRow('Blues Jam at The Local').skipReason).toBe('jam_night');
    expect(parseGigRow('DJ Mark at The Club').skipReason).toBe('generic_dj');
    expect(parseGigRow('Reserved at The Venue').skipReason).toBe('placeholder_performer');
    expect(parseGigRow('Band at Ashton Jubilee Club, 8pm').skipReason).toBe('venue_geocode_risk');
  });

  it('preserves production dash-format quirks including trailing from', () => {
    expect(parseGigRow('Blueheart - Eagle & Child Whitefield')).toMatchObject({
      artist: 'Blueheart', venue: 'Eagle & Child Whitefield', time: null,
    });
    expect(parseGigRow('Roy Pimmy  4:30pm - White Hart Woodley')).toMatchObject({
      artist: 'Roy Pimmy', venue: 'White Hart Woodley', time: '16:30',
    });
    expect(parseGigRow('Chris G from 5pm - Windsor Castle Marple Bridge')).toMatchObject({
      artist: 'Chris G', venue: 'Windsor Castle Marple Bridge', time: '17:00',
    });
  });

  it('reproduces the saved real-format fixture as golden normalised output', () => {
    const parsed = parseGigsNewsPage(fixture, 2026);
    expect(parsed.gigs).toHaveLength(5);
    expect(parsed.parked.some((item) => item.reason === 'generic_recurring')).toBe(true);

    const actual = parsed.gigs.map(normaliseGigsNewsGig).map((event) => ({
      sourceEventKey: event.sourceEventKey,
      artistName: event.artistName,
      artistExternalId: event.artistExternalId,
      venueName: event.venueName,
      venueExternalId: event.venueExternalId,
      venueLocation: event.venueLocation,
      date: event.date,
      startTime: event.startTime,
    }));
    expect(actual).toEqual(expected);
  });

  it('keeps source-native IDs stable and strips act suffixes only for identity', () => {
    const parsed = parseGigsNewsPage('Thursday 18th June\nJon Casey Blues Band - the Welcome Inn Whitefield', 2026);
    const event = normaliseGigsNewsGig(parsed.gigs[0]!);
    expect(event.artistName).toBe('Jon Casey Blues Band');
    expect(event.artistExternalId).toBe('artist_jon-casey-blues');
    expect(event.sourceEventKey).toContain('_jon-casey-blues_');
  });

  it('stops before advertising, booking and contact footer rows', () => {
    const parsed = parseGigsNewsPage([
      'Friday 28th August',
      'A Real Band - The Real Venue',
      'gigs 2026',
      'Sunday 20th September - Cheshire Cheese Newton - Reserved (cancelled - United match)',
      'Chris - 07811 44 7388',
    ].join('\n'), 2026);
    expect(parsed.gigs).toHaveLength(1);
    expect(parsed.gigs[0]).toMatchObject({ artist: 'A Real Band', venue: 'The Real Venue' });
    expect(parsed.gigs.some((gig) => /Chris|cancelled/i.test(`${gig.artist} ${gig.venue}`))).toBe(false);
  });
});

describe('GigsNews target adapter contract', () => {
  it('uses bounded HTTP acquisition for the server-rendered production page', async () => {
    let request: AcquisitionRequest | undefined;
    const acquisition: AcquisitionRouter = {
      async acquire(input): Promise<FetchedSource> {
        request = input;
        return {
          kind: 'html',
          body: fixture,
          sourceUrl: input.url,
          fetchMethod: 'http-html',
          fetchedAt: '2026-06-17T08:00:01.000Z',
          complete: true,
          httpStatus: 200,
          contentType: 'text/html',
        };
      },
    };

    const raw = await gigsNewsAdapter.fetch(config({ runtimeClass: 'standard' }), run, acquisition);
    expect(raw.complete).toBe(true);
    expect(request).toMatchObject({
      url: 'https://gigs-news.uk',
      kind: 'html',
      followRedirects: true,
      maxRedirects: 3,
      fetchMethod: 'http-html',
    });
  });

  it('converts parser parked rows to exception-ready parked records and warnings', async () => {
    const parsed = await gigsNewsAdapter.parse(config(), run, {
      kind: 'text', body: fixture, fetchMethod: 'fixture', fetchedAt: run.startedAt, complete: true,
    });
    expect(parsed.events).toHaveLength(5);
    expect(parsed.parked.length).toBeGreaterThan(0);
    expect(parsed.warnings.some((warning) => warning.includes('defaulted'))).toBe(true);
  });

  it('fails closed instead of producing a complete empty snapshot on structural drift', async () => {
    await expect(gigsNewsAdapter.parse(config(), run, {
      kind: 'text', body: '<html><body>site changed completely</body></html>', fetchMethod: 'fixture', fetchedAt: run.startedAt, complete: true,
    })).rejects.toThrow(/structural gate failed/i);
  });

  it('retains the browser acquisition contract for donor parity replay', async () => {
    let request: AcquisitionRequest | undefined;
    const acquisition: AcquisitionRouter = { async acquire(input) {
      request=input;
      return {kind:'text',body:fixture,sourceUrl:input.url,fetchMethod:'chromium-innerText',fetchedAt:run.startedAt,complete:true};
    } };
    await gigsNewsAdapter.fetch(config({ runtimeClass: 'browser' }), run, acquisition);
    expect(request).toMatchObject({bodyMode:'innerText',settleMs:2000,fetchMethod:'chromium-innerText'});
  });
});
