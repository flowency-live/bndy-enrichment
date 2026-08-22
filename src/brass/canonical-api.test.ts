import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BrassCanonicalApi } from './canonical-api.js';
import type { BrassBandProjectionPackage } from './projection.js';
import type { EventCandidate } from '../domain/schema.js';

function projection(): BrassBandProjectionPackage {
  return {
    projectionVersion: 2,
    entityType: 'artist',
    edition: 'brass',
    proposedId: 'brass_test',
    record: {
      name: 'Test Brass Band',
      artist_type: 'band',
      performerKind: 'brass_band',
      publicationScopes: ['brass'],
      discoveryScopes: ['brass'],
      location: 'Test Town, Testshire',
      websiteUrl: 'https://example.test',
      name_variants: ['Test Band'],
      names: [{ name: 'Test Brass Band', nameType: 'current_official', sourceUrls: ['https://example.test'], confidence: 0.99 }],
      acts: [],
      domainProfiles: { brass: { organisationType: 'brass_band', town: 'Test Town', county: 'Testshire', country: 'United Kingdom', officialWebsiteUrl: 'https://example.test', sourceRefs: ['https://example.test', 'https://evidence.test'] } },
      source: 'bndy-brass-intelligence',
      ai_created: true,
      needs_review: false,
    },
    provenance: { identityConfidence: 0.99, sourceUrls: ['https://example.test', 'https://evidence.test'], observationSourceIds: ['test'], generatedAt: new Date().toISOString() },
    publishable: true,
    holdReasons: [],
    enrichmentFlags: [],
  };
}

