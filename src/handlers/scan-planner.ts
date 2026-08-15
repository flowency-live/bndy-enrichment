import type { Handler } from 'aws-lambda';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SearchEntitySchema, type SearchEntity } from '../domain/schema.js';

const sqs = new SQSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function loadSuppressionState(entities: SearchEntity[]) {
  const byPk = new Map<string, any>();
  const table = process.env.STATE_TABLE;
  if (!table || !entities.length) return byPk;

  for (let i = 0; i < entities.length; i += 100) {
    const chunk = entities.slice(i, i + 100);
    const out = await ddb.send(new BatchGetCommand({
      RequestItems: {
        [table]: {
          Keys: chunk.map((entity: SearchEntity) => ({
            pk: `ENTITY#${entity.type}#${entity.bndyId}`,
            sk: 'ELIGIBILITY',
          })),
          ProjectionExpression: 'pk, classification, suppressed, suppressedUntil, reason',
        },
      },
    }));

    for (const item of out.Responses?.[table] ?? []) byPk.set(item.pk, item);
  }

  return byPk;
}

export const handler: Handler = async (event) => {
  // Prototype hook. Production should fetch due entities from bndy or a scan-state index.
  // Explicit entities are still accepted so the stack deploys without coupling to bndy's API yet.
  const rawEntities: unknown[] = Array.isArray(event?.entities) ? event.entities : [];
  if (!rawEntities.length) {
    return {
      queued: 0,
      suppressed: 0,
      note: 'No entities supplied. Invoke with {entities:[...]} or connect the bndy entity source.',
    };
  }

  const entities: SearchEntity[] = rawEntities.map((entity: unknown) => SearchEntitySchema.parse(entity));
  const force = event?.force === true;
  const state = force ? new Map<string, any>() : await loadSuppressionState(entities);
  const now = Date.now();

  const eligible: SearchEntity[] = entities.filter((entity: SearchEntity) => {
    const pk = `ENTITY#${entity.type}#${entity.bndyId}`;
    const record = state.get(pk);
    if (!record?.suppressed || !record?.suppressedUntil) return true;
    return Date.parse(record.suppressedUntil) <= now;
  });

  for (let i = 0; i < eligible.length; i += 10) {
    await sqs.send(new SendMessageBatchCommand({
      QueueUrl: process.env.GOOGLE_QUEUE_URL!,
      Entries: eligible.slice(i, i + 10).map((body: SearchEntity, j: number) => ({
        Id: `${i + j}`,
        MessageBody: JSON.stringify(body),
      })),
    }));
  }

  return {
    supplied: entities.length,
    queued: eligible.length,
    suppressed: entities.length - eligible.length,
    force,
  };
};
