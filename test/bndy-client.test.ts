import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureEventIsTicketed, createEvent, findOrCreateArtist } from '../src/bndy/client.js';

describe('findOrCreateArtist', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BNDY_SERVICE_TOKEN;
  });

  it('returns a structured review result when the API responds 422 with action review', async () => {
    process.env.BNDY_SERVICE_TOKEN = 'test-service-token';
    const body = {
      action: 'review',
      error: 'Location cannot be resolved to a region.',
      code: 'LOCATION_UNRESOLVABLE',
      candidates: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
      status: 422,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await findOrCreateArtist({
      name: 'Example Artist',
      facebookUrl: 'https://www.facebook.com/example-artist',
      location: 'United Kingdom',
      locationType: 'regional',
      artistType: 'Band',
      actTypes: ['Covers'],
      genres: ['Rock'],
      confidence: 0.9,
      evidenceUrls: ['https://www.facebook.com/example-artist'],
    }, 'capture-123');

    expect(result).toMatchObject({
      action: 'review',
      candidates: [],
      raw: body,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.bndy.co.uk/api/artists/find-or-create',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reuses the canonical artist when the API returns create_failed DUPLICATE', async () => {
    process.env.BNDY_SERVICE_TOKEN = 'test-service-token';
    const body = {
      action: 'create_failed',
      error: 'Duplicate artist',
      code: 'DUPLICATE',
      entityType: 'artist',
      existingId: '13944bfd-89ab-402e-95dc-a371fd78fd2f',
      conflictKey: 'artist#torrists#north-west',
      existingArtistId: '13944bfd-89ab-402e-95dc-a371fd78fd2f',
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await findOrCreateArtist({
      name: 'The Torrists',
      facebookUrl: 'https://www.facebook.com/thetorrists',
      location: 'North West',
      locationType: 'regional',
      artistType: 'Band',
      actTypes: ['Covers'],
      genres: ['Rock'],
      confidence: 0.98,
      evidenceUrls: ['https://www.facebook.com/thetorrists'],
    }, 'capture-torrists');

    expect(result).toMatchObject({
      action: 'duplicate',
      artistId: '13944bfd-89ab-402e-95dc-a371fd78fd2f',
      raw: body,
    });
  });

  it('holds a genuinely new incomplete Artist for review after matching has run', async () => {
    process.env.BNDY_SERVICE_TOKEN = 'test-service-token';
    const body = {
      action: 'create_failed',
      error: 'Location and artist type are required to create a new artist.',
      code: 'VALIDATION_ERROR',
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
      status: 422,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await findOrCreateArtist({
      name: 'An Existing-Looking Band',
      confidence: 0.9,
      evidenceUrls: ['https://venue.example/gigs'],
      actTypes: [],
      genres: [],
    }, 'capture-incomplete');

    expect(result).toMatchObject({
      action: 'review',
      reason: body.error,
      raw: body,
    });
  });
});

describe('Capture ticketing policy', () => {
  const baseEvent = {
    artistName: 'Example Artist',
    venueName: 'Example Venue',
    town: 'Manchester',
    date: '2026-09-01',
    admission: 'UNKNOWN' as const,
    cancelled: false,
    confidence: 0.99,
    sourceUrls: ['https://www.facebook.com/events/123456789/'],
  };

  it('defaults unknown and free admission to non-ticketed', () => {
    expect(captureEventIsTicketed(baseEvent)).toBe(false);
    expect(captureEventIsTicketed({ ...baseEvent, admission: 'FREE_CONFIRMED' })).toBe(false);
  });

  it('does not treat a door price alone as ticketed', () => {
    expect(captureEventIsTicketed({ ...baseEvent, admission: 'PAID_CONFIRMED', price: '£5' })).toBe(false);
  });

  it('marks an event ticketed only when ticketing is explicitly identified', () => {
    expect(captureEventIsTicketed({ ...baseEvent, ticketed: true })).toBe(true);
    expect(captureEventIsTicketed({ ...baseEvent, ticketUrl: 'https://tickets.example.com/event' })).toBe(true);
  });
});

describe('createEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BNDY_SERVICE_TOKEN;
  });

  it('sends unknown admission to BNDY as non-ticketed', async () => {
    process.env.BNDY_SERVICE_TOKEN = 'test-service-token';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      event: { id: 'event-123' },
    }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await createEvent('artist-123', 'venue-123', {
      artistName: 'Example Artist',
      venueName: 'Example Venue',
      town: 'Manchester',
      date: '2026-09-01',
      eventUrl: 'https://www.facebook.com/events/123456789/',
      admission: 'UNKNOWN',
      cancelled: false,
      confidence: 0.99,
      sourceUrls: ['https://www.facebook.com/events/123456789/'],
    }, 'capture-unknown-admission');

    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(init?.body));
    expect(payload.ticketed).toBe(false);
  });
});
