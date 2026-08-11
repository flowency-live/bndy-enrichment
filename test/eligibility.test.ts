import { describe, expect, it } from 'vitest';
import {
  classifyEligibility,
  commercialEntitySignals,
  partitionEvents,
  suppressionUntilIso,
} from '../src/domain/eligibility.js';

function event(status: 'FREE_CONFIRMED' | 'PAID_CONFIRMED' | 'UNKNOWN', venueName = 'Venue') {
  return {
    artistName: 'Band',
    venueName,
    town: 'Town',
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
  it('suppresses clearly commercial ticketed artists for 270 days', () => {
    const decision = classifyEligibility([
      event('PAID_CONFIRMED'),
      event('PAID_CONFIRMED'),
      event('PAID_CONFIRMED'),
      event('PAID_CONFIRMED'),
    ] as any, 'artist');

    expect(decision.classification).toBe('COMMERCIAL_TICKETING');
    expect(decision.autoEnrich).toBe(false);
    expect(decision.suppressed).toBe(true);
    expect(decision.suppressionDays).toBe(270);
    expect(decision.ticketedVenue).toBe(false);
    expect(suppressionUntilIso(decision, new Date('2026-08-11T00:00:00Z'))).toBeTruthy();
  });

  it('marks a venue ticketed after two paid gigs with no free evidence', () => {
    const decision = classifyEligibility([
      event('PAID_CONFIRMED'),
      event('PAID_CONFIRMED'),
    ] as any, 'venue');

    expect(decision.classification).toBe('COMMERCIAL_TICKETING');
    expect(decision.ticketedVenue).toBe(true);
    expect(decision.autoEnrich).toBe(false);
    expect(decision.suppressed).toBe(true);
  });

  it('auto-enriches confirmed grassroots-free entities', () => {
    const decision = classifyEligibility([
      event('FREE_CONFIRMED'),
      event('FREE_CONFIRMED'),
      event('UNKNOWN'),
    ] as any, 'artist');

    expect(decision.classification).toBe('GRASSROOTS_FREE');
    expect(decision.autoEnrich).toBe(true);
    expect(decision.suppressed).toBe(false);
  });

  it('publishes free and paid gigs but only free gigs drive enrichment/graph expansion', () => {
    const events = [event('FREE_CONFIRMED'), event('UNKNOWN'), event('PAID_CONFIRMED')] as any;
    const { publishable, held, expansionEligible } = partitionEvents(events);

    expect(publishable).toHaveLength(2);
    expect(publishable.map(e => e.admission.status)).toEqual(['FREE_CONFIRMED', 'PAID_CONFIRMED']);
    expect(held).toHaveLength(1);
    expect(held[0].admission.status).toBe('UNKNOWN');
    expect(expansionEligible).toHaveLength(1);
    expect(expansionEligible[0].processing.expandGraph).toBe(true);

    const paid = publishable.find(e => e.admission.status === 'PAID_CONFIRMED')!;
    expect(paid.processing.publish).toBe(true);
    expect(paid.processing.enrichEntities).toBe(false);
    expect(paid.processing.expandGraph).toBe(false);
  });

  it('emits ticketed venue signals from paid gigs without making them enrichment targets', () => {
    const signals = commercialEntitySignals([
      event('PAID_CONFIRMED', 'Morpeth Party In The Park'),
      event('FREE_CONFIRMED', "O'Gradys"),
    ] as any);

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      entityType: 'venue',
      name: 'Morpeth Party In The Park',
      ticketed: true,
      autoEnrich: false,
      scanEligible: false,
    });
  });

  it('keeps mixed entities unsuppressed but disables automatic rich enrichment', () => {
    const decision = classifyEligibility([
      event('FREE_CONFIRMED'),
      event('PAID_CONFIRMED'),
    ] as any, 'artist');

    expect(decision.classification).toBe('MIXED');
    expect(decision.autoEnrich).toBe(false);
    expect(decision.suppressed).toBe(false);
  });
});
