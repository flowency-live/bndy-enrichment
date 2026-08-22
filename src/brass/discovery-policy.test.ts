import { describe, expect, it } from 'vitest';
import { applyBrassDiscoveryPolicy } from './discovery-policy.js';
import type { DiscoveryResult, EventCandidate } from '../domain/schema.js';

function candidate(status: 'FREE_CONFIRMED' | 'PAID_CONFIRMED' | 'UNKNOWN'): EventCandidate {
  return {
    artistName: 'Example Brass',
    venueName: 'Example Hall',
    eventDate: '2026-11-01',
    timezone: 'Europe/London',
    cancelled: false,
    confidence: 0.95,
    sourceUrls: ['https://example.test/concert'],
    supportActs: [],
    ticketing: {
      expected: status === 'PAID_CONFIRMED',
      status: status === 'PAID_CONFIRMED' ? 'found' : 'not_applicable',
      evidenceUrls: ['https://example.test/concert'],
    },
    admission: {
      status,
      confidence: 0.95,
      evidenceUrls: ['https://example.test/concert'],
    },
  };
}

it('promotes paid publishable events to brass graph expansion without publishing unknown events', () => {
  const input = {
    events: [candidate('FREE_CONFIRMED'), candidate('PAID_CONFIRMED')],
    heldEvents: [candidate('UNKNOWN')],
    expansionEligibleEvents: [candidate('FREE_CONFIRMED')],
  } as unknown as DiscoveryResult;
  const result = applyBrassDiscoveryPolicy(input);
  expect(result.edition).toBe('brass');
  expect(result.events).toHaveLength(2);
  expect(result.expansionEligibleEvents).toHaveLength(2);
  expect(result.heldEvents).toHaveLength(1);
  expect(result.expansionEligibleEvents.some((event) => event.admission.status === 'PAID_CONFIRMED')).toBe(true);
});
