import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { ProjectionWorkItem } from '../knowledge/types.js';
import { createDynamoStoreClient, type DynamoStoreClient } from '../knowledge/stores/clients.js';

export type ProjectionException = {
  id: string;
  item: ProjectionWorkItem;
  reason: string;
  details?: Record<string, unknown>;
  createdAt: string;
};

export interface ProjectionExceptionSink {
  raise(exception: ProjectionException): Promise<void>;
}

/**
 * Minimal WP-14-compatible seam. WP-14 can replace the storage shape without
 * changing ProjectionEngine call sites.
 */
export class DynamoProjectionExceptionSink implements ProjectionExceptionSink {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async raise(exception: ProjectionException): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: `EXCEPTION#${exception.id}`,
        sk: 'META',
        entityType: 'ProjectionException',
        status: 'open',
        sourceId: exception.item.sourceId,
        observationId: exception.item.observationId,
        candidateKey: exception.item.candidateKey,
        projectionAction: exception.item.action,
        reason: exception.reason,
        details: exception.details,
        createdAt: exception.createdAt,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
  }
}
