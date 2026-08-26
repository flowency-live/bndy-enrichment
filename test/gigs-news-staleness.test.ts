import { describe, expect, it } from 'vitest';
import { dayHeadingDates, editionIsFresh } from '../src/sources/adapters/gigs-news/staleness.js';

describe('GigsNews staleness gate', () => {
  it('uses dated day headings rather than the weekly banner', () => {
    const body = "What's on This Week 21 - 14 June\nWednesday 17th June\nBand - Venue\nSaturday 20th June\nBand 2 - Venue 2";
    expect(dayHeadingDates(body, '2026-06-17')).toEqual(['2026-06-17', '2026-06-20']);
    expect(editionIsFresh(body, '2026-06-17')).toBe(true);
    expect(editionIsFresh(body, '2026-08-26')).toBe(false);
  });

  it('handles year boundaries and rejects undated captures', () => {
    expect(dayHeadingDates('Wednesday 30th December', '2027-01-02')).toEqual(['2026-12-30']);
    expect(dayHeadingDates('Friday 2nd January', '2026-12-28')).toEqual(['2027-01-02']);
    expect(editionIsFresh('nothing dated here', '2026-06-17')).toBe(false);
  });
});
