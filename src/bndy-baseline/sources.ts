import type { GigSource } from '../knowledge/types.js';
import type { BaselineEntityType } from './mapper.js';

export const CANONICAL_SOURCE_IDS: Record<BaselineEntityType, string> = {
  artist: 'bndy-canonical-artists',
  venue: 'bndy-canonical-venues',
  event: 'bndy-canonical-events',
  festival: 'bndy-canonical-festivals',
};

export function canonicalEvidenceSource(entityType: BaselineEntityType, enabled = false): GigSource {
  return {
    id: CANONICAL_SOURCE_IDS[entityType],
    name: `Canonical BNDY ${entityType}s evidence feed`,
    type: 'CURATED_SOURCE',
    timezone: 'Europe/London',
    cadence: 'manual',
    sourceFamily: 'bndy-canonical',
    sourceRole: 'maintenance',
    scheduleAuthority: 'child',
    effectiveCadence: 'on-discovery',
    localTime: '05:00',
    mode: 'append-only',
    snapshotSemantics: 'incremental',
    authorityClass: 'curated',
    thresholds: {},
    runtimeClass: 'standard',
    enabled,
    shadow: true,
    writerAuthority: 'aws',
    health: 'unknown',
  };
}
