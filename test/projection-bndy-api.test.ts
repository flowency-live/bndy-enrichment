import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityResolutionRejectedError, EntityResolutionReviewError, HttpProjectionBndyApi } from '../src/projection/bndy-api.js';
import type { ProjectionEventCandidate } from '../src/projection/candidate.js';

function candidate(): ProjectionEventCandidate {
  return {
    candidateKey: 'event:test-source:gig-1',
    sourceId: 'test-source',
    sourceEventKey: 'gig-1',
    artistName: 'The Test Band',
    venueName: 'The Test Pub',
    venueLocation: 'Stoke',
    date: '2026-09-20',
    startTime: '20:00',
    observedAt: '2026-09-04T12:00:00.000Z',
    supportingClaims: [],
  };
}

function fetchReturning(body: unknown, status = 200) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
}

function sentBody(fetchImpl: ReturnType<typeof fetchReturning>): Record<string, unknown> {
  const init = fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
}

describe('HttpProjectionBndyApi entity resolution', () => {
  beforeEach(() => { process.env.BNDY_SERVICE_TOKEN = 'test-token'; });
  afterEach(() => { delete process.env.BNDY_SERVICE_TOKEN; });

  it('sends canCreate true by default and reports a matched artist', async () => {
    const fetchImpl = fetchReturning({ action: 'matched', artist: { id: 'artist-1', name: 'The Test Band' } });
    const api = new HttpProjectionBndyApi('https://api.test', fetchImpl as unknown as typeof fetch);

    const result = await api.resolveArtist(candidate());

    expect(result).toEqual({ id: 'artist-1', name: 'The Test Band', created: false });
    expect(sentBody(fetchImpl).canCreate).toBe(true);
  });

  it('sends canCreate false in match-only mode and raises a typed review error instead of a generic failure', async () => {
    const fetchImpl = fetchReturning({ action: 'review', reason: 'likely-new', queryName: 'The Test Band', candidates: [] });
    const api = new HttpProjectionBndyApi('https://api.test', fetchImpl as unknown as typeof fetch);

    const attempt = api.resolveArtist(candidate(), { canCreate: false });

    await expect(attempt).rejects.toBeInstanceOf(EntityResolutionReviewError);
    await expect(attempt).rejects.toMatchObject({ entityType: 'artist', entityName: 'The Test Band', reason: 'likely-new', candidates: [] });
    expect(sentBody(fetchImpl).canCreate).toBe(false);
  });

  it('raises the same typed review error for venues', async () => {
    const fetchImpl = fetchReturning({ action: 'review', reason: 'likely-new', queryName: 'The Test Pub', queryCity: 'Stoke', candidates: [{ id: 'venue-9' }] });
    const api = new HttpProjectionBndyApi('https://api.test', fetchImpl as unknown as typeof fetch);

    await expect(api.resolveVenue(candidate(), { canCreate: false })).rejects.toMatchObject({
      entityType: 'venue', entityName: 'The Test Pub', reason: 'likely-new', candidates: [{ id: 'venue-9' }],
    });
    expect(sentBody(fetchImpl).canCreate).toBe(false);
  });

  it('raises a typed rejection when the canonical API refuses an artist name on data quality', async () => {
    const fetchImpl = fetchReturning({ error: 'Artist name failed data-quality validation', code: 'DATA_QUALITY' }, 422);
    const api = new HttpProjectionBndyApi('https://api.test', fetchImpl as unknown as typeof fetch);

    const attempt = api.resolveArtist(candidate());

    await expect(attempt).rejects.toBeInstanceOf(EntityResolutionRejectedError);
    await expect(attempt).rejects.toMatchObject({
      entityType: 'artist', entityName: 'The Test Band', code: 'DATA_QUALITY', detail: 'Artist name failed data-quality validation',
    });
  });

  it('raises the same typed rejection when a venue fails the canonical place-type check without a code', async () => {
    const fetchImpl = fetchReturning({ error: 'Place type "route" indicates a geographic area, not a building.' }, 422);
    const api = new HttpProjectionBndyApi('https://api.test', fetchImpl as unknown as typeof fetch);

    await expect(api.resolveVenue(candidate())).rejects.toMatchObject({
      entityType: 'venue', entityName: 'The Test Pub', code: 'rejected', detail: 'Place type "route" indicates a geographic area, not a building.',
    });
  });
});
