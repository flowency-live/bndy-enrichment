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
});
