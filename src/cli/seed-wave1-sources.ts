import type { GigSource } from '../knowledge/types.js';
import { SourceRegistryStore } from '../knowledge/stores/source-registry-store.js';
import { nextScheduledAt } from '../source-runner/schedule.js';

function withNext(source: Omit<GigSource, 'nextScanAt'>, now: Date): GigSource {
  const provisional: GigSource = { ...source, nextScanAt: now.toISOString() };
  return { ...provisional, nextScanAt: nextScheduledAt(provisional, now) };
}

export function waveOneSources(now = new Date()): GigSource[] {
  const safeDefaults = {
    timezone: 'Europe/London',
    mode: 'delta' as const,
    snapshotSemantics: 'complete' as const,
    thresholds: {},
    enabled: false,
    shadow: true,
    writerAuthority: 'cowork' as const,
    health: 'unknown' as const,
  };

  return [
    withNext({
      ...safeDefaults,
      enabled: true,
      id: 'gigs-news-daily-import',
      name: 'gigs-news',
      type: 'AGGREGATOR',
      url: 'https://gigs-news.uk',
      region: 'Greater Manchester / East Cheshire',
      cadence: 'weekly',
      localTime: '09:00',
      mode: 'append-only',
      snapshotSemantics: 'incremental',
      authorityClass: 'aggregator',
      adapter: 'gigs-news',
      runtimeClass: 'browser',
    }, now),
    withNext({
      ...safeDefaults,
      enabled: true,
      shadow: true,
      writerAuthority: 'cowork',
      id: 'klma-stoke-gig-list',
      name: 'KLMA Stoke Gig List',
      type: 'CURATED_SOURCE',
      url: 'https://docs.google.com/spreadsheets/d/1atEqyN-RI1smTzSaCtMUSui7oNp2dhCpiGoAfY5ySno',
      region: 'Staffordshire / Cheshire',
      cadence: 'daily',
      localTime: '09:00',
      authorityClass: 'curated',
      adapter: 'klma-stoke',
      runtimeClass: 'standard',
      projectionPolicy: {
        mode: 'additive-only',
        minAcceptedEventsPerRun: 50,
        maxAcceptedEventsPerRun: 500,
        maxProjectionActionsPerRun: 500,
      },
    }, now),
    withNext({
      ...safeDefaults,
      id: 'onthecase-daily-import',
      name: 'On The Case Music',
      type: 'AGGREGATOR',
      url: 'https://onthecasemusic.co.uk/gigs',
      region: 'North East England',
      cadence: 'daily',
      localTime: '04:05',
      authorityClass: 'aggregator',
      adapter: 'onthecase',
      runtimeClass: 'browser',
    }, now),
    withNext({
      ...safeDefaults,
      id: 'sceniceye-daily-import',
      name: 'sceniceye',
      type: 'AGGREGATOR',
      url: 'https://scenicmind.co.uk/sceniceye',
      region: 'Hampshire',
      cadence: 'daily',
      localTime: '09:00',
      authorityClass: 'aggregator',
      adapter: 'sceniceye',
      runtimeClass: 'browser',
    }, now),
    withNext({
      // Current Cowork reports fire at ~05:03Z during BST, i.e. ~06:03 local.
      // This bootstrap remains disabled until WP-10 validates the exact minute,
      // acquisition mode and snapshot semantics from the source fixtures/spec.
      ...safeDefaults,
      id: 'insangel-daily-import',
      name: 'insangel',
      type: 'AGGREGATOR',
      url: 'https://insangel.co.uk',
      region: 'North East England',
      cadence: 'daily',
      localTime: '06:00',
      mode: 'append-only',
      snapshotSemantics: 'incremental',
      authorityClass: 'aggregator',
      adapter: 'insangel',
      runtimeClass: 'standard',
    }, now),
  ];
}

async function main(): Promise<void> {
  const tableName = process.env.STATE_TABLE;
  if (!tableName) throw new Error('STATE_TABLE is required');
  const store = new SourceRegistryStore(tableName);
  for (const source of waveOneSources()) {
    await store.put(source);
    console.log(`seeded ${source.id}: enabled=${source.enabled}, shadow=${source.shadow}, writer=${source.writerAuthority}, next=${source.nextScanAt}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
