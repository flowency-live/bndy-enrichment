import type { GigSource } from '../knowledge/types.js';
import type { SourceRuntimeState } from '../knowledge/stores/source-state-store.js';

export type SourceFreshness = {
  sourceId: string;
  sourceFamily: string;
  status: 'healthy' | 'missing' | 'stale' | 'invalid';
  lastSuccessfulRunAt?: string;
  ageHours?: number;
  maxStalenessHours: number;
  consecutiveFailures: number;
};

export function assessSourceFreshness(
  source: GigSource,
  state: SourceRuntimeState | null,
  now = new Date(),
): SourceFreshness {
  if (source.sourceRole !== 'coverage-root' || !source.maxStalenessHours) {
    throw new Error(`Source ${source.id} is not a monitored coverage root`);
  }
  const base = {
    sourceId: source.id,
    sourceFamily: source.sourceFamily ?? source.id,
    maxStalenessHours: source.maxStalenessHours,
    consecutiveFailures: state?.consecutiveFailures ?? 0,
  };
  if (!state?.lastSuccessfulRunAt) return { ...base, status: 'missing' };
  const successAt = new Date(state.lastSuccessfulRunAt);
  if (!Number.isFinite(successAt.getTime())) {
    return { ...base, status: 'invalid', lastSuccessfulRunAt: state.lastSuccessfulRunAt };
  }
  const ageHours = Math.max(0, (now.getTime() - successAt.getTime()) / 3_600_000);
  return {
    ...base,
    status: ageHours > source.maxStalenessHours ? 'stale' : 'healthy',
    lastSuccessfulRunAt: state.lastSuccessfulRunAt,
    ageHours: Number(ageHours.toFixed(2)),
  };
}
