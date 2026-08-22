import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BrassCanonicalApi } from './canonical-api.js';
import type { BrassBandProjectionPackage } from './projection.js';

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
});
