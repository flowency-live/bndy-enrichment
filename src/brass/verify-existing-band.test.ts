import { describe, expect, it } from 'vitest';
import { duplicateArtistIdFromError, verifyExistingBrassBand } from './verify-existing-band.js';

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('duplicateArtistIdFromError', () => {
  it('extracts the canonical Artist ID from a 409 body', () => {
    const message = 'BNDY API 409 /api/artists/find-or-create/mcp: {"error":"Duplicate artist","existingArtistId":"band-1"}';
    expect(duplicateArtistIdFromError(message)).toBe('band-1');
  });

  it('does not classify unrelated failures as duplicates', () => {
    expect(duplicateArtistIdFromError('BNDY API 500 /api/artists/find-or-create/mcp: {}')).toBeNull();
  });
});

describe('verifyExistingBrassBand', () => {
  it('accepts the exact existing ID only when the Brass API proves brass scope and kind', async () => {
    const fetchImpl: typeof fetch = async () => response(200, [
      { id: 'band-1', name: 'Test Band', publicationScopes: ['brass'], discoveryScopes: ['brass'], performerKind: 'brass_band', locationLat: 53.1, locationLng: -2.2 },
    ]);
    await expect(verifyExistingBrassBand('band-1', fetchImpl, 'https://brass.test')).resolves.toMatchObject({
      id: 'band-1', publicationScopes: ['brass'], performerKind: 'brass_band', locationLat: 53.1, locationLng: -2.2,
    });
  });

  it('rejects a same-ID record that is not explicitly brass scoped', async () => {
    const fetchImpl: typeof fetch = async () => response(200, [
      { id: 'band-1', publicationScopes: ['live'], performerKind: 'band' },
    ]);
    await expect(verifyExistingBrassBand('band-1', fetchImpl, 'https://brass.test')).resolves.toBeNull();
  });

  it('rejects when the duplicate ID is absent from the Brass API', async () => {
    const fetchImpl: typeof fetch = async () => response(200, [
      { id: 'other', publicationScopes: ['brass'], performerKind: 'brass_band' },
    ]);
    await expect(verifyExistingBrassBand('band-1', fetchImpl, 'https://brass.test')).resolves.toBeNull();
  });
});
