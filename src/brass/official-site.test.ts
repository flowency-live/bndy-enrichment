import { describe, expect, it } from 'vitest';
import { extractLocationFromHtml } from './official-site.js';

describe('extractLocationFromHtml', () => {
  it('prefers structured JSON-LD address data', () => {
    const html = `<script type="application/ld+json">{"@type":"Organization","address":{"@type":"PostalAddress","addressLocality":"Stockport","addressRegion":"Greater Manchester","postalCode":"SK1 1AA"}}</script>`;
    expect(extractLocationFromHtml(html, 'https://example.test/contact')).toEqual({
      town: 'Stockport',
      county: 'Greater Manchester',
      postcode: 'SK1 1AA',
      evidenceUrl: 'https://example.test/contact',
    });
  });

  it('falls back to a UK postcode in visible page text', () => {
    const html = `<div>Bandroom, Example Street, Sandbach, Cheshire CW11 1AA</div>`;
    expect(extractLocationFromHtml(html, 'https://example.test')).toEqual({
      postcode: 'CW11 1AA',
      evidenceUrl: 'https://example.test',
    });
  });

  it('does not interpret CSS colours as postcodes', () => {
    const html = `<style>.panel{background:#F4F1FA;color:#BX95UQ}</style><main>Welcome to the band website</main>`;
    expect(extractLocationFromHtml(html, 'https://example.test')).toBeNull();
  });

  it('ignores invalid JSON-LD postalCode values while keeping valid locality data', () => {
    const html = `<script type="application/ld+json">{"@type":"Organization","address":{"@type":"PostalAddress","addressLocality":"Cheltenham","postalCode":"#F4F1FA"}}</script>`;
    expect(extractLocationFromHtml(html, 'https://example.test')).toEqual({
      town: 'Cheltenham',
      county: undefined,
      postcode: undefined,
      evidenceUrl: 'https://example.test',
    });
  });
});
