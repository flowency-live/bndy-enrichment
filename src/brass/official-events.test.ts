import { describe, expect, it } from 'vitest';
import { extractOfficialEventsFromHtml } from './official-events.js';

const html = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Test Brass in Concert",
  "startDate": "2026-10-04T14:30:00+01:00",
  "url": "/events/test-brass",
  "location": {
    "@type": "Place",
    "name": "Test Town Hall",
    "address": { "addressLocality": "Test Town", "addressRegion": "Testshire" }
  },
  "offers": {
    "@type": "Offer",
    "url": "https://tickets.example.test/test-brass",
    "price": "15.00",
    "priceCurrency": "GBP"
  }
}
</script>
</head><body></body></html>`;

describe('official brass event extraction', () => {
  it('extracts a paid concert from schema.org Event JSON-LD', () => {
    const events = extractOfficialEventsFromHtml(html, 'https://band.example.test/events', 'Test Brass Band');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      artistName: 'Test Brass Band',
      venueName: 'Test Town Hall',
      town: 'Test Town',
      eventDate: '2026-10-04',
      startTime: '14:30',
      eventUrl: 'https://band.example.test/events/test-brass',
      admission: { status: 'PAID_CONFIRMED' },
      ticketing: { status: 'found', ticketUrl: 'https://tickets.example.test/test-brass' },
    });
  });

  it('extracts an explicitly free event without requiring ticket metadata', () => {
    const free = html
      .replace('"offers": {\n    "@type": "Offer",\n    "url": "https://tickets.example.test/test-brass",\n    "price": "15.00",\n    "priceCurrency": "GBP"\n  }', '"isAccessibleForFree": true')
      .replace('Test Brass in Concert', 'Free Brass in the Park');
    const events = extractOfficialEventsFromHtml(free, 'https://band.example.test/events', 'Test Brass Band');
    expect(events[0]).toMatchObject({
      admission: { status: 'FREE_CONFIRMED' },
      ticketing: { status: 'not_applicable', expected: false },
    });
  });

  it('ignores non-Event JSON-LD', () => {
    const page = '<script type="application/ld+json">{"@type":"Organization","name":"Test Brass Band"}</script>';
    expect(extractOfficialEventsFromHtml(page, 'https://band.example.test', 'Test Brass Band')).toEqual([]);
  });
});
