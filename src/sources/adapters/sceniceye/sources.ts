import type { GigSource } from '../../../knowledge/types.js';

export const SCENICEYE_SOURCES: GigSource[] = [{
  id: 'sceniceye-weekly-listing',
  name: 'Scenic Eye weekly gig guide',
  type: 'AGGREGATOR',
  url: 'https://scenicmind.co.uk/sceniceye',
  region: 'Hampshire',
  timezone: 'Europe/London',
  cadence: 'manual',
  localTime: '09:00',
  mode: 'delta',
  snapshotSemantics: 'complete',
  authorityClass: 'aggregator',
  thresholds: { artistAutoMatch: 0.98, venueAutoMatch: 0.98, eventAutoCreate: 0.995, socialAutoAttach: 0.995 },
  adapter: 'sceniceye',
  runtimeClass: 'standard',
  enabled: false,
  shadow: true,
  writerAuthority: 'cowork',
  health: 'unknown',
}];
