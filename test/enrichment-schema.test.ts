import { describe, expect, it } from 'vitest';
import { DiscoveryResponseSchema } from '../src/domain/schema.js';

describe('enrichment response schema', () => {
  it('captures Facebook/bio plus controlled bndy artist classification', () => {
    const parsed = DiscoveryResponseSchema.parse({
      identityConfidence: 0.99,
      entityEnrichment: {
        entityType: 'artist',
        name: "The Screaming 45's",
        facebook: {
          searched: true,
          status: 'matched',
          url: 'https://www.facebook.com/Screaming45s/',
          confidence: 0.99,
          evidenceUrls: ['https://www.facebook.com/Screaming45s/'],
        },
        bio: {
          text: '5 piece rock band playing rock from the 70s to now plus indie/alt favourites',
          evidenceUrls: ['https://www.facebook.com/Screaming45s/'],
        },
        artistProfile: {
          genres: ['Rock', 'Indie', 'Alternative'],
          genreEvidence: [
            {
              genre: 'Rock',
              confidence: 0.99,
              source: 'artist_declared',
              evidenceUrls: ['https://www.facebook.com/Screaming45s/'],
              rawText: '5 piece rock band',
            },
            {
              genre: 'Indie',
              confidence: 0.95,
              source: 'artist_declared',
              evidenceUrls: ['https://www.facebook.com/Screaming45s/'],
              rawText: 'indie/alt favourites',
            },
            {
              genre: 'Alternative',
              confidence: 0.95,
              source: 'artist_declared',
              evidenceUrls: ['https://www.facebook.com/Screaming45s/'],
              rawText: 'indie/alt favourites',
            },
          ],
          artistType: 'Band',
          artistTypeEvidence: {
            confidence: 0.99,
            source: 'artist_declared',
            evidenceUrls: ['https://www.facebook.com/Screaming45s/'],
            rawText: '5 piece rock band',
          },
          actTypes: ['Covers'],
          actTypeEvidence: [{
            actType: 'Covers',
            confidence: 0.9,
            source: 'gemini_inferred',
            evidenceUrls: ['https://www.facebook.com/Screaming45s/'],
          }],
          acousticPerformances: false,
          acousticEvidence: {
            confidence: 0.7,
            source: 'gemini_inferred',
            evidenceUrls: ['https://www.facebook.com/Screaming45s/'],
          },
        },
        evidenceUrls: ['https://www.facebook.com/Screaming45s/'],
      },
      discoveredEntities: [],
      events: [{
        artistName: "The Screaming 45's",
        venueName: 'The High Crown',
        eventDate: '2026-10-17',
        timezone: 'Europe/London',
        cancelled: false,
        confidence: 0.95,
        sourceUrls: ['https://example.com/event'],
        supportActs: [],
        ticketing: {
          expected: false,
          status: 'not_applicable',
          evidenceUrls: [],
        },
        admission: {
          status: 'FREE_CONFIRMED',
          confidence: 0.99,
          evidenceUrls: ['https://example.com/event'],
          reason: 'Official event listing says free entry',
        },
      }],
    });

    expect(parsed.entityEnrichment.facebook.status).toBe('matched');
    expect(parsed.entityEnrichment.artistProfile?.genres).toEqual(['Rock', 'Indie', 'Alternative']);
    expect(parsed.entityEnrichment.artistProfile?.artistType).toBe('Band');
    expect(parsed.entityEnrichment.artistProfile?.actTypes).toEqual(['Covers']);
    expect(parsed.events[0].admission.status).toBe('FREE_CONFIRMED');
  });

  it('supports a cheap reconnaissance placeholder before Facebook/classification enrichment', () => {
    const parsed = DiscoveryResponseSchema.parse({
      identityConfidence: 0.8,
      entityEnrichment: {
        entityType: 'artist',
        name: 'Unknown Local Band',
        facebook: {
          searched: false,
          status: 'not_searched',
          confidence: 0,
          evidenceUrls: [],
        },
        bio: { evidenceUrls: [] },
        evidenceUrls: ['https://example.com/gig'],
      },
      discoveredEntities: [],
      events: [],
    });

    expect(parsed.entityEnrichment.facebook.searched).toBe(false);
    expect(parsed.entityEnrichment.facebook.status).toBe('not_searched');
    expect(parsed.entityEnrichment.artistProfile).toBeUndefined();
  });

  it('rejects genres outside the existing bndy taxonomy', () => {
    expect(() => DiscoveryResponseSchema.parse({
      identityConfidence: 0.99,
      entityEnrichment: {
        entityType: 'artist',
        name: 'Test Artist',
        facebook: { searched: true, status: 'matched', confidence: 1, evidenceUrls: [] },
        bio: { evidenceUrls: [] },
        artistProfile: {
          genres: ['Shoegaze'],
          genreEvidence: [],
          actTypes: [],
          actTypeEvidence: [],
        },
        evidenceUrls: [],
      },
      discoveredEntities: [],
      events: [],
    })).toThrow();
  });
});
