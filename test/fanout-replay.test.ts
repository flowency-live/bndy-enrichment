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

function duplicate(status?: string, attemptCount?: number) {
  return Object.assign(new Error('duplicate'), {
    name: 'ConditionalCheckFailedException',
    ...(status ? { Item: { status, ...(attemptCount !== undefined ? { attemptCount } : {}) } } : {}),
  });
}

describe('failed source-task replay', () => {
  it('does not replay a failed task from ordinary scheduled discovery', async () => {
    const ddbSend = vi.fn().mockRejectedValueOnce(duplicate('failed', 1)).mockResolvedValueOnce({});
    const sqsSend = vi.fn();
    const publisher = new DynamoSqsSourceFanoutPublisher('state', 'queue', { send: ddbSend } as any, { send: sqsSend } as any);

    await expect(publisher.publish(request, '2026-08-26T23:00:00.000Z')).resolves.toBe(false);
    expect(ddbSend).toHaveBeenCalledTimes(2);
    expect(sqsSend).not.toHaveBeenCalled();
    expect((ddbSend.mock.calls[1][0] as any).input.UpdateExpression).toBe('SET lastDiscoveredAt = :at, updatedAt = :at');
  });

  it('requeues a failed task when a new owned reconciliation explicitly rediscovers it', async () => {
    const ddbSend = vi.fn().mockRejectedValueOnce(duplicate('failed', 1)).mockResolvedValueOnce({});
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
    expect(JSON.parse((sqsSend.mock.calls[0][0] as any).input.MessageBody)).toMatchObject({
      reconciliationId: 'run-2', sourceId: request.sourceId, task: request.task,
    });
  });

  it('does not replay when the retained task has reached its attempt cap', async () => {
    const ddbSend = vi.fn().mockRejectedValueOnce(duplicate('failed', 3)).mockResolvedValueOnce({});
    const sqsSend = vi.fn();
    const publisher = new DynamoSqsSourceFanoutPublisher('state', 'queue', { send: ddbSend } as any, { send: sqsSend } as any);

    await expect(publisher.publish(request, '2026-08-26T23:10:00.000Z', 'run-3')).resolves.toBe(false);
    expect(ddbSend).toHaveBeenCalledTimes(2);
    expect(sqsSend).not.toHaveBeenCalled();
    expect((ddbSend.mock.calls[1][0] as any).input.ExpressionAttributeValues[':reconciliationId']).toBe('run-3');
  });

  it('does not replay a completed duplicate during an owned reconciliation', async () => {
    const ddbSend = vi.fn().mockRejectedValueOnce(duplicate('completed', 1)).mockResolvedValueOnce({});
    const sqsSend = vi.fn();
    const publisher = new DynamoSqsSourceFanoutPublisher('state', 'queue', { send: ddbSend } as any, { send: sqsSend } as any);

    await expect(publisher.publish(request, '2026-08-26T23:15:00.000Z', 'run-4')).resolves.toBe(false);
    expect(sqsSend).not.toHaveBeenCalled();
  });

  it('starts new durable tasks with attemptCount 1 and asks DynamoDB to return conflicting state', async () => {
    const ddbSend = vi.fn().mockResolvedValue({});
    const sqsSend = vi.fn().mockResolvedValue({});
    const publisher = new DynamoSqsSourceFanoutPublisher('state', 'queue', { send: ddbSend } as any, { send: sqsSend } as any);

    await expect(publisher.publish(request, '2026-08-27T00:00:00.000Z', 'run-5')).resolves.toBe(true);
    const put = ddbSend.mock.calls[0][0] as any;
    expect(put.input.Item.attemptCount).toBe(1);
    expect(put.input.ReturnValuesOnConditionCheckFailure).toBe('ALL_OLD');
  });

  it('records an explicit terminal disposition on completed source tasks', async () => {
    const ddbSend = vi.fn().mockResolvedValue({});
    const publisher = new DynamoSqsSourceFanoutPublisher('state', 'queue', { send: ddbSend } as any, { send: vi.fn() } as any);

    await publisher.mark(request.sourceId, request.taskKey, 'completed', '2026-08-27T20:00:00.000Z', 'http-410-gone');

    const update = ddbSend.mock.calls[0][0] as any;
    expect(update.input.UpdateExpression).toContain('terminalDisposition = :detail');
    expect(update.input.ExpressionAttributeValues[':detail']).toBe('http-410-gone');
  });
});
