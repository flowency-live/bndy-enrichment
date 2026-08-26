import { describe, expect, it, vi } from 'vitest';
import { DynamoSqsSourceFanoutPublisher } from '../src/sources/runner/fanout.js';

const request = {
  sourceId: 'onthecase-venue-hydration',
  taskKey: 'venue:onthecase:venue:108',
  task: {
    kind: 'venue',
    url: 'https://onthecasemusic.co.uk/venues/108/example',
    nativeId: 'onthecase:venue:108',
  },
};

function duplicate() {
  return Object.assign(new Error('duplicate'), { name: 'ConditionalCheckFailedException' });
}

describe('failed source-task replay', () => {
  it('does not replay a duplicate failed task from ordinary scheduled discovery', async () => {
    const ddbSend = vi.fn()
      .mockRejectedValueOnce(duplicate())
      .mockResolvedValueOnce({});
    const sqsSend = vi.fn();
    const publisher = new DynamoSqsSourceFanoutPublisher('state', 'queue', { send: ddbSend } as any, { send: sqsSend } as any);

    await expect(publisher.publish(request, '2026-08-26T23:00:00.000Z')).resolves.toBe(false);

    expect(ddbSend).toHaveBeenCalledTimes(2);
    expect(sqsSend).not.toHaveBeenCalled();
    const discoveryUpdate = ddbSend.mock.calls[1][0] as any;
    expect(discoveryUpdate.input.UpdateExpression).toBe('SET lastDiscoveredAt = :at, updatedAt = :at');
  });

  it('requeues a failed task when a new owned reconciliation explicitly rediscovers it', async () => {
    const ddbSend = vi.fn()
      .mockRejectedValueOnce(duplicate())
      .mockResolvedValueOnce({});
    const sqsSend = vi.fn().mockResolvedValue({});
    const publisher = new DynamoSqsSourceFanoutPublisher('state', 'queue', { send: ddbSend } as any, { send: sqsSend } as any);

    await expect(publisher.publish(request, '2026-08-26T23:05:00.000Z', 'run-2')).resolves.toBe(true);

    const requeue = ddbSend.mock.calls[1][0] as any;
    expect(requeue.input.ConditionExpression).toContain('#status = :failed');
    expect(requeue.input.ConditionExpression).toContain('attemptCount < :maxAttempts');
    expect(requeue.input.ExpressionAttributeValues[':maxAttempts']).toBe(3);
    expect(requeue.input.UpdateExpression).toContain('ADD attemptCount :one');
    expect(requeue.input.UpdateExpression).toContain('REMOVE failedAt, lastError');
    expect(sqsSend).toHaveBeenCalledTimes(1);
    const body = JSON.parse((sqsSend.mock.calls[0][0] as any).input.MessageBody);
    expect(body).toMatchObject({ reconciliationId: 'run-2', sourceId: request.sourceId, task: request.task });
  });

  it('does not replay when the failed task has reached its retained attempt cap', async () => {
    const ddbSend = vi.fn()
      .mockRejectedValueOnce(duplicate())
      .mockRejectedValueOnce(duplicate())
      .mockResolvedValueOnce({});
    const sqsSend = vi.fn();
    const publisher = new DynamoSqsSourceFanoutPublisher('state', 'queue', { send: ddbSend } as any, { send: sqsSend } as any);

    await expect(publisher.publish(request, '2026-08-26T23:10:00.000Z', 'run-3')).resolves.toBe(false);

    expect(ddbSend).toHaveBeenCalledTimes(3);
    expect(sqsSend).not.toHaveBeenCalled();
    const cappedUpdate = ddbSend.mock.calls[2][0] as any;
    expect(cappedUpdate.input.ExpressionAttributeValues[':reconciliationId']).toBe('run-3');
  });

  it('starts new durable tasks with attemptCount 1', async () => {
    const ddbSend = vi.fn().mockResolvedValue({});
    const sqsSend = vi.fn().mockResolvedValue({});
    const publisher = new DynamoSqsSourceFanoutPublisher('state', 'queue', { send: ddbSend } as any, { send: sqsSend } as any);

    await expect(publisher.publish(request, '2026-08-27T00:00:00.000Z', 'run-4')).resolves.toBe(true);

    const put = ddbSend.mock.calls[0][0] as any;
    expect(put.input.Item.attemptCount).toBe(1);
  });
});
