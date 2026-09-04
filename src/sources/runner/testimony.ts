import { checkpointKey, type CandidateRef, type TestimonyCheckpoint } from '../../knowledge/stores/candidate-store.js';
import { eventFingerprint } from './diff.js';
import { eventCandidateKey } from './knowledge.js';
import type { NormalisedSourceEvent } from './types.js';

export { checkpointKey, type CandidateRef, type TestimonyCheckpoint };

export type TestimonyPartition = {
  fresh: NormalisedSourceEvent[];
  reobserved: Array<{ event: NormalisedSourceEvent; checkpoint: TestimonyCheckpoint }>;
  fingerprints: Map<string, string>;
};

export function eventRef(sourceId: string, event: NormalisedSourceEvent): CandidateRef {
  return { candidateType: 'event', candidateKey: eventCandidateKey(sourceId, event.sourceEventKey) };
}

// ADR-114: an event whose fingerprint equals what the same source already
// asserted is a re-observation. It earns a checkpoint, not another Claim set.
export function partitionTestimony(
  sourceId: string,
  events: NormalisedSourceEvent[],
  existing: ReadonlyMap<string, TestimonyCheckpoint>,
): TestimonyPartition {
  const fresh: NormalisedSourceEvent[] = [];
  const reobserved: TestimonyPartition['reobserved'] = [];
  const fingerprints = new Map<string, string>();
  for (const event of events) {
    const key = checkpointKey(eventRef(sourceId, event));
    const fingerprint = eventFingerprint(event);
    fingerprints.set(key, fingerprint);
    const checkpoint = existing.get(key);
    if (checkpoint && checkpoint.sourceId === sourceId && checkpoint.fingerprint && checkpoint.fingerprint === fingerprint) {
      reobserved.push({ event, checkpoint });
    } else {
      fresh.push(event);
    }
  }
  return { fresh, reobserved, fingerprints };
}
