import { describe, expect, it } from 'vitest';
import {
  applyCaptureStartTimeDefaults,
  defaultCaptureStartTime,
  eventShouldPublish,
  reviewableProjectionError,
  hasStrongMultiVenueArtistEvidence,
} from '../src/handlers/capture-processor.js';
import type { CaptureArtist, CaptureEvent } from '../src/capture/schema.js';

function event(overrides: Partial<CaptureEvent> = {}): CaptureEvent {
  return {
    artistName: 'Example Artist',
    venueName: 'Example Venue',
    town: 'Manchester',
    date: '2026-09-01',
    admission: 'UNKNOWN',
    cancelled: false,
    confidence: 0.99,
    sourceUrls: ['https://www.facebook.com/events/123456789/'],
    ...overrides,
  };
}

describe('Capture event publication policy', () => {
  const artist: CaptureArtist = {
    name: 'One For The Road',
    location: 'Northwich, Cheshire',
    locationType: 'regional',
    confidence: 0.96,
    evidenceUrls: [],
    actTypes: [],
    genres: [],
  };

  it('treats a confident multi-venue, multi-town poster as strong geographic identity evidence', () => {
    expect(hasStrongMultiVenueArtistEvidence(artist, [
      event({ venueName: 'The Lion Hotel', town: 'Moulton' }),
      event({ venueName: 'Broken Cross', town: 'Rudheath' }),
      event({ venueName: 'Bird & Hat', town: 'Northwich' }),
    ])).toBe(true);
  });

  it('does not auto-confirm a same-name artist from one gig or weak identity confidence', () => {
    expect(hasStrongMultiVenueArtistEvidence(artist, [event({ town: 'Northwich' })])).toBe(false);
    expect(hasStrongMultiVenueArtistEvidence({ ...artist, confidence: 0.7 }, [
      event({ venueName: 'One', town: 'Northwich' }),
      event({ venueName: 'Two', town: 'Moulton' }),
      event({ venueName: 'Three', town: 'Winsford' }),
    ])).toBe(false);
  });

  it('publishes a directly captured event when admission is unknown', () => {
    expect(eventShouldPublish(event({ admission: 'UNKNOWN' }))).toBe(true);
  });

  it('publishes free and paid directly captured events', () => {
    expect(eventShouldPublish(event({ admission: 'FREE_CONFIRMED' }))).toBe(true);
    expect(eventShouldPublish(event({ admission: 'PAID_CONFIRMED' }))).toBe(true);
  });

  it('still holds explicitly cancelled events', () => {
    expect(eventShouldPublish(event({ cancelled: true }))).toBe(false);
  });

  it('separates human-review projection failures from transient retries', () => {
    expect(reviewableProjectionError(new Error('Venue resolution needs review'))).toBe(true);
    expect(reviewableProjectionError(new Error('Meta API timed out'))).toBe(false);
  });

  it('uses the canonical weekday defaults when a captured gig has no source time', () => {
    expect(defaultCaptureStartTime('2026-09-04')).toBe('21:00'); // Friday
    expect(defaultCaptureStartTime('2026-09-05')).toBe('21:00'); // Saturday
    expect(defaultCaptureStartTime('2026-09-06')).toBe('19:00'); // Sunday
    expect(defaultCaptureStartTime('2026-09-07')).toBe('20:00'); // Monday
  });

  it('uses 14:00 only when the captured text explicitly says afternoon', () => {
    expect(defaultCaptureStartTime('2026-09-05', 'Saturday afternoon gig')).toBe('14:00');
  });

  it('defaults every publishable row in a multi-date poster without overwriting supplied times', () => {
    const events = [
      event({ date: '2026-10-03', venueName: 'The Lion Hotel' }),
      event({ date: '2026-11-15', venueName: 'Lambs Wharf' }),
      event({ date: '2026-11-27', venueName: 'Grape & Bean', startTime: '20:30' }),
      event({ date: '2026-12-19', venueName: 'The Red Lion', cancelled: true }),
    ];

    expect(applyCaptureStartTimeDefaults(events)).toEqual([
      { date: '2026-10-03', venueName: 'The Lion Hotel', time: '21:00' },
      { date: '2026-11-15', venueName: 'Lambs Wharf', time: '19:00' },
    ]);
    expect(events.map(item => item.startTime)).toEqual(['21:00', '19:00', '20:30', undefined]);
  });
});
