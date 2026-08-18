import type { SQSBatchResponse, SQSHandler } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SearchEntitySchema } from '../domain/schema.js';
import { suppressionUntilIso } from '../domain/eligibility.js';
import { writeEnrichmentToEntity } from '../domain/write-back.js';
import { discoverWithGemini } from '../google/gemini.js';

const secrets = new SecretsManagerClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
let cachedKey: string | undefined;

async function getKey() {
  if (cachedKey) return cachedKey;
  const out = await secrets.send(new GetSecretValueCommand({
    SecretId: process.env.GEMINI_SECRET_ARN!,
  }));
  if (!out.SecretString) throw new Error('Gemini secret has no SecretString');
  const parsed = JSON.parse(out.SecretString);
  cachedKey = parsed.apiKey ?? parsed.GEMINI_API_KEY;
  if (!cachedKey) throw new Error('Gemini secret must contain apiKey');
  return cachedKey;
}

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const entity = SearchEntitySchema.parse(JSON.parse(record.body));
      const result = await discoverWithGemini(entity, {
        apiKey: await getKey(),
        model: process.env.GEMINI_MODEL,
        horizonDays: Number(process.env.SEARCH_HORIZON_DAYS ?? 90),
      });

      const entityPk = `ENTITY#${entity.type}#${entity.bndyId}`;
      const suppressedUntil = suppressionUntilIso(result.eligibility);

      await Promise.all([
        ddb.send(new PutCommand({
          TableName: process.env.STATE_TABLE!,
          Item: {
            pk: entityPk,
            sk: `RUN#${result.retrievedAt}#${result.runId}`,
            ...result,
          },
        })),
        ddb.send(new PutCommand({
          TableName: process.env.STATE_TABLE!,
          Item: {
            pk: entityPk,
            sk: 'ELIGIBILITY',
            classification: result.eligibility.classification,
            autoEnrich: result.eligibility.autoEnrich,
            suppressed: result.eligibility.suppressed,
            suppressionDays: result.eligibility.suppressionDays,
            freeEventsSeen: result.eligibility.freeEventsSeen,
            paidEventsSeen: result.eligibility.paidEventsSeen,
            unknownEventsSeen: result.eligibility.unknownEventsSeen,
            ticketedVenue: result.eligibility.ticketedVenue,
            reason: result.eligibility.reason,
            checkedAt: result.retrievedAt,
            suppressedUntil,
          },
        })),
      ]);

      // Write enrichment data to production artist/venue tables for godmode review
      if (process.env.ARTISTS_TABLE && process.env.VENUES_TABLE) {
        await writeEnrichmentToEntity(
          ddb,
          result,
          process.env.ARTISTS_TABLE,
          process.env.VENUES_TABLE,
        );
      }
    } catch (error) {
      console.error('Discovery failed', { messageId: record.messageId, error });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
