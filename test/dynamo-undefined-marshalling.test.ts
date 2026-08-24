import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDynamoStoreClient } from '../src/knowledge/stores/clients.js';

describe('Dynamo document marshalling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('removes undefined values instead of failing a Backline write', async () => {
    vi.spyOn(DynamoDBClient.prototype as never, 'send' as never).mockResolvedValue({} as never);

    const client = createDynamoStoreClient('eu-west-2');

    await expect(client.send(new PutCommand({
      TableName: 'test',
      Item: {
        pk: 'SOURCE#test',
        sk: 'CONFIG',
        optionalValue: undefined,
        nested: { present: true, missing: undefined },
      },
    }))).resolves.toEqual({});
  });
});
