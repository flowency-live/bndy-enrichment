import type { DiscoveryPolicy, EditionId } from './types.js';

export const LIVE_DISCOVERY_POLICY: DiscoveryPolicy = Object.freeze({
  editionId: 'live',
  publishPaidEvents: true,
  paidEventsCanExpandGraph: false,
  facebookPriority: 'fallback',
  officialWebsitePriority: 'secondary',
});

export const BRASS_DISCOVERY_POLICY: DiscoveryPolicy = Object.freeze({
  editionId: 'brass',
  publishPaidEvents: true,
  paidEventsCanExpandGraph: true,
  facebookPriority: 'fallback',
  officialWebsitePriority: 'primary',
});

export function getDiscoveryPolicy(editionId: EditionId = 'live'): DiscoveryPolicy {
  return editionId === 'brass' ? BRASS_DISCOVERY_POLICY : LIVE_DISCOVERY_POLICY;
}
