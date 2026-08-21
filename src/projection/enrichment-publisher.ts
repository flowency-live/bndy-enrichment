import { createHash } from 'node:crypto';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { EntityEnrichmentWorkItemSchema, type EntityEnrichmentWorkItem } from '../knowledge/types.js';

export interface EntityEnrichmentPublisher {
  publish(item: EntityEnrichmentWorkItem): Promise<void>;
}

export class SqsEntityEnrichmentPublisher implements EntityEnrichmentPublisher {
  constructor(
    private readonly queueUrl: string,
    private readonly client = new SQSClient({}),
  ) {}

  async publish(item: EntityEnrichmentWorkItem): Promise<void> {
    const parsed = EntityEnrichmentWorkItemSchema.parse(item);
    await this.client.send(new SendMessageCommand({ QueueUrl: this.queueUrl, MessageBody: JSON.stringify(parsed) }));
  }
}

export function enrichmentItem(
  entityType: 'artist' | 'venue',
  entityId: string,
  sourceId: string,
  observationId: string,
  createdAt: string,
): EntityEnrichmentWorkItem {
  const digest = createHash('sha256')
    .update(`${entityType}\u001f${entityId}\u001f${sourceId}\u001f${observationId}`)
    .digest('hex')
    .slice(0, 32);
  return {
    id: `enrich-${digest}`,
    entityType,
    entityId,
    reason: 'created',
    sourceId,
    observationId,
    createdAt,
  };
}
