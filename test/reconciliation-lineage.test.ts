import { describe, expect, it, vi } from 'vitest';
import type { GigSource } from '../src/knowledge/types.js';
import type { SourceAdapter } from '../src/sources/runner/adapter.js';
import { DynamoSqsSourceFanoutPublisher } from '../src/sources/runner/fanout.js';
import { runSource, type RunnerDependencies } from '../src/sources/runner/runner.js';

const child = {
  sourceId: 'lemonrock-gig-hydration',
  taskKey: 'gig:lemonrock:gig:939252',
  task: {
    kind: 'gig',
    url: 'https://www.lemonrock.com/gig.php?id=939252',
    nativeId: 'lemonrock:gig:939252',
  },
};

describe('Lemonrock reconciliation lineage', () => {
  it('versions discovery work so a parser upgrade can replay the same-day national indexes', async () => {
    const ddbSend = vi.fn().mockResolvedValue({});
    const sqsSend = vi.fn().mockResolvedValue({});
    const publisher = new DynamoSqsSourceFanoutPublisher(
      'state-table',
      'https://sqs.eu-west-2.amazonaws.com/771551874768/source',
      { send: ddbSend } as any,
      { send: sqsSend } as any,
    );
    const discovery = {
      sourceId: 'lemonrock-future-reconcile',
      taskKey: 'gig-index:https://www.lemonrock.com/gigs-in-torquay',
      task: { kind: 'gig-index', url: 'https://www.lemonrock.com/gigs-in-torquay' },
    };

    await publisher.publish(discovery, '2026-08-25T15:00:00.000Z', 'run-parser-v4');

    const put = ddbSend.mock.calls[0]?.[0] as any;
    expect(put.input.Item.taskKey).toBe(`${discovery.taskKey}@2026-08-25@v4@run-parser-v4`);
    const send = sqsSend.mock.calls[0]?.[0] as any;
    expect(JSON.parse(send.input.MessageBody).taskKey).toBe(`${discovery.taskKey}@2026-08-25@v4@run-parser-v4`);
  });

  it('persists lineage on a new durable task and forwards it through SQS', async () => {
    const ddbSend = vi.fn().mockResolvedValue({});
    const sqsSend = vi.fn().mockResolvedValue({});
    const publisher = new DynamoSqsSourceFanoutPublisher(
      'state-table',
      'https://sqs.eu-west-2.amazonaws.com/771551874768/source',
      { send: ddbSend } as any,
      { send: sqsSend } as any,
    );

    await expect(publisher.publish(
      child,
      '2026-08-24T19:00:00.000Z',
      'run-full-reconcile-1',
    )).resolves.toBe(true);

    const put = ddbSend.mock.calls[0]?.[0] as any;
    expect(put.input.Item).toMatchObject({
      sourceId: 'lemonrock-gig-hydration',
      logicalTaskKey: child.taskKey,
      lastDiscoveredAt: '2026-08-24T19:00:00.000Z',
      reconciliationId: 'run-full-reconcile-1',
      lastReconciliationId: 'run-full-reconcile-1',
      status: 'queued',
    });

    const send = sqsSend.mock.calls[0]?.[0] as any;
    expect(JSON.parse(send.input.MessageBody)).toMatchObject({
      sourceId: 'lemonrock-gig-hydration',
      reconciliationId: 'run-full-reconcile-1',
      task: child.task,
    });
  });

  it('marks an existing deduped task as discovered by the current reconciliation without requeueing it', async () => {
    const duplicate = Object.assign(new Error('duplicate'), {
      name: 'ConditionalCheckFailedException',
    });
    const ddbSend = vi.fn()
      .mockRejectedValueOnce(duplicate)
      .mockResolvedValueOnce({});
    const sqsSend = vi.fn();
    const publisher = new DynamoSqsSourceFanoutPublisher(
      'state-table',
      'https://sqs.eu-west-2.amazonaws.com/771551874768/source',
      { send: ddbSend } as any,
      { send: sqsSend } as any,
    );

    await expect(publisher.publish(
      child,
      '2026-08-24T19:05:00.000Z',
      'run-full-reconcile-2',
    )).resolves.toBe(false);

    const update = ddbSend.mock.calls[1]?.[0] as any;
    expect(update.input).toMatchObject({
      TableName: 'state-table',
      UpdateExpression: 'SET lastDiscoveredAt = :at, updatedAt = :at, lastReconciliationId = :reconciliationId',
      ExpressionAttributeValues: {
        ':at': '2026-08-24T19:05:00.000Z',
        ':reconciliationId': 'run-full-reconcile-2',
      },
    });
    expect(sqsSend).not.toHaveBeenCalled();
  });

  it('starts a lineage at the full-reconcile root and propagates it to child fanout', async () => {
    const source: GigSource = {
      id: 'lemonrock-full-reconcile',
      name: 'Lemonrock full reconciliation',
      url: 'https://www.lemonrock.com/',
      type: 'AGGREGATOR',
      timezone: 'Europe/London',
      cadence: 'manual',
      localTime: '05:00',
      mode: 'append-only',
      snapshotSemantics: 'incremental',
      authorityClass: 'aggregator',
      thresholds: {},
      adapter: 'lemonrock',
      runtimeClass: 'standard',
      enabled: true,
      shadow: true,
      writerAuthority: 'aws',
      health: 'unknown',
    };
    const adapter: SourceAdapter = {
      async fetch() {
        return {
          kind: 'html',
          body: '<html><body></body></html>',
          sourceUrl: source.url,
          fetchMethod: 'test',
          fetchedAt: '2026-08-24T19:10:00.000Z',
          complete: false,
        };
      },
      async parse() {
        return { events: [], nextRequests: [child], parked: [], warnings: [] };
      },
    };
    const publish = vi.fn().mockResolvedValue(true);
    const deps: RunnerDependencies = {
      registry: { async get() { return source; } },
      state: { async get() { return null; }, async put() {} },
      observations: { async put(observation) { return observation; } },
      claims: { async put() {} },
      artifacts: {
        async writeNormalised() { return 'runs/normalised.json'; },
        async writeDiff() { return 'runs/diff.json'; },
        async writeParity() { return 'runs/parity.json'; },
        async writeReport() { return 'runs/report.json'; },
        async loadNormalised() { return []; },
      },
      projection: { async publish() {} },
      fanout: { publish, async mark() {} },
      acquisition: { async acquire() { throw new Error('adapter owns acquisition'); } },
      loadAdapter: () => adapter,
      now: () => new Date('2026-08-24T19:10:00.000Z'),
      newId: () => 'full-reconcile-1',
    };

    const result = await runSource({
      sourceId: 'lemonrock-full-reconcile',
      reason: 'manual',
      requestedAt: '2026-08-24T19:09:00.000Z',
    }, deps);

    expect(result.report.reconciliationId).toBe('run-full-reconcile-1');
    expect(publish).toHaveBeenCalledWith(
      child,
      '2026-08-24T19:10:00.000Z',
      'run-full-reconcile-1',
    );
  });

});
