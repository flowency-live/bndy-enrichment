import type { GigSource } from '../../../knowledge/types.js';

const common: Pick<GigSource,
  'type' | 'timezone' | 'cadence' | 'localTime' | 'mode' | 'snapshotSemantics' | 'authorityClass' |
  'thresholds' | 'adapter' | 'runtimeClass' | 'enabled' | 'shadow' | 'writerAuthority' | 'health'
> = {
  type: 'AGGREGATOR',
  timezone: 'Europe/London',
  cadence: 'manual',
  localTime: '05:00',
  mode: 'append-only',
  snapshotSemantics: 'incremental',
  authorityClass: 'aggregator',
  thresholds: {
    artistAutoMatch: 0.98,
    venueAutoMatch: 0.98,
    eventAutoCreate: 0.995,
    socialAutoAttach: 0.995,
  },
  adapter: 'lemonrock',
  runtimeClass: 'standard',
  enabled: true,
  shadow: true,
  writerAuthority: 'aws',
  health: 'unknown',
};

export const LEMONROCK_SOURCES: GigSource[] = [
  { ...common, id: 'lemonrock-new-gigs', name: 'Lemonrock newly posted gigs', url: 'https://www.lemonrock.com/newestgigs.php' },
  { ...common, id: 'lemonrock-cancellations', name: 'Lemonrock explicit cancellations', url: 'https://www.lemonrock.com/cancellations.php' },
  { ...common, id: 'lemonrock-artist-index', name: 'Lemonrock national artist index', url: 'https://www.lemonrock.com/advancedsearchbands.php?_start=0' },
  { ...common, id: 'lemonrock-venue-index', name: 'Lemonrock national venue index', url: 'https://www.lemonrock.com/allvenues.php' },
  { ...common, id: 'lemonrock-artist-hydration', name: 'Lemonrock artist profiles' },
  { ...common, id: 'lemonrock-venue-hydration', name: 'Lemonrock venue profiles' },
  { ...common, id: 'lemonrock-gig-hydration', name: 'Lemonrock gig details' },
  { ...common, id: 'lemonrock-future-reconcile', name: 'Lemonrock national future-gig reconcile', url: 'https://www.lemonrock.com/' },
  { ...common, id: 'lemonrock-full-reconcile', name: 'Lemonrock full reconciliation', url: 'https://www.lemonrock.com/' },
];
