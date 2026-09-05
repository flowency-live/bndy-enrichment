import type { GigSource } from '../knowledge/types.js';

// The code catalogue is the contract; the registry row is the runtime state.
// A re-seed applies the contract but must never flip a live writer back to
// shadow or drop an active pilot allowlist. Promotion to live is a separate,
// human-run action.
export function reconcileSourceDefinition(existing: GigSource | null, definition: GigSource): GigSource {
  if (!existing) return definition;
  const live = existing.shadow === false && existing.writerAuthority === 'aws';
  if (!live) return definition;
  const pilotCandidateKeys = existing.projectionPolicy?.pilotCandidateKeys;
  return {
    ...definition,
    shadow: false,
    writerAuthority: 'aws',
    ...(definition.projectionPolicy && pilotCandidateKeys
      ? { projectionPolicy: { ...definition.projectionPolicy, pilotCandidateKeys } }
      : {}),
  };
}
