import { readFile } from 'node:fs/promises';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { qualificationSummaryFromArtifact } from '../enrichment/qualification-status.js';

const tableName = process.env.STATE_TABLE;
if (!tableName) throw new Error('STATE_TABLE is required');

const artifactPath = process.argv[2] ?? 'ops/enrichment/gemini-grounded-unreviewed.json';
const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
const summary = qualificationSummaryFromArtifact(artifact, new Date().toISOString(), {
  sourceRunUrl: process.env.QUALIFICATION_RUN_URL,
  artifactUrl: process.env.QUALIFICATION_ARTIFACT_URL,
});

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const latest = await client.send(new QueryCommand({
  TableName: tableName,
  KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
  ExpressionAttributeValues: {
    ':pk': 'TRUST_LOOP',
    ':prefix': 'RUN#',
  },
  ScanIndexForward: false,
  Limit: 1,
}));

const run = latest.Items?.[0];
if (!run?.pk || !run?.sk) throw new Error('No Trust Loop run is available for qualification status');

await client.send(new UpdateCommand({
  TableName: tableName,
  Key: { pk: run.pk, sk: run.sk },
  UpdateExpression: 'SET providerQualification = :qualification',
  ConditionExpression: 'attribute_exists(pk) AND canonicalWrites = :zero',
  ExpressionAttributeValues: {
    ':qualification': summary,
    ':zero': 0,
  },
}));

console.log(JSON.stringify({
  status: 'published',
  trustLoopRunId: run.id,
  ...summary,
}));
