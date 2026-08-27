import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { DiscoveryBudget, EntityEnrichmentWorkItem } from '../knowledge/types.js';
import type { EntityEnrichmentControlStore } from './processor.js';
import type { EnrichmentControlStart, EnrichmentOutcome } from './types.js';

export type DailyEnrichmentLimits = {
  entities: number;
  searches: number;
  fetches: number;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
};

export const DEFAULT_DAILY_ENRICHMENT_LIMITS: DailyEnrichmentLimits = {
  entities: 20,
  searches: 60,
  fetches: 120,
  modelCalls: 20,
  inputTokens: 240_000,
  outputTokens: 40_000,
  estimatedCost: 0.6,
};

type WorkState = {
  status?: string;
  providerId?: string;
};

function ttl(now: Date, days: number): number {
  return Math.floor((now.getTime() + days * 86_400_000) / 1_000);
}

function terminal(status?: string): boolean {
  return status === 'completed' || status === 'parked' || status === 'budget-exhausted';
}

function conditionalTransactionFailure(error: unknown): boolean {
  const value = error as { name?: string; CancellationReasons?: Array<{ Code?: string }> };
  return value?.name === 'TransactionCanceledException'
    && value.CancellationReasons?.some((reason) => reason.Code === 'ConditionalCheckFailed') === true;
}

export class DynamoEntityEnrichmentControlStore implements EntityEnrichmentControlStore {
  private readonly ddb: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    ddb?: DynamoDBDocumentClient,
    private readonly limits: DailyEnrichmentLimits = DEFAULT_DAILY_ENRICHMENT_LIMITS,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.ddb = ddb ?? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  private workKey(itemId: string): { pk: string; sk: string } {
    return { pk: `ENTITY_ENRICHMENT#${itemId}`, sk: 'STATE' };
  }

  private async get(itemId: string): Promise<WorkState | null> {
    const result = await this.ddb.send(new GetCommand({
      TableName: this.tableName,
      Key: this.workKey(itemId),
      ConsistentRead: true,
      ProjectionExpression: '#status, providerId',
      ExpressionAttributeNames: { '#status': 'status' },
    }));
    return result.Item as WorkState | undefined ?? null;
  }

  private existingStart(item: EntityEnrichmentWorkItem, providerId: string, state: WorkState): EnrichmentControlStart {
    if (state.providerId && state.providerId !== providerId) {
      throw new Error(`Enrichment item ${item.id} is already owned by provider ${state.providerId}`);
    }
    return terminal(state.status) ? 'complete' : 'resume';
  }

  async begin(item: EntityEnrichmentWorkItem, providerId: string, budget: DiscoveryBudget): Promise<EnrichmentControlStart> {
    const existing = await this.get(item.id);
    if (existing) return this.existingStart(item, providerId, existing);

    const requested: DailyEnrichmentLimits = {
      entities: 1,
      searches: budget.maxSearches,
      fetches: budget.maxFetches,
      modelCalls: budget.maxModelCalls,
      inputTokens: budget.maxInputTokens,
      outputTokens: budget.maxOutputTokens,
      estimatedCost: budget.maxEstimatedCost,
    };
    const remaining = Object.fromEntries(Object.entries(requested).map(([key, value]) => [
      key,
      this.limits[key as keyof DailyEnrichmentLimits] - value,
    ])) as Record<keyof DailyEnrichmentLimits, number>;
    if (Object.values(remaining).some((value) => value < 0)) return 'budget-exhausted';

    const current = this.now();
    const day = current.toISOString().slice(0, 10);
    const names = Object.fromEntries(Object.keys(requested).map((key) => [`#${key}`, key]));
    const add = Object.keys(requested).map((key) => `#${key} :${key}`).join(', ');
    const condition = Object.keys(requested)
      .map((key) => `(attribute_not_exists(#${key}) OR #${key} <= :${key}Remaining)`)
      .join(' AND ');
    const values: Record<string, unknown> = {
      ':entityType': 'EntityEnrichmentDailyBudget',
      ':providerId': providerId,
      ':day': day,
      ':updatedAt': current.toISOString(),
      ':expiresAt': ttl(current, 32),
    };
    for (const [key, value] of Object.entries(requested)) values[`:${key}`] = value;
    for (const [key, value] of Object.entries(remaining)) values[`:${key}Remaining`] = value;

    try {
      await this.ddb.send(new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.tableName,
              Key: { pk: `ENTITY_ENRICHMENT_BUDGET#${day}`, sk: `PROVIDER#${providerId}` },
              UpdateExpression: `SET entityType = :entityType, providerId = :providerId, budgetDay = :day, updatedAt = :updatedAt, expiresAt = :expiresAt ADD ${add}`,
              ConditionExpression: condition,
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values,
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: {
                ...this.workKey(item.id),
                entityType: 'EntityEnrichmentWorkState',
                itemId: item.id,
                canonicalEntityType: item.entityType,
                canonicalEntityId: item.entityId,
                providerId,
                status: 'running',
                budget,
                startedAt: current.toISOString(),
                updatedAt: current.toISOString(),
                expiresAt: ttl(current, 180),
              },
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
        ],
      }));
      return 'started';
    } catch (error) {
      if (!conditionalTransactionFailure(error)) throw error;
      const raced = await this.get(item.id);
      return raced ? this.existingStart(item, providerId, raced) : 'budget-exhausted';
    }
  }

  async record(outcome: EnrichmentOutcome): Promise<void> {
    const current = this.now();
    await this.ddb.send(new UpdateCommand({
      TableName: this.tableName,
      Key: this.workKey(outcome.itemId),
      UpdateExpression: 'SET #status = :status, outcome = :outcome, updatedAt = :updatedAt, completedAt = :completedAt, expiresAt = :expiresAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': outcome.status,
        ':outcome': outcome,
        ':updatedAt': current.toISOString(),
        ':completedAt': current.toISOString(),
        ':expiresAt': ttl(current, 180),
      },
    }));
  }
}
