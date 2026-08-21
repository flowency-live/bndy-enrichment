import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
        lastProjectedAt: new Date().toISOString(),
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
        completedAt: new Date().toISOString(),
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
    const runId = item.runId ?? item.observationId;
    const now = new Date().toISOString();
    const names: Record<string, string> = {
      '#status': 'status',
      '#counts': 'counts',
      '#errors': 'errors',
    };
    const values: Record<string, unknown> = {
      ':runId': runId,
      ':sourceId': item.sourceId,
      ':observationId': item.observationId,
      ':startedAt': item.createdAt,
      ':partial': 'partial',
      ':emptyErrors': [],
      ':expectedItems': item.runItemCount ?? 1,
    };
    const setParts = [
      'runId = if_not_exists(runId, :runId)',
      'sourceId = if_not_exists(sourceId, :sourceId)',
      'observationId = if_not_exists(observationId, :observationId)',
      'startedAt = if_not_exists(startedAt, :startedAt)',
      'expectedItems = if_not_exists(expectedItems, :expectedItems)',
      '#status = :partial',
      '#errors = if_not_exists(#errors, :emptyErrors)',
    ];
    const addParts: string[] = [];

    const allCounts: Array<keyof ProjectionRun['counts']> = [
      'itemsSeen', 'claims', 'artistsCreated', 'artistsMatched', 'venuesCreated',
      'venuesMatched', 'eventsCreated', 'eventsUpdated', 'eventsCancelled', 'projectionFailures',
    ];
    for (const key of allCounts) {
      const name = `#c_${key}`;
      const value = `:c_${key}`;
      names[name] = key;
      values[value] = key === 'itemsSeen' ? 1 : (delta[key] ?? 0);
      addParts.push(`#counts.${name} ${value}`);
    }

    if (error) {
      values[':error'] = [error];
      setParts.push('#errors = list_append(if_not_exists(#errors, :emptyErrors), :error)');
    }

    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { pk: runPk(item.observationId), sk: 'META' },
      UpdateExpression: `SET ${setParts.join(', ')} ADD ${addParts.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));

    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { pk: runPk(item.observationId), sk: 'META' },
    }));
    const raw = response.Item ?? {};
    const counts = raw.counts && typeof raw.counts === 'object' ? raw.counts as Record<string, number> : {};
    const itemsSeen = counts.itemsSeen ?? 0;
    const expectedItems = typeof raw.expectedItems === 'number' ? raw.expectedItems : item.runItemCount ?? 1;
    const failures = counts.projectionFailures ?? 0;
    const done = itemsSeen >= expectedItems;
    const status = done ? (failures > 0 ? 'partial' : 'success') : 'partial';

    if (done) {
      await this.client.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: runPk(item.observationId), sk: 'META' },
        UpdateExpression: 'SET #status = :status, completedAt = :completedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status, ':completedAt': now },
      }));
    }

    return ProjectionRunSchema.parse({
      runId,
      sourceId: item.sourceId,
      observationId: item.observationId,
      startedAt: item.createdAt,
      completedAt: done ? now : undefined,
      status,
      counts: {
        itemsSeen,
        claims: counts.claims ?? 0,
        artistsCreated: counts.artistsCreated ?? 0,
        artistsMatched: counts.artistsMatched ?? 0,
        venuesCreated: counts.venuesCreated ?? 0,
        venuesMatched: counts.venuesMatched ?? 0,
        eventsCreated: counts.eventsCreated ?? 0,
        eventsUpdated: counts.eventsUpdated ?? 0,
        eventsCancelled: counts.eventsCancelled ?? 0,
        projectionFailures: failures,
      },
      errors: Array.isArray(raw.errors) ? raw.errors.filter((value): value is string => typeof value === 'string') : [],
    });
  }
}
