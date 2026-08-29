import type { EffectiveCadence, GigSource } from '../knowledge/types.js';
import { waveOneSources } from '../cli/seed-wave1-sources.js';
import { nextScheduledAt } from '../source-runner/schedule.js';
import { LEMONROCK_SOURCES } from './adapters/lemonrock/sources.js';
import { ONTHECASE_SOURCES } from './adapters/onthecase/sources.js';
import { SCENICEYE_SOURCES } from './adapters/sceniceye/sources.js';

export const MAX_DAILY_SOURCE_STALENESS_HOURS = 26;

const DAILY_OR_FASTER = new Set<EffectiveCadence>(['hourly', 'twice-daily', 'daily']);

export type SourceCoverageAudit = {
  violations: string[];
  plannedSources: string[];
  coverageRoots: string[];
};

function scheduleRegistryRoot(source: GigSource, now: Date): GigSource {
  if (!source.enabled || source.scheduleAuthority !== 'registry' || source.nextScanAt) return source;
  const provisional = { ...source, nextScanAt: now.toISOString() };
  return { ...provisional, nextScanAt: nextScheduledAt(provisional, now) };
}

export function sourceCatalog(now = new Date()): GigSource[] {
  const definitions = [
    ...waveOneSources(now),
    ...LEMONROCK_SOURCES,
    ...ONTHECASE_SOURCES,
    ...SCENICEYE_SOURCES,
  ].map((source) => scheduleRegistryRoot(source, now));
  const ids = new Set<string>();
  for (const source of definitions) {
    if (ids.has(source.id)) throw new Error(`Duplicate source definition: ${source.id}`);
    ids.add(source.id);
  }
  return definitions.sort((a, b) => a.id.localeCompare(b.id));
}

export function auditDailySourceCoverage(sources: GigSource[]): SourceCoverageAudit {
  const violations: string[] = [];
  const plannedSources: string[] = [];
  const coverageRoots: string[] = [];

  for (const source of sources) {
    if (source.sourceRole === 'planned') {
      plannedSources.push(source.id);
      continue;
    }
    if (source.sourceRole !== 'coverage-root') continue;
    coverageRoots.push(source.id);
    if (!source.enabled) violations.push(`${source.id}: coverage root is disabled`);
    if (!source.effectiveCadence || !DAILY_OR_FASTER.has(source.effectiveCadence)) {
      violations.push(`${source.id}: effective cadence ${source.effectiveCadence ?? 'missing'} is slower than daily`);
    }
    if (!source.scheduleAuthority || !['registry', 'eventbridge'].includes(source.scheduleAuthority)) {
      violations.push(`${source.id}: no automatic schedule authority`);
    }
    if (!source.maxStalenessHours || source.maxStalenessHours > MAX_DAILY_SOURCE_STALENESS_HOURS) {
      violations.push(`${source.id}: max staleness must be at most ${MAX_DAILY_SOURCE_STALENESS_HOURS} hours`);
    }
    if (source.scheduleAuthority === 'registry' && !source.nextScanAt) {
      violations.push(`${source.id}: registry schedule has no nextScanAt`);
    }
  }

  return {
    violations: violations.sort(),
    plannedSources: plannedSources.sort(),
    coverageRoots: coverageRoots.sort(),
  };
}

export function assertDailySourceCoverage(sources: GigSource[]): void {
  const audit = auditDailySourceCoverage(sources);
  if (audit.violations.length) throw new Error(`Daily source coverage policy failed:\n${audit.violations.join('\n')}`);
}
