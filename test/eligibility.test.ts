import { describe, expect, it } from 'vitest';
import { classifyEligibility, retainFreeEvents, suppressionUntilIso } from '../src/domain/eligibility.js';

function event(status: 'FREE_CONFIRMED' | 'PAID_CONFIRMED' | 'UNKNOWN') {
  return {
    artistName: 'Band',
    venueName: 'Venue',
    eventDate: '2026-09-01',
    timezone: 'Europe/London',
    cancelled: false,
    confidence: 0.95,
    sourceUrls: ['https://example.com/gig'],
    supportActs: [],
    ticketing: {
      expected: status === 'PAID_CONFIRMED',
      status: status === 'PAID_CONFIRMED' ? 'found' as const : 'not_applicable' as const,
      evidenceUrls: ['https://example.com/gig'],
    },
    admission: {
      status,
      confidence: 0.95,
      evidenceUrls: ['https://example.com/gig'],
    },
  };
}

describe('eligibility', () => {
  it('suppresses clearly commercial ticketed entities for 270 days', () => {
    const decision = classifyEligibility([
      event('PAID_CONFIRMED'),
      event('PAID_CONFIRMED'),
      event('PAID_CONFIRMED'),
      event('PAID_CONFIRMED'),
    ] as any);

    expect(decision.classification).toBe('COMMERCIAL_TICKETING');
    expect(decision.autoEnrich).toBe(false);
    expect(decision.suppressed).toBe(true);
    expect(decision.suppressionDays).toBe(270);
    expect(suppressionUntilIso(decision, new Date('2026-08-11T00:00:00Z'))).toBeTruthy();
  });

  it('auto-enriches confirmed grassroots-free entities', () => {
    const decision = classifyEligibility([
      event('FREE_CONFIRMED'),
      event('FREE_CONFIRMED'),
      event('UNKNOWN'),
    ] as any);

    expect(decision.classification).toBe('GRASSROOTS_FREE');
    expect(decision.autoEnrich).toBe(true);
    expect(decision.suppressed).toBe(false);
  });

  it('does not treat absence of paid evidence as free and rejects unknown/paid gigs', () => {
    const events = [event('FREE_CONFIRMED'), event('UNKNOWN'), event('PAID_CONFIRMED')] as any;
    const { retained, rejected } = retainFreeEvents(events);

    expect(retained).toHaveLength(1);
    expect(retained[0].admission.status).toBe('FREE_CONFIRMED');
    expect(rejected).toHaveLength(2);
  });

  it('keeps mixed entities unsuppressed but disables automatic rich enrichment', () => {
    const decision = classifyEligibility([
      event('FREE_CONFIRMED'),
      event('PAID_CONFIRMED'),
    ] as any);

    expect(decision.classification).toBe('MIXED');
    expect(decision.autoEnrich).toBe(false);
    expect(decision.suppressed).toBe(false);
  });
});
