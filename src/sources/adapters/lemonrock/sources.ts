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
  { ...common, id: 'lemonrock-new-gigs', name: 'Lemonrock newly posted gigs', url: 'https://www.lemonrock.com/newestgigs.php', sourceFamily: 'lemonrock', sourceRole: 'coverage-root', scheduleAuthority: 'eventbridge', effectiveCadence: 'hourly', maxStalenessHours: 26 },
  { ...common, id: 'lemonrock-cancellations', name: 'Lemonrock explicit cancellations', url: 'https://www.lemonrock.com/cancellations.php', sourceFamily: 'lemonrock', sourceRole: 'coverage-root', scheduleAuthority: 'eventbridge', effectiveCadence: 'hourly', maxStalenessHours: 26 },
  { ...common, id: 'lemonrock-artist-index', name: 'Lemonrock national artist index', url: 'https://www.lemonrock.com/allbands.php', sourceFamily: 'lemonrock', sourceRole: 'maintenance', scheduleAuthority: 'manual', effectiveCadence: 'manual' },
  { ...common, id: 'lemonrock-venue-index', name: 'Lemonrock national venue index', url: 'https://www.lemonrock.com/allvenues.php', sourceFamily: 'lemonrock', sourceRole: 'maintenance', scheduleAuthority: 'manual', effectiveCadence: 'manual' },
  { ...common, id: 'lemonrock-artist-hydration', name: 'Lemonrock artist profiles', sourceFamily: 'lemonrock', sourceRole: 'child', scheduleAuthority: 'child', effectiveCadence: 'on-discovery' },
  { ...common, id: 'lemonrock-venue-hydration', name: 'Lemonrock venue profiles', sourceFamily: 'lemonrock', sourceRole: 'child', scheduleAuthority: 'child', effectiveCadence: 'on-discovery' },
  { ...common, id: 'lemonrock-gig-hydration', name: 'Lemonrock gig details', sourceFamily: 'lemonrock', sourceRole: 'child', scheduleAuthority: 'child', effectiveCadence: 'on-discovery' },
  { ...common, id: 'lemonrock-future-reconcile', name: 'Lemonrock national future-gig reconcile', url: 'https://www.lemonrock.com/gigsbycounty.php', sourceFamily: 'lemonrock', sourceRole: 'coverage-root', scheduleAuthority: 'eventbridge', effectiveCadence: 'daily', maxStalenessHours: 26 },
  { ...common, id: 'lemonrock-full-reconcile', name: 'Lemonrock full reconciliation', url: 'https://www.lemonrock.com/', sourceFamily: 'lemonrock', sourceRole: 'maintenance', scheduleAuthority: 'manual', effectiveCadence: 'manual' },
];
