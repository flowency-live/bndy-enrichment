import { describe, expect, it } from 'vitest';
import { DiscoveryResponseSchema } from '../src/domain/schema.js';

describe('enrichment response schema', () => {
  it('captures Facebook/bio enrichment for an eligible free artist', () => {
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
          text: '5 piece rock band from North-East',
          evidenceUrls: ['https://www.facebook.com/Screaming45s/'],
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
    expect(parsed.events[0].admission.status).toBe('FREE_CONFIRMED');
  });

  it('supports a cheap reconnaissance placeholder before Facebook enrichment', () => {
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
  });
});
