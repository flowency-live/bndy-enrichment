export const CANONICAL_HYDRATION_LATEST_KEY = {
  pk: 'HYDRATION#CANONICAL',
  sk: 'LATEST',
} as const;

export interface CanonicalHydrationSummary {
  runId: string;
  baselineSnapshotId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'complete' | 'failed';
  mode: 'read-only-plan' | 'backline-write';
  canonicalWritesEnabled: false;
  scanned: number;
  unchanged: number;
  inserted: number;
  modified: number;
  removed: number;
  claims: number;
  checkpointsBackfilled: number;
  checkpointBackfillsPlanned: number;
  skippedWithoutId: number;
  errors: string[];
}

export function canonicalHydrationManifestItems(summary: CanonicalHydrationSummary, updatedAt: string) {
  const publicSummary = { ...summary, updatedAt };
  return [
    {
      pk: `DELTA_HYDRATION#${summary.runId}`,
      sk: 'META',
      entityType: 'CanonicalDeltaHydration',
      ...publicSummary,
    },
    {
      ...CANONICAL_HYDRATION_LATEST_KEY,
      entityType: 'CanonicalHydrationPointer',
      ...publicSummary,
    },
  ];
}
