import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiscoveryResult } from './schema.js';
import {
  mapToArtistEnrichmentData,
  mapToVenueEnrichmentData,
  hasEnrichmentData,
  mapConfidence,
  writeEnrichmentToEntity,
} from './write-back.js';

const makeArtistResult = (overrides: Partial<DiscoveryResult> = {}): DiscoveryResult => ({
  runId: 'test-run-123',
  entity: {
    type: 'artist',
    bndyId: 'artist-uuid-123',
    name: 'Test Artist',
    town: 'Bristol',
  },
  retrievedAt: '2026-08-11T10:00:00.000Z',
  identityConfidence: 0.95,
  entityEnrichment: {
    entityType: 'artist',
    name: 'Test Artist',
    town: 'Bristol',
    facebook: {
      searched: true,
      status: 'matched',
      url: 'https://facebook.com/testartist',
      confidence: 0.9,
      evidenceUrls: ['https://example.com/evidence1'],
    },
    bio: {
      text: 'A great local band playing rock covers.',
      evidenceUrls: ['https://example.com/bio-source'],
    },
    artistProfile: {
      genres: ['Rock', 'Blues'],
      genreEvidence: [],
      actTypes: ['Covers'],
      actTypeEvidence: [],
      artistType: 'Band',
    },
    evidenceUrls: ['https://example.com/main-evidence'],
  },
  discoveredEntities: [],
  events: [],
  heldEvents: [],
  expansionEligibleEvents: [],
  commercialEntities: [],
  eligibility: {
    classification: 'LIKELY_GRASSROOTS',
    autoEnrich: true,
    suppressed: false,
    suppressionDays: 0,
    freeEventsSeen: 1,
    paidEventsSeen: 0,
    unknownEventsSeen: 0,
    ticketedVenue: false,
    reason: 'At least one confirmed free event and no paid event was found',
  },
  evidence: [],
  metrics: {
    latencyMs: 5000,
    searchQueries: 4,
    followUpSearches: 0,
    admissionFollowUps: 0,
    richEnrichmentFollowUps: 0,
  },
  ...overrides,
});

const makeVenueResult = (overrides: Partial<DiscoveryResult> = {}): DiscoveryResult => ({
  ...makeArtistResult(),
  entity: {
    type: 'venue',
    bndyId: 'venue-uuid-456',
    name: 'The Local Pub',
    town: 'Bristol',
  },
  entityEnrichment: {
    entityType: 'venue',
    name: 'The Local Pub',
    town: 'Bristol',
    officialWebsite: 'https://thelocalpub.co.uk',
    facebook: {
      searched: true,
      status: 'matched',
      url: 'https://facebook.com/thelocalpub',
      confidence: 0.85,
      evidenceUrls: ['https://example.com/venue-evidence'],
    },
    bio: {
      text: 'A friendly pub with live music every weekend.',
      evidenceUrls: [],
    },
    evidenceUrls: ['https://example.com/venue-main'],
  },
  ...overrides,
});

describe('mapConfidence', () => {
  it('returns HIGH for confidence >= 0.85', () => {
    expect(mapConfidence(0.85)).toBe('HIGH');
    expect(mapConfidence(0.95)).toBe('HIGH');
    expect(mapConfidence(1.0)).toBe('HIGH');
  });

  it('returns MEDIUM for confidence >= 0.6 and < 0.85', () => {
    expect(mapConfidence(0.6)).toBe('MEDIUM');
    expect(mapConfidence(0.75)).toBe('MEDIUM');
    expect(mapConfidence(0.84)).toBe('MEDIUM');
  });

  it('returns LOW for confidence < 0.6', () => {
    expect(mapConfidence(0.0)).toBe('LOW');
    expect(mapConfidence(0.3)).toBe('LOW');
    expect(mapConfidence(0.59)).toBe('LOW');
  });
});

describe('hasEnrichmentData', () => {
  it('returns true when facebook URL is found', () => {
    const result = makeArtistResult();
    expect(hasEnrichmentData(result.entityEnrichment)).toBe(true);
  });

  it('returns true when bio text exists', () => {
    const result = makeArtistResult({
      entityEnrichment: {
        entityType: 'artist',
        name: 'Test',
        facebook: { searched: false, status: 'not_searched', confidence: 0, evidenceUrls: [] },
        bio: { text: 'Some bio', evidenceUrls: [] },
        evidenceUrls: [],
      },
    });
    expect(hasEnrichmentData(result.entityEnrichment)).toBe(true);
  });

  it('returns true when genres are found', () => {
    const result = makeArtistResult({
      entityEnrichment: {
        entityType: 'artist',
        name: 'Test',
        facebook: { searched: false, status: 'not_searched', confidence: 0, evidenceUrls: [] },
        bio: { evidenceUrls: [] },
        artistProfile: { genres: ['Rock'], genreEvidence: [], actTypes: [], actTypeEvidence: [] },
        evidenceUrls: [],
      },
    });
    expect(hasEnrichmentData(result.entityEnrichment)).toBe(true);
  });

  it('returns true when officialWebsite is found', () => {
    const result = makeVenueResult();
    expect(hasEnrichmentData(result.entityEnrichment)).toBe(true);
  });

  it('returns false when no meaningful data exists', () => {
    const result = makeArtistResult({
      entityEnrichment: {
        entityType: 'artist',
        name: 'Test',
        facebook: { searched: true, status: 'not_found', confidence: 0, evidenceUrls: [] },
        bio: { evidenceUrls: [] },
        evidenceUrls: [],
      },
    });
    expect(hasEnrichmentData(result.entityEnrichment)).toBe(false);
  });
});

