import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  ClaimWithdrawalSchema,
  ProjectionRunSchema,
  type ClaimWithdrawal,
  type ProjectionRun,
  type ProjectionWorkItem,
} from '../knowledge/types.js';
import { createDynamoStoreClient, type DynamoStoreClient } from '../knowledge/stores/clients.js';

export type ProjectionMapping = {
  sourceId: string;
  candidateKey: string;
  artistId?: string;
  venueId?: string;
  eventId?: string;
  lastIdempotencyKey?: string;
  lastAction?: string;
  lastProjectedAt?: string;
};

export type ProjectionCountDelta = Partial<ProjectionRun['counts']>;

function mappingPk(sourceId: string, candidateKey: string): string {
  return `PROJECTION#${sourceId}#${candidateKey}`;
}
function itemPk(idempotencyKey: string): string {
  return `PROJECTION_ITEM#${idempotencyKey}`;
}
function runPk(observationId: string): string {
  return `PROJECTION_RUN#${observationId}`;
}

export class ProjectionStore {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  async getMapping(sourceId: string, candidateKey: string): Promise<ProjectionMapping | null> {
    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: mappingPk(sourceId, candidateKey), sk: 'STATE' },
    }));
    if (!response.Item) return null;
    return {
      sourceId,
      candidateKey,
      artistId: typeof response.Item.artistId === 'string' ? response.Item.artistId : undefined,
      venueId: typeof response.Item.venueId === 'string' ? response.Item.venueId : undefined,
      eventId: typeof response.Item.eventId === 'string' ? response.Item.eventId : undefined,
      lastIdempotencyKey: typeof response.Item.lastIdempotencyKey === 'string' ? response.Item.lastIdempotencyKey : undefined,
      lastAction: typeof response.Item.lastAction === 'string' ? response.Item.lastAction : undefined,
      lastProjectedAt: typeof response.Item.lastProjectedAt === 'string' ? response.Item.lastProjectedAt : undefined,
    };
  }

  async isItemComplete(idempotencyKey: string): Promise<boolean> {
    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: itemPk(idempotencyKey), sk: 'META' },
    }));
    return response.Item?.status === 'success' || response.Item?.status === 'shadow';
  }

  async markSuccess(
    item: ProjectionWorkItem,
    mapping: Omit<ProjectionMapping, 'sourceId' | 'candidateKey'>,
    outcome: 'success' | 'shadow',
    details?: Record<string, unknown>,
  ): Promise<void> {
    const completedAt = new Date().toISOString();
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: mappingPk(item.sourceId, item.candidateKey),
        sk: 'STATE',
        entityType: 'ProjectionMapping',
        sourceId: item.sourceId,
        candidateKey: item.candidateKey,
        ...mapping,
        lastIdempotencyKey: item.idempotencyKey,
        lastAction: item.action,
        lastProjectedAt: completedAt,
      },
    }));
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: itemPk(item.idempotencyKey),
        sk: 'META',
        entityType: 'ProjectionItem',
        sourceId: item.sourceId,
        observationId: item.observationId,
        candidateKey: item.candidateKey,
        action: item.action,
        status: outcome,
        completedAt,
        details,
      },
    }));
  }

  async recordFailure(item: ProjectionWorkItem, message: string): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: itemPk(item.idempotencyKey),
        sk: 'META',
        entityType: 'ProjectionItem',
        sourceId: item.sourceId,
        observationId: item.observationId,
        candidateKey: item.candidateKey,
        action: item.action,
        status: 'failed',
        failedAt: new Date().toISOString(),
        error: message,
      },
    }));
  }

  async putWithdrawal(withdrawal: ClaimWithdrawal): Promise<void> {
    const parsed = ClaimWithdrawalSchema.parse(withdrawal);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: `CLAIM_WITHDRAWAL#${parsed.id}`,
        sk: 'META',
        entityType: 'ClaimWithdrawal',
        ...parsed,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
  }

  async recordRunItem(
    item: ProjectionWorkItem,
    delta: ProjectionCountDelta,
    error?: string,
  ): Promise<ProjectionRun> {
    const now = new Date().toISOString();
    const runId = item.runId ?? item.observationId;
    const expectedItems = item.runItemCount ?? 1;

    // One deterministic row per work item means a retry overwrites its previous
    // result rather than double-counting the run.
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: runPk(item.observationId),
        sk: `ITEM#${item.idempotencyKey}`,
        entityType: 'ProjectionRunItem',
        idempotencyKey: item.idempotencyKey,
        sourceId: item.sourceId,
        observationId: item.observationId,
        runId,
        expectedItems,
        completedAt: now,
        counts: {
          itemsSeen: 1,
          claims: delta.claims ?? 0,
          artistsCreated: delta.artistsCreated ?? 0,
          artistsMatched: delta.artistsMatched ?? 0,
          venuesCreated: delta.venuesCreated ?? 0,
          venuesMatched: delta.venuesMatched ?? 0,
          eventsCreated: delta.eventsCreated ?? 0,
          eventsUpdated: delta.eventsUpdated ?? 0,
          eventsCancelled: delta.eventsCancelled ?? 0,
          projectionFailures: error ? 1 : (delta.projectionFailures ?? 0),
        },
        ...(error ? { error } : {}),
      },
    }));

    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': runPk(item.observationId), ':prefix': 'ITEM#' },
      ScanIndexForward: true,
    }));

    const counts: ProjectionRun['counts'] = {
      itemsSeen: 0,
      claims: 0,
      artistsCreated: 0,
      artistsMatched: 0,
      venuesCreated: 0,
      venuesMatched: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsCancelled: 0,
      projectionFailures: 0,
    };
    const errors: string[] = [];
    for (const row of response.Items ?? []) {
      const rowCounts = row.counts && typeof row.counts === 'object'
        ? row.counts as Partial<ProjectionRun['counts']>
        : {};
      for (const key of Object.keys(counts) as Array<keyof ProjectionRun['counts']>) {
        counts[key] += typeof rowCounts[key] === 'number' ? rowCounts[key]! : 0;
      }
      if (typeof row.error === 'string') errors.push(row.error);
    }

    const done = counts.itemsSeen >= expectedItems;
    const status: ProjectionRun['status'] = done
      ? (counts.projectionFailures > 0 ? 'partial' : 'success')
      : 'partial';
    const summary = ProjectionRunSchema.parse({
      runId,
      sourceId: item.sourceId,
      observationId: item.observationId,
      startedAt: item.createdAt,
      completedAt: done ? now : undefined,
      status,
      counts,
      errors,
    });

    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        pk: runPk(item.observationId),
        sk: 'META',
        entityType: 'ProjectionRun',
        expectedItems,
        ...summary,
      },
    }));
    return summary;
  }
}
