import type { EventCandidate } from '../domain/schema.js';
import { partitionEvents } from '../domain/eligibility.js';
import { getDiscoveryPolicy } from './policies.js';
import type { EditionId } from './types.js';

/**
 * Edition-aware wrapper around the established live processing rules.
 * Live is intentionally delegated unchanged to partitionEvents().
 */
export function partitionEventsForEdition(events: EventCandidate[], editionId: EditionId = 'live') {
  const live = partitionEvents(events);
  if (editionId === 'live') return live;

  const policy = getDiscoveryPolicy(editionId);
  const promoted = live.publishable.map((event) => {
    if (event.admission.status !== 'PAID_CONFIRMED' || !policy.paidEventsCanExpandGraph) return event;
    return {
      ...event,
      processing: {
        publish: policy.publishPaidEvents,
        enrichEntities: true,
        expandGraph: true,
        reason: 'Confirmed paid brass concert; brass policy permits entity enrichment and graph expansion',
      },
    };
  });

  return {
    publishable: promoted,
    held: live.held,
    expansionEligible: promoted.filter((event) => event.processing?.expandGraph === true),
  };
}
