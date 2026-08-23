import type { DiscoveryResult } from '../domain/schema.js';
import { partitionEventsForEdition } from '../editions/event-processing.js';
import { BRASS_DISCOVERY_POLICY } from '../editions/policies.js';

export interface BrassDiscoveryResult extends DiscoveryResult {
  edition: 'brass';
  editionPolicy: typeof BRASS_DISCOVERY_POLICY;
}

/**
 * Re-project an ordinary discovery result under brass policy.
 * The existing Gemini discovery remains live-compatible and unchanged.
 */
export function applyBrassDiscoveryPolicy(result: DiscoveryResult): BrassDiscoveryResult {
  const allEvents = [...result.events, ...result.heldEvents];
  const partitioned = partitionEventsForEdition(allEvents, 'brass');
  return {
    ...result,
    edition: 'brass',
    editionPolicy: BRASS_DISCOVERY_POLICY,
    events: partitioned.publishable,
    heldEvents: partitioned.held,
    expansionEligibleEvents: partitioned.expansionEligible,
  };
}