describe('mapToArtistEnrichmentData', () => {
  it('maps all artist enrichment fields correctly', () => {
    const result = makeArtistResult();
    const data = mapToArtistEnrichmentData(result);

    expect(data.suggested_facebookUrl).toBe('https://facebook.com/testartist');
    expect(data.suggested_bio).toBe('A great local band playing rock covers.');
    expect(data.suggested_genres).toEqual(['Rock', 'Blues']);
    expect(data.suggested_artistType).toBe('Band');
    expect(data.suggested_actTypes).toEqual(['Covers']);
    expect(data.confidence).toBe('HIGH');
    expect(data.date).toBe('2026-08-11T10:00:00.000Z');
    expect(data.evidenceUrls).toContain('https://example.com/main-evidence');
  });

  it('handles missing optional fields', () => {
    const result = makeArtistResult({
      entityEnrichment: {
        entityType: 'artist',
        name: 'Test',
        facebook: { searched: true, status: 'not_found', confidence: 0, evidenceUrls: [] },
        bio: { evidenceUrls: [] },
        evidenceUrls: [],
      },
    });
    const data = mapToArtistEnrichmentData(result);

    expect(data.suggested_facebookUrl).toBeUndefined();
    expect(data.suggested_bio).toBeUndefined();
    expect(data.suggested_genres).toBeUndefined();
    expect(data.suggested_artistType).toBeUndefined();
    expect(data.suggested_actTypes).toBeUndefined();
  });

  it('builds notes from AI evidence', () => {
    const result = makeArtistResult();
    const data = mapToArtistEnrichmentData(result);

    expect(data.notes).toBeDefined();
    expect(data.notes.length).toBeGreaterThan(0);
  });
});

describe('mapToVenueEnrichmentData', () => {
  it('maps all venue enrichment fields correctly', () => {
    const result = makeVenueResult();
    const data = mapToVenueEnrichmentData(result);

    expect(data.suggested_website).toBe('https://thelocalpub.co.uk');
    expect(data.suggested_facebook).toBe('https://facebook.com/thelocalpub');
    expect(data.confidence).toBe('HIGH');
    expect(data.date).toBe('2026-08-11T10:00:00.000Z');
  });

  it('handles missing optional fields', () => {
    const result = makeVenueResult({
      entityEnrichment: {
        entityType: 'venue',
        name: 'Test Venue',
        facebook: { searched: true, status: 'not_found', confidence: 0, evidenceUrls: [] },
        bio: { evidenceUrls: [] },
        evidenceUrls: [],
      },
    });
    const data = mapToVenueEnrichmentData(result);

    expect(data.suggested_website).toBeNull();
    expect(data.suggested_facebook).toBeNull();
  });
});

describe('writeEnrichmentToEntity', () => {
  const mockSend = vi.fn();
  const mockDdb = { send: mockSend } as unknown as Parameters<typeof writeEnrichmentToEntity>[0];

  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('writes artist enrichment data to ARTISTS_TABLE with snake_case fields', async () => {
    const result = makeArtistResult();
    await writeEnrichmentToEntity(mockDdb, result, 'bndy-artists', 'bndy-venues');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input.TableName).toBe('bndy-artists');
    expect(command.input.Key).toEqual({ id: 'artist-uuid-123' });
    expect(command.input.UpdateExpression).toContain('enrichment_status');
    expect(command.input.ExpressionAttributeValues[':status']).toBe('high_confidence');
  });

  it('writes venue enrichment data to VENUES_TABLE with snake_case fields', async () => {
    const result = makeVenueResult();
    await writeEnrichmentToEntity(mockDdb, result, 'bndy-artists', 'bndy-venues');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input.TableName).toBe('bndy-venues');
    expect(command.input.Key).toEqual({ id: 'venue-uuid-456' });
    expect(command.input.UpdateExpression).toContain('enrichment_status');
  });

  it('skips write when eligibility is suppressed', async () => {
    const result = makeArtistResult({
      eligibility: {
        classification: 'COMMERCIAL_TICKETING',
        autoEnrich: false,
        suppressed: true,
        suppressionDays: 270,
        freeEventsSeen: 0,
        paidEventsSeen: 5,
        unknownEventsSeen: 0,
        ticketedVenue: false,
        reason: 'Commercial artist',
      },
    });

    await writeEnrichmentToEntity(mockDdb, result, 'bndy-artists', 'bndy-venues');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips write when no meaningful enrichment data exists', async () => {
    const result = makeArtistResult({
      entityEnrichment: {
        entityType: 'artist',
        name: 'Test',
        facebook: { searched: true, status: 'not_found', confidence: 0, evidenceUrls: [] },
        bio: { evidenceUrls: [] },
        evidenceUrls: [],
      },
    });

    await writeEnrichmentToEntity(mockDdb, result, 'bndy-artists', 'bndy-venues');
    expect(mockSend).not.toHaveBeenCalled();
  });
});
