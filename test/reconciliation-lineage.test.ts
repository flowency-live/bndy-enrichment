import { describe, expect, it, vi } from 'vitest';
import { DynamoSqsSourceFanoutPublisher } from '../src/sources/runner/fanout.js';

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
});
