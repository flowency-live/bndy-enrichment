import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { ProjectionWorkItemSchema } from '../knowledge/types.js';
import { projectWorkItem } from '../projection/engine.js';
import { createProjectionDependencies } from '../projection/runtime.js';

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const deps = createProjectionDependencies();
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records) {
    try {
      const item = ProjectionWorkItemSchema.parse(JSON.parse(record.body));
      await projectWorkItem(item, deps);
    } catch (error) {
      console.error('ProjectionWorker failed', error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
