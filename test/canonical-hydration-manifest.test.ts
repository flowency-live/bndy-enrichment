import { describe, expect, it } from 'vitest';
import {
  CANONICAL_HYDRATION_LATEST_KEY,
  canonicalHydrationManifestItems,
  type CanonicalHydrationSummary,
} from '../src/bndy-baseline/hydration-manifest.js';

const summary: CanonicalHydrationSummary = {
  runId: 'canonical-delta-2026-09-01',
  baselineSnapshotId: 'bndy-baseline-2026-08-24-v1',
  startedAt: '2026-09-01T08:00:00.000Z',
  status: 'running',
  mode: 'backline-write',
  canonicalWritesEnabled: false,
  scanned: 1200,
  unchanged: 1000,
  inserted: 100,
  modified: 100,
  removed: 0,
  claims: 900,
  checkpointsBackfilled: 20,
  checkpointBackfillsPlanned: 0,
  skippedWithoutId: 0,
  errors: [],
};

describe('canonical hydration manifest', () => {
  it('publishes an immutable run record and a stable latest pointer', () => {
    const [run, latest] = canonicalHydrationManifestItems(summary, '2026-09-01T08:05:00.000Z');

    expect(run).toMatchObject({
      pk: 'DELTA_HYDRATION#canonical-delta-2026-09-01',
      sk: 'META',
      entityType: 'CanonicalDeltaHydration',
      status: 'running',
      scanned: 1200,
    });
    expect(latest).toMatchObject({
      ...CANONICAL_HYDRATION_LATEST_KEY,
      entityType: 'CanonicalHydrationPointer',
      runId: summary.runId,
      updatedAt: '2026-09-01T08:05:00.000Z',
    });
  });

  it('does not mutate the supplied summary', () => {
    canonicalHydrationManifestItems(summary, '2026-09-01T08:05:00.000Z');
    expect(summary).not.toHaveProperty('updatedAt');
  });
});
