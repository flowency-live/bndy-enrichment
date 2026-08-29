import { describe, expect, it } from 'vitest';
import { eventShouldPublish, reviewableProjectionError } from '../src/handlers/capture-processor.js';
import type { CaptureEvent } from '../src/capture/schema.js';

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
});
