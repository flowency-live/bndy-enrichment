import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { GigSource } from '../knowledge/types.js';
import { SourceRegistryStore } from '../knowledge/stores/source-registry-store.js';
import { nextScheduledAt } from '../source-runner/schedule.js';

export type SourceScanReason = 'scheduled' | 'manual';

export type SourceScanMessage = {
  sourceId: string;
  reason: SourceScanReason;
  requestedAt: string;
};

export type DispatcherEvent = {
  sourceId?: string;
  reason?: SourceScanReason;
  requestedAt?: string;
};

export interface QueueSender {
  send(queueUrl: string, message: SourceScanMessage): Promise<void>;
}

export interface RegistryReader {
  get(sourceId: string): Promise<GigSource | null>;
  queryDue(nowIso: string, limit?: number): Promise<GigSource[]>;
  advanceSchedule(sourceId: string, expectedNextScanAt: string, nextScanAt: string, scheduledAt: string): Promise<void>;
}

export type DispatcherDependencies = {
  registry: RegistryReader;
  queues: QueueSender;
  standardQueueUrl: string;
  browserQueueUrl: string;
  now?: () => Date;
};

function queueFor(source: GigSource, deps: DispatcherDependencies): string {
  return source.runtimeClass === 'browser' ? deps.browserQueueUrl : deps.standardQueueUrl;
}

function message(sourceId: string, reason: SourceScanReason, requestedAt: string): SourceScanMessage {
  return { sourceId, reason, requestedAt };
}

export async function dispatchManual(sourceId: string, deps: DispatcherDependencies, requestedAt?: string): Promise<SourceScanMessage> {
  const source = await deps.registry.get(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  const at = requestedAt ?? (deps.now ?? (() => new Date()))().toISOString();
  const payload = message(source.id, 'manual', at);
  await deps.queues.send(queueFor(source, deps), payload);
  return payload;
}

export type ScheduledDispatchResult = {
  due: number;
  enqueued: number;
  stale: number;
  sourceIds: string[];
};

export async function dispatchDue(deps: DispatcherDependencies): Promise<ScheduledDispatchResult> {
  const now = (deps.now ?? (() => new Date()))();
  const requestedAt = now.toISOString();
  const due = await deps.registry.queryDue(requestedAt);
  let enqueued = 0;
  let stale = 0;
  const sourceIds: string[] = [];

  for (const source of due) {
    if (!source.enabled || !source.nextScanAt) continue;
    const next = nextScheduledAt(source, now);
    if (!next) continue;

    // Queue first. The compare-and-swap schedule advance prevents a stale registry
    // record from being silently accepted. In the rare CAS-race case a duplicate
    // scan message is safer than losing a scheduled scan; downstream work is idempotent.
    await deps.queues.send(queueFor(source, deps), message(source.id, 'scheduled', requestedAt));
    try {
      await deps.registry.advanceSchedule(source.id, source.nextScanAt, next, requestedAt);
      enqueued += 1;
      sourceIds.push(source.id);
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ConditionalCheckFailedException') {
        stale += 1;
        continue;
      }
      throw error;
    }
  }

  return { due: due.length, enqueued, stale, sourceIds };
}

class AwsQueueSender implements QueueSender {
  constructor(private readonly client = new SQSClient({})) {}

  async send(queueUrl: string, payload: SourceScanMessage): Promise<void> {
    await this.client.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(payload),
    }));
  }
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export async function handler(event: DispatcherEvent = {}): Promise<unknown> {
  const deps: DispatcherDependencies = {
    registry: new SourceRegistryStore(env('STATE_TABLE')),
    queues: new AwsQueueSender(),
    standardQueueUrl: env('SOURCE_SCAN_QUEUE_URL'),
    browserQueueUrl: env('BROWSER_SCAN_QUEUE_URL'),
  };

  if (event.sourceId) {
    return dispatchManual(event.sourceId, deps, event.requestedAt);
  }
  return dispatchDue(deps);
}
