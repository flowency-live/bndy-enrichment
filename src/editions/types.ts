export type EditionId = 'live' | 'brass';

export interface DiscoveryPolicy {
  editionId: EditionId;
  publishPaidEvents: boolean;
  paidEventsCanExpandGraph: boolean;
  facebookPriority: 'primary' | 'fallback' | 'disabled';
  officialWebsitePriority: 'primary' | 'secondary';
}
