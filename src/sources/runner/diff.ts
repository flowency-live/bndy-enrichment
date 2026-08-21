import { createHash } from 'node:crypto';
import type { GigSource } from '../../knowledge/types.js';
import type { NormalisedSourceEvent, SourceEventDiff } from './types.js';

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableValue(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function eventFingerprint(event: NormalisedSourceEvent): string {
  if (event.contentHash) return event.contentHash;
  return createHash('sha256').update(stableValue(event)).digest('hex');
}

export type DiffOptions = {
  runDate: string;
  captureComplete: boolean;
};

/**
 * Target diff semantics (ADR-104):
 * - positive additions/updates are allowed even when the capture is incomplete;
 * - absence only becomes a withdrawal when BOTH the capture is complete and the
 *   source is delta + complete-snapshot;
 * - append-only, incremental and one-shot sources never infer cancellation from absence.
 */
export function diffSourceEvents(
  previous: NormalisedSourceEvent[],
  current: NormalisedSourceEvent[],
  config: GigSource,
  options: DiffOptions,
): SourceEventDiff {
  const previousMap = new Map<string, NormalisedSourceEvent>();
  const currentMap = new Map<string, NormalisedSourceEvent>();
  for (const event of previous) if (!previousMap.has(event.sourceEventKey)) previousMap.set(event.sourceEventKey, event);
  for (const event of current) if (!currentMap.has(event.sourceEventKey)) currentMap.set(event.sourceEventKey, event);

  const added: NormalisedSourceEvent[] = [];
  const updated: NormalisedSourceEvent[] = [];
  const unchanged: NormalisedSourceEvent[] = [];
  const withdrawn: NormalisedSourceEvent[] = [];
  const pastDropped: NormalisedSourceEvent[] = [];
  const ignoredAbsences: NormalisedSourceEvent[] = [];

  for (const [key, event] of currentMap) {
    const prior = previousMap.get(key);
    if (!prior) {
      added.push(event);
    } else if (eventFingerprint(prior) !== eventFingerprint(event)) {
      updated.push(event);
    } else {
      unchanged.push(event);
    }
  }

  const absenceCanWithdraw = options.captureComplete
    && config.mode === 'delta'
    && config.snapshotSemantics === 'complete';

  for (const [key, prior] of previousMap) {
    if (currentMap.has(key)) continue;
    if (!absenceCanWithdraw) {
      ignoredAbsences.push(prior);
      continue;
    }
    if (prior.date && prior.date < options.runDate) pastDropped.push(prior);
    else withdrawn.push(prior);
  }

  return { added, updated, unchanged, withdrawn, pastDropped, ignoredAbsences };
}
