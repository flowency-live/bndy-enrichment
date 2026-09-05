import type { GigSource } from '../knowledge/types.js';
import { SourceRegistryStore } from '../knowledge/stores/source-registry-store.js';
import { nextScheduledAt } from '../source-runner/schedule.js';

function withNext(source: Omit<GigSource, 'nextScanAt'>, now: Date): GigSource {
  if (!source.enabled || source.cadence === 'manual') return source;
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
      cadence: 'daily',
      sourceFamily: 'gigs-news',
      sourceRole: 'coverage-root',
      scheduleAuthority: 'registry',
      effectiveCadence: 'daily',
      maxStalenessHours: 26,
      localTime: '09:00',
      mode: 'append-only',
      snapshotSemantics: 'incremental',
      authorityClass: 'aggregator',
      adapter: 'gigs-news',
      runtimeClass: 'standard',
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
      sourceFamily: 'klma',
      sourceRole: 'coverage-root',
      scheduleAuthority: 'registry',
      effectiveCadence: 'daily',
      maxStalenessHours: 26,
      localTime: '09:00',
      authorityClass: 'curated',
      adapter: 'klma-stoke',
      runtimeClass: 'standard',
      projectionPolicy: {
        mode: 'additive-only',
        allowedActions: ['create'],
        allowedPredicates: [
          'hasPerformerName', 'hasPerformer', 'hasVenueName', 'occursAt',
          'occursOn', 'startsAt', 'endsAt', 'hasTitle', 'hasAdmissionStatus',
          'hasPrice', 'hasTicketUrl', 'hasEventUrl', 'hasStatus', 'derivedFrom', 'hasGenre',
        ],
        // Live-safe by construction (ADR-113): entities are matched, never created.
        entityCreation: 'match-only',
        minAcceptedEventsPerRun: 50,
        maxAcceptedEventsPerRun: 500,
        maxProjectionActionsPerRun: 500,
      },
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
      cadence: 'manual',
      sourceFamily: 'insangel',
      sourceRole: 'planned',
      scheduleAuthority: 'manual',
      effectiveCadence: 'manual',
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
