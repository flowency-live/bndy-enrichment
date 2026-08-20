import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { KnowledgeBuildResult } from './klma-source.js';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

export type PersistedKnowledge = {
  tableName: string;
  bucketName: string;
  evidenceKey: string;
  observationRecords: number;
  claimRecords: number;
};

export async function persistKnowledgeToAws(
  knowledge: KnowledgeBuildResult,
  rawEvidence: string,
): Promise<PersistedKnowledge> {
  const tableName = process.env.STATE_TABLE;
  const bucketName = process.env.EVIDENCE_BUCKET;
  if (!tableName || !bucketName) {
    throw new Error('STATE_TABLE and EVIDENCE_BUCKET are required for --persist-aws');
  }

  const evidenceKey = `sources/${knowledge.observation.sourceId}/observations/${knowledge.observation.id}/raw.csv`;
  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: evidenceKey,
    Body: rawEvidence,
    ContentType: 'text/csv; charset=utf-8',
    Metadata: {
      sourceId: knowledge.observation.sourceId,
      observationId: knowledge.observation.id,
    },
  }));

  await ddb.send(new PutCommand({
    TableName: tableName,
    Item: {
      pk: `OBS#${knowledge.observation.id}`,
      sk: 'META',
      entityType: 'SourceObservation',
      ...knowledge.observation,
      evidenceKey,
    },
    ConditionExpression: 'attribute_not_exists(pk)',
  }));

  for (const claim of knowledge.claims) {
    await ddb.send(new PutCommand({
      TableName: tableName,
      Item: {
        pk: `CLAIM#${claim.id}`,
        sk: 'META',
        entityType: 'KnowledgeClaim',
        ...claim,
        GSI1PK: `OBS#${claim.observationId}`,
        GSI1SK: `CLAIM#${claim.id}`,
        GSI2PK: `SUBJECT#${claim.subject.type}#${claim.subject.key}`,
        GSI2SK: `${claim.observedAt}#${claim.id}`,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
  }

  return {
    tableName,
    bucketName,
    evidenceKey,
    observationRecords: 1,
    claimRecords: knowledge.claims.length,
  };
}
