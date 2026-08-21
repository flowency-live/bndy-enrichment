import { afterEach, describe, expect, it, vi } from 'vitest';
import { findOrCreateArtist } from '../src/bndy/client.js';

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
});