function eventCandidate(): EventCandidate {
  return {
    artistName: 'Test Brass Band',
    venueName: 'Test Town Hall',
    town: 'Test Town',
    eventDate: '2026-10-04',
    startTime: '14:30',
    timezone: 'Europe/London',
    cancelled: false,
    confidence: 0.98,
    sourceUrls: ['https://example.test/concert'],
    eventUrl: 'https://example.test/concert',
    supportActs: [],
    ticketing: { expected: true, status: 'found', ticketUrl: 'https://tickets.example.test/concert', evidenceUrls: ['https://example.test/concert'] },
    admission: { status: 'PAID_CONFIRMED', confidence: 0.98, priceText: '£15', evidenceUrls: ['https://example.test/concert'] },
  };
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('BrassCanonicalApi', () => {
  beforeEach(() => { process.env.BNDY_SERVICE_TOKEN = 'test-token'; });
  afterEach(() => { delete process.env.BNDY_SERVICE_TOKEN; });

  it('sends brass scope in the initial MCP artist request', async () => {
    let captured: Record<string, unknown> | undefined;
    const fetchImpl: typeof fetch = async (_url, init) => {
      captured = JSON.parse(String(init?.body));
      return response(201, { action: 'created', artist: { id: 'a1', name: 'Test Brass Band', publicationScopes: ['brass'], discoveryScopes: ['brass'], performerKind: 'brass_band' } });
    };
    const api = new BrassCanonicalApi('https://api.test', fetchImpl);
    const result = await api.ensureBand(projection());
    expect(result.action).toBe('created');
    expect(captured).toMatchObject({
      performerKind: 'brass_band',
      publicationScopes: ['brass'],
      discoveryScopes: ['brass'],
      nameVariants: ['Test Band'],
    });
  });

  it('refuses to widen a matched live artist', async () => {
    const fetchImpl: typeof fetch = async () => response(200, { action: 'matched', matchedBy: 'name', artist: { id: 'live1', name: 'Test Brass Band', publicationScopes: ['live'], discoveryScopes: ['live'] } });
    const api = new BrassCanonicalApi('https://api.test', fetchImpl);
    await expect(api.ensureBand(projection())).rejects.toThrow(/^SCOPE_CONFLICT:/);
  });

  it('accepts an existing brass-scoped artist match', async () => {
    const fetchImpl: typeof fetch = async () => response(200, { action: 'matched', matchedBy: 'external_id', artist: { id: 'b1', name: 'Test Brass Band', publicationScopes: ['brass'], discoveryScopes: ['brass'], performerKind: 'brass_band' } });
    const api = new BrassCanonicalApi('https://api.test', fetchImpl);
    const result = await api.ensureBand(projection());
    expect(result).toMatchObject({ id: 'b1', action: 'matched', publicationScopes: ['brass'] });
  });

  it('fails if a supposedly created artist does not return brass publication scope', async () => {
    const fetchImpl: typeof fetch = async () => response(201, { action: 'created', artist: { id: 'bad1', name: 'Test Brass Band' } });
    const api = new BrassCanonicalApi('https://api.test', fetchImpl);
    await expect(api.ensureBand(projection())).rejects.toThrow(/^ATOMIC_SCOPE_FAILURE:/);
  });

  it('refuses a non-publishable projection before making a request', async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => { called = true; return response(500, {}); };
    const api = new BrassCanonicalApi('https://api.test', fetchImpl);
    const held = projection();
    held.publishable = false;
    held.holdReasons = ['review'];
    await expect(api.ensureBand(held)).rejects.toThrow('Refusing non-publishable projection');
    expect(called).toBe(false);
  });

  it('creates a new Venue with brass publication, no discovery scope, and no guessed venue kind', async () => {
    let captured: Record<string, unknown> | undefined;
    const fetchImpl: typeof fetch = async (url, init) => {
      expect(String(url)).toContain('/api/venues/find-or-create/mcp');
      captured = JSON.parse(String(init?.body));
      return response(201, { action: 'created', venue: { id: 'v1', name: 'Test Town Hall', publicationScopes: ['brass'], discoveryScopes: [], latitude: 53.1, longitude: -2.2 } });
    };
    const api = new BrassCanonicalApi('https://api.test', fetchImpl);
    const result = await api.ensureVenue(eventCandidate());
    expect(captured).toMatchObject({ publicationScopes: ['brass'], discoveryScopes: [] });
    expect(captured).not.toHaveProperty('venueKind');
    expect(result).toMatchObject({ id: 'v1', action: 'created', discoveryScopes: [] });
  });

  it('allows reuse of an existing live Venue without widening it', async () => {
    const fetchImpl: typeof fetch = async () => response(200, { action: 'matched', venue: { id: 'live-v', name: 'Test Town Hall', publicationScopes: ['live'], discoveryScopes: ['live'], latitude: 53.1, longitude: -2.2 } });
    const api = new BrassCanonicalApi('https://api.test', fetchImpl);
    const result = await api.ensureVenue(eventCandidate());
    expect(result).toMatchObject({ id: 'live-v', action: 'matched', publicationScopes: ['live'], discoveryScopes: ['live'] });
  });

  it('rejects a newly created Venue if discovery scope was widened', async () => {
    const fetchImpl: typeof fetch = async () => response(201, { action: 'created', venue: { id: 'bad-v', name: 'Test Town Hall', publicationScopes: ['brass'], discoveryScopes: ['live'] } });
    const api = new BrassCanonicalApi('https://api.test', fetchImpl);
    await expect(api.ensureVenue(eventCandidate())).rejects.toThrow(/^VENUE_DISCOVERY_SCOPE_FAILURE:/);
  });

  it('creates a Concert with brass scope atomically', async () => {
    let captured: Record<string, unknown> | undefined;
    const fetchImpl: typeof fetch = async (url, init) => {
      expect(String(url)).toContain('/api/events/community/mcp');
      captured = JSON.parse(String(init?.body));
      return response(201, { event: { id: 'e1', publicationScopes: ['brass'] } });
    };
    const api = new BrassCanonicalApi('https://api.test', fetchImpl);
    const result = await api.ensureConcert(eventCandidate(), 'band1', 'venue1');
    expect(captured).toMatchObject({ artistId: 'band1', venueId: 'venue1', publicationScopes: ['brass'], eventKind: 'concert', ticketed: true });
    expect(result).toEqual({ id: 'e1', created: true, duplicate: false });
  });

  it('returns existing Event IDs from the canonical duplicate gate', async () => {
    const fetchImpl: typeof fetch = async () => response(409, { existingEventId: 'existing-e' });
    const api = new BrassCanonicalApi('https://api.test', fetchImpl);
    await expect(api.ensureConcert(eventCandidate(), 'band1', 'venue1')).resolves.toEqual({ id: 'existing-e', created: false, duplicate: true });
  });
});
