import { describe, expect, it } from 'vitest';
import { partitionEventsForEdition } from './event-processing.js';
import type { EventCandidate } from '../domain/schema.js';

function event(status: 'FREE_CONFIRMED' | 'PAID_CONFIRMED' | 'UNKNOWN'): EventCandidate {
  return {
    artistName: 'Test Band',
    venueName: 'Test Hall',
    eventDate: '2026-10-10',
    timezone: 'Europe/London',
    cancelled: false,
    confidence: 0.95,
    sourceUrls: ['https://example.test/event'],
    supportActs: [],
    ticketing: {
      expected: status === 'PAID_CONFIRMED',
      status: status === 'PAID_CONFIRMED' ? 'found' : 'not_applicable',
      evidenceUrls: ['https://example.test/event'],
    },
    admission: {
      status,
      confidence: 0.95,
      evidenceUrls: ['https://example.test/event'],
    },
  };
}

describe('edition-aware event processing', () => {
  it('preserves live FREE-first semantics exactly', () => {
    const result = partitionEventsForEdition([event('FREE_CONFIRMED'), event('PAID_CONFIRMED')]);
    expect(result.publishable).toHaveLength(2);
    expect(result.expansionEligible).toHaveLength(1);
    expect(result.expansionEligible[0].admission.status).toBe('FREE_CONFIRMED');
  });

  it('allows confirmed paid brass concerts to expand the graph', () => {
    const result = partitionEventsForEdition([event('FREE_CONFIRMED'), event('PAID_CONFIRMED')], 'brass');
    expect(result.publishable).toHaveLength(2);
    expect(result.expansionEligible).toHaveLength(2);
    const paid = result.expansionEligible.find((item) => item.admission.status === 'PAID_CONFIRMED');
    expect(paid?.processing?.expandGraph).toBe(true);
    expect(paid?.processing?.enrichEntities).toBe(true);
  });

  it('continues to hold unresolved admission in brass', () => {
    const result = partitionEventsForEdition([event('UNKNOWN')], 'brass');
    expect(result.publishable).toHaveLength(0);
    expect(result.held).toHaveLength(1);
  });
});
