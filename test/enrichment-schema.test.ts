import { describe, expect, it } from 'vitest';
import { DiscoveryResponseSchema } from '../src/domain/schema.js';

describe('enrichment response schema', () => {
  it('captures Facebook/bio enrichment and ticket details', () => {
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
          expected: true,
          status: 'found',
          ticketUrl: 'https://tickets.example.com/event',
          provider: 'Example Tickets',
          priceText: '£15',
          evidenceUrls: ['https://tickets.example.com/event'],
        },
      }],
    });

    expect(parsed.entityEnrichment.facebook.status).toBe('matched');
    expect(parsed.events[0].ticketing.ticketUrl).toContain('tickets.example.com');
  });

  it('records an attempted Facebook search even when no match is found', () => {
    const parsed = DiscoveryResponseSchema.parse({
      identityConfidence: 0.8,
      entityEnrichment: {
        entityType: 'artist',
        name: 'Unknown Local Band',
        facebook: {
          searched: true,
          status: 'not_found',
          confidence: 0.2,
          evidenceUrls: ['https://example.com/search-evidence'],
        },
        bio: { evidenceUrls: [] },
        evidenceUrls: ['https://example.com/search-evidence'],
      },
      discoveredEntities: [],
      events: [],
    });

    expect(parsed.entityEnrichment.facebook.searched).toBe(true);
    expect(parsed.entityEnrichment.facebook.status).toBe('not_found');
  });
});
