import { describe, expect, it } from 'vitest';
import type { SourceRuntimeState } from '../src/knowledge/stores/source-state-store.js';
import { checkDailySourceHealth } from '../src/handlers/source-health.js';
import { auditDailySourceCoverage, sourceCatalog } from '../src/sources/catalog.js';
import { assessSourceFreshness } from '../src/sources/freshness.js';

describe('daily source coverage policy', () => {
  const now = new Date('2026-08-29T12:00:00.000Z');

  it('gives every active source family a daily-or-faster monitored coverage root', () => {
    const sources = sourceCatalog(now);
    const audit = auditDailySourceCoverage(sources);

    expect(audit.violations).toEqual([]);
    expect(audit.plannedSources).toEqual(['insangel-daily-import']);
    expect(new Set(audit.coverageRoots.map((id) => sources.find((source) => source.id === id)?.sourceFamily)))
      .toEqual(new Set(['gigs-news', 'klma', 'lemonrock', 'onthecase', 'sceniceye']));
    expect(sources.find((source) => source.id === 'sceniceye-daily-import')).toMatchObject({
      enabled: true, runtimeClass: 'browser', nextScanAt: '2026-08-30T08:00:00.000Z',
    });
  });

  it('classifies missing and stale successes against the 26-hour owner SLO', () => {
    const source = sourceCatalog(now).find((entry) => entry.id === 'gigs-news-daily-import')!;
    expect(assessSourceFreshness(source, null, now).status).toBe('missing');
    expect(assessSourceFreshness(source, {
      sourceId: source.id,
      lastSuccessfulRunAt: '2026-08-28T08:00:00.000Z',
      consecutiveFailures: 1,
    }, now)).toMatchObject({ status: 'stale', ageHours: 28, consecutiveFailures: 1 });
  });

  it('checks every coverage root through keyed state reads', async () => {
    const reads: string[] = [];
    const healthyState = (sourceId: string): SourceRuntimeState => ({
      sourceId,
      lastSuccessfulRunAt: '2026-08-29T10:00:00.000Z',
      consecutiveFailures: 0,
    });
    const findings = await checkDailySourceHealth({
      state: { async get(sourceId) { reads.push(sourceId); return healthyState(sourceId); } },
      now: () => now,
    });

    expect(findings.every((finding) => finding.status === 'healthy')).toBe(true);
    expect(reads.sort()).toEqual(findings.map((finding) => finding.sourceId).sort());
  });
});
