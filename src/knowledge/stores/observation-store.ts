import { PutObjectCommand } from '@aws-sdk/client-s3';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SourceObservationSchema, type SourceObservation } from '../types.js';
import {
  createDynamoStoreClient,
  createS3StoreClient,
  type DynamoStoreClient,
  type S3StoreClient,
} from './clients.js';

export const OBSERVATION_INDEX = 'ObservationClaimsIndex';

export type ObservationPayload = string | Uint8Array;

export type ObservationWriteOptions = {
  contentType?: string;
  extension?: string;
};

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

function extensionFor(contentType?: string): string {
  if (!contentType) return 'bin';
  if (contentType.includes('json')) return 'json';
  if (contentType.includes('html')) return 'html';
  if (contentType.includes('csv')) return 'csv';
  if (contentType.startsWith('text/')) return 'txt';
  return 'bin';
}

export function sourceObservationItem(observation: SourceObservation): Record<string, unknown> {
  const stored = SourceObservationSchema.parse(observation);
  return {
    pk: `OBS#${stored.id}`,
    sk: 'META',
    entityType: 'SourceObservation',
    ...stored,
    GSI1PK: `SOURCE#${stored.sourceId}`,
    GSI1SK: `OBS#${stored.observedAt}#${stored.id}`,
  };
}

export class ObservationStore {
  constructor(
    private readonly tableName: string,
    private readonly bucketName: string,
    private readonly ddb: DynamoStoreClient = createDynamoStoreClient(),
    private readonly s3: S3StoreClient = createS3StoreClient(),
  ) {}

  evidenceKey(observation: SourceObservation, extension?: string): string {
    const observed = new Date(observation.observedAt);
    if (Number.isNaN(observed.getTime())) throw new Error(`Invalid observedAt: ${observation.observedAt}`);
    const yyyy = String(observed.getUTCFullYear());
    const mm = String(observed.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(observed.getUTCDate()).padStart(2, '0');
    const ext = extension ?? extensionFor(observation.contentType);
    return `source-observations/${safeSegment(observation.sourceId)}/${yyyy}/${mm}/${dd}/${safeSegment(observation.id)}/raw.${ext}`;
  }

  async put(
    observation: SourceObservation,
    payload: ObservationPayload,
    options: ObservationWriteOptions = {},
  ): Promise<SourceObservation> {
    const parsed = SourceObservationSchema.parse(observation);
    const contentType = options.contentType ?? parsed.contentType ?? 'application/octet-stream';
    const evidenceKey = parsed.evidenceKey ?? this.evidenceKey(parsed, options.extension ?? extensionFor(contentType));

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: evidenceKey,
      Body: payload,
      ContentType: contentType,
      IfNoneMatch: '*',
      Metadata: {
        sourceid: parsed.sourceId,
        observationid: parsed.id,
      },
    }));

    const stored = SourceObservationSchema.parse({ ...parsed, evidenceKey, contentType });
    await this.ddb.send(new PutCommand({
      TableName: this.tableName,
      Item: sourceObservationItem(stored),
      ConditionExpression: 'attribute_not_exists(pk)',
    }));

    return stored;
  }

  async listBySource(sourceId: string, limit = 20): Promise<SourceObservation[]> {
    const response = await this.ddb.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: OBSERVATION_INDEX,
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `SOURCE#${sourceId}`,
        ':prefix': 'OBS#',
      },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (response.Items ?? []).map((item) => SourceObservationSchema.parse(item));
  }
}
