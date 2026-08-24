import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDynamoStoreClient } from '../src/knowledge/stores/clients.js';

describe('Dynamo document marshalling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('configures the Backline document client to remove undefined values', async () => {
    const send = vi.fn().mockResolvedValue({});
    const fromSpy = vi.spyOn(DynamoDBDocumentClient, 'from').mockReturnValue({ send } as any);
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

    expect(fromSpy).toHaveBeenCalledWith(expect.any(DynamoDBClient), {
      marshallOptions: { removeUndefinedValues: true },
    });
    expect(send).toHaveBeenCalledOnce();
  });
});
