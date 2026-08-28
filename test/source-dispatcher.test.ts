import { describe, expect, it } from 'vitest';
import type { GigSource } from '../src/knowledge/types.js';
import {
  dispatchDue,
  dispatchManual,
  type DispatcherDependencies,
  type QueueSender,
  type RegistryReader,
  type SourceScanMessage,
} from '../src/handlers/source-dispatcher.js';
import { nextScheduledAt } from '../src/source-runner/schedule.js';
import { waveOneSources } from '../src/cli/seed-wave1-sources.js';

function source(overrides: Partial<GigSource> = {}): GigSource {
  return {
    id: 'source-1', name: 'Source One', type: 'AGGREGATOR', url: 'https://example.test',
    timezone: 'Europe/London', cadence: 'daily', localTime: '05:00', mode: 'delta',
    snapshotSemantics: 'complete', authorityClass: 'aggregator', thresholds: {}, runtimeClass: 'standard',
    enabled: true, shadow: true, writerAuthority: 'cowork', health: 'healthy', nextScanAt: '2026-08-20T04:00:00.000Z',
    ...overrides,
  };
}
class FakeRegistry implements RegistryReader {
  readonly advances: Array<{ sourceId: string; expected: string; next: string; scheduled: string }> = [];
  constructor(readonly sources: GigSource[]) {}
  async get(sourceId: string): Promise<GigSource | null> { return this.sources.find((item) => item.id === sourceId) ?? null; }
  async queryDue(): Promise<GigSource[]> { return this.sources; }
  async advanceSchedule(sourceId: string, expectedNextScanAt: string, nextScanAt: string, scheduledAt: string): Promise<void> {
    this.advances.push({ sourceId, expected: expectedNextScanAt, next: nextScanAt, scheduled: scheduledAt });
  }
}
class FakeQueues implements QueueSender {
  readonly sent: Array<{ queueUrl: string; message: SourceScanMessage }> = [];
  async send(queueUrl: string, message: SourceScanMessage): Promise<void> { this.sent.push({ queueUrl, message }); }
}
function deps(sources: GigSource[], now = '2026-08-20T05:00:00.000Z') {
  const registry = new FakeRegistry(sources); const queues = new FakeQueues();
  const value: DispatcherDependencies = { registry, queues, standardQueueUrl: 'https://sqs.test/standard', browserQueueUrl: 'https://sqs.test/browser', now: () => new Date(now) };
  return { value, registry, queues };
}
describe('source schedule', () => {
  it('keeps 05:00 local stable when London falls from BST to GMT', () => {
    const item = source({ localTime: '05:00' });
    expect(nextScheduledAt(item, new Date('2026-10-23T23:00:00.000Z'))).toBe('2026-10-24T04:00:00.000Z');
    expect(nextScheduledAt(item, new Date('2026-10-24T23:00:00.000Z'))).toBe('2026-10-25T05:00:00.000Z');
  });
  it('supports twice-daily local slots', () => {
    const item = source({ cadence: 'twice-daily', localTime: '09:00' });
    expect(nextScheduledAt(item, new Date('2026-08-20T10:00:00.000Z'))).toBe('2026-08-20T20:00:00.000Z');
    expect(nextScheduledAt(item, new Date('2026-08-20T21:00:00.000Z'))).toBe('2026-08-21T08:00:00.000Z');
  });
  it('preserves a weekly local weekday from nextScanAt', () => {
    const item = source({ cadence: 'weekly', localTime: '09:00', nextScanAt: '2026-08-24T08:00:00.000Z' });
    expect(nextScheduledAt(item, new Date('2026-08-24T09:00:00.000Z'))).toBe('2026-08-31T08:00:00.000Z');
  });
  it('returns no automatic schedule for manual sources', () => { expect(nextScheduledAt(source({ cadence: 'manual' }), new Date())).toBeUndefined(); });
});
describe('SourceDispatcher', () => {
  it('enumerates due sources, routes standard vs browser and advances schedules', async () => {
    const standard = source({ id: 'klma', runtimeClass: 'standard', localTime: '09:00', nextScanAt: '2026-08-20T04:00:00.000Z' });
    const browser = source({ id: 'gigs-news', runtimeClass: 'browser', localTime: '09:00', nextScanAt: '2026-08-20T04:00:00.000Z' });
    const { value, registry, queues } = deps([standard, browser], '2026-08-20T05:00:00.000Z');
    const result = await dispatchDue(value);
    expect(result).toEqual({ due: 2, enqueued: 2, stale: 0, sourceIds: ['klma', 'gigs-news'] });
    expect(queues.sent).toEqual([
      { queueUrl: 'https://sqs.test/standard', message: { sourceId: 'klma', reason: 'scheduled', requestedAt: '2026-08-20T05:00:00.000Z' } },
      { queueUrl: 'https://sqs.test/browser', message: { sourceId: 'gigs-news', reason: 'scheduled', requestedAt: '2026-08-20T05:00:00.000Z' } },
    ]);
    expect(registry.advances.map((item) => item.sourceId)).toEqual(['klma', 'gigs-news']);
    expect(registry.advances[0]?.next).toBe('2026-08-20T08:00:00.000Z');
  });
  it('manual enqueue works for a disabled source and does not alter its schedule', async () => {
    const browser = source({ id: 'disabled-browser', runtimeClass: 'browser', enabled: false });
    const { value, registry, queues } = deps([browser]);
    const output = await dispatchManual('disabled-browser', value, '2026-08-20T12:00:00.000Z');
    expect(output).toEqual({ sourceId: 'disabled-browser', reason: 'manual', requestedAt: '2026-08-20T12:00:00.000Z' });
    expect(queues.sent[0]?.queueUrl).toBe('https://sqs.test/browser'); expect(registry.advances).toHaveLength(0);
  });
});
describe('wave one registry seeds', () => {
  it('activates only KLMA for shadow BAU while keeping every source shadowed and Cowork-owned', () => {
    const sources = waveOneSources(new Date('2026-08-20T10:00:00.000Z'));
    expect(sources.map((item) => item.id)).toEqual(['gigs-news-daily-import','klma-stoke-gig-list','onthecase-daily-import','sceniceye-daily-import','insangel-daily-import']);
    for (const item of sources) { expect(item.shadow).toBe(true); expect(item.writerAuthority).toBe('cowork'); expect(item.nextScanAt).toBeTruthy(); }
    expect(sources.find((item) => item.id === 'klma-stoke-gig-list')?.enabled).toBe(true);
    expect(sources.filter((item) => item.id !== 'klma-stoke-gig-list').every((item) => item.enabled === false)).toBe(true);
    expect(sources.find((item) => item.id === 'gigs-news-daily-import')?.runtimeClass).toBe('browser');
    expect(sources.find((item) => item.id === 'onthecase-daily-import')?.runtimeClass).toBe('browser');
    expect(sources.find((item) => item.id === 'sceniceye-daily-import')?.runtimeClass).toBe('browser');
    expect(sources.find((item) => item.id === 'klma-stoke-gig-list')?.runtimeClass).toBe('standard');
  });
});
