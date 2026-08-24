import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, type GetCommand, type PutCommand, type QueryCommand, type UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type DynamoStoreCommand = GetCommand | PutCommand | QueryCommand | UpdateCommand;

export type DynamoStoreResponse = {
  Item?: Record<string, unknown>;
  Items?: Record<string, unknown>[];
  LastEvaluatedKey?: Record<string, unknown>;
};

export interface DynamoStoreClient {
  send(command: DynamoStoreCommand): Promise<DynamoStoreResponse>;
}

export interface S3StoreClient {
  send(command: PutObjectCommand): Promise<Record<string, unknown>>;
}

export function createDynamoStoreClient(region = process.env.AWS_REGION ?? 'eu-west-2'): DynamoStoreClient {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });
  return {
    async send(command: DynamoStoreCommand): Promise<DynamoStoreResponse> {
      return await client.send(command as never) as unknown as DynamoStoreResponse;
    },
  };
}

export function createS3StoreClient(region = process.env.AWS_REGION ?? 'eu-west-2'): S3StoreClient {
  const client = new S3Client({ region });
  return {
    async send(command: PutObjectCommand): Promise<Record<string, unknown>> {
      return await client.send(command) as unknown as Record<string, unknown>;
    },
  };
}
