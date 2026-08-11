import type { Handler } from 'aws-lambda';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';

const sqs = new SQSClient({});

export const handler: Handler = async (event) => {
  // Prototype hook. Production should fetch due entities from bndy or a scan-state index.
  // For now, invocations may pass an explicit entities array, so the stack deploys without coupling to bndy's API yet.
  const entities = Array.isArray(event?.entities) ? event.entities : [];
  if (!entities.length) {
    return {
      queued: 0,
      note: 'No entities supplied. Invoke with {entities:[...]} or connect the bndy entity source.',
    };
  }

  for (let i = 0; i < entities.length; i += 10) {
    await sqs.send(new SendMessageBatchCommand({
      QueueUrl: process.env.GOOGLE_QUEUE_URL!,
      Entries: entities.slice(i, i + 10).map((body: unknown, j: number) => ({
        Id: `${i + j}`,
        MessageBody: JSON.stringify(body),
      })),
    }));
  }

  return { queued: entities.length };
};
