import { describe, expect, it } from 'vitest';
import { GetCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  DEFAULT_DAILY_ENRICHMENT_LIMITS,
  DynamoEntityEnrichmentControlStore,
} from '../src/enrichment/control-store.js';
import { SAFE_ENRICHMENT_BUDGET } from '../src/enrichment/safety.js';
import type { EntityEnrichmentWorkItem } from '../src/knowledge/types.js';

const item: EntityEnrichmentWorkItem = {
  id: 'enrich-1', entityType: 'artist', entityId: 'artist-1', reason: 'manual',
  createdAt: '2026-08-27T10:00:00.000Z',
};

class FakeDdb {
  commands: any[] = [];
  responses: any[] = [];
  async send(command: any) {
    this.commands.push(command);
    const response = this.responses.shift();
    if (response instanceof Error || response?.name === 'TransactionCanceledException') throw response;
    return response ?? {};
  }
}

describe('Dynamo entity enrichment control store', () => {
  it('atomically reserves daily provider budget and item idempotency', async () => {
    const ddb = new FakeDdb();
    ddb.responses.push({});
    const store = new DynamoEntityEnrichmentControlStore(
      'state-table', ddb as any, DEFAULT_DAILY_ENRICHMENT_LIMITS,
      () => new Date('2026-08-27T10:00:00.000Z'),
    );
    expect(await store.begin(item, 'fixture-provider', SAFE_ENRICHMENT_BUDGET)).toBe('started');
    expect(ddb.commands[0]).toBeInstanceOf(GetCommand);
    expect(ddb.commands[1]).toBeInstanceOf(TransactWriteCommand);
    const transaction = ddb.commands[1].input.TransactItems;
    expect(transaction[0].Update.Key).toEqual({
      pk: 'ENTITY_ENRICHMENT_BUDGET#2026-08-27', sk: 'PROVIDER#fixture-provider',
    });
    expect(transaction[0].Update.ConditionExpression).toContain('#estimatedCost <= :estimatedCostRemaining');
    expect(transaction[1].Put.Item).toMatchObject({
      pk: 'ENTITY_ENRICHMENT#enrich-1', sk: 'STATE', status: 'running', providerId: 'fixture-provider',
    });
  });

  it('resumes a running reservation without spending the daily budget again', async () => {
    const ddb = new FakeDdb();
    ddb.responses.push({ Item: { status: 'running', providerId: 'fixture-provider' } });
    const store = new DynamoEntityEnrichmentControlStore('state-table', ddb as any);
    expect(await store.begin(item, 'fixture-provider', SAFE_ENRICHMENT_BUDGET)).toBe('resume');
    expect(ddb.commands).toHaveLength(1);
  });

  it('treats terminal work as idempotently complete', async () => {
    const ddb = new FakeDdb();
    ddb.responses.push({ Item: { status: 'completed', providerId: 'fixture-provider' } });
    const store = new DynamoEntityEnrichmentControlStore('state-table', ddb as any);
    expect(await store.begin(item, 'fixture-provider', SAFE_ENRICHMENT_BUDGET)).toBe('complete');
  });

  it('fails closed when the atomic daily budget condition is exhausted', async () => {
    const ddb = new FakeDdb();
    ddb.responses.push(
      {},
      { name: 'TransactionCanceledException', CancellationReasons: [{ Code: 'ConditionalCheckFailed' }, { Code: 'None' }] },
      {},
    );
    const store = new DynamoEntityEnrichmentControlStore('state-table', ddb as any);
    expect(await store.begin(item, 'fixture-provider', SAFE_ENRICHMENT_BUDGET)).toBe('budget-exhausted');
  });

  it('records terminal aggregate evidence without canonical mutation fields', async () => {
    const ddb = new FakeDdb();
    const store = new DynamoEntityEnrichmentControlStore(
      'state-table', ddb as any, DEFAULT_DAILY_ENRICHMENT_LIMITS,
      () => new Date('2026-08-27T10:02:00.000Z'),
    );
    await store.record({
      itemId: 'enrich-1', status: 'completed', observationId: 'obs-1', claimsWritten: 3,
      protectedFacts: 1, conflictingFacts: 1, factsNeedingReview: 2, canonicalWrites: 0,
    });
    expect(ddb.commands[0]).toBeInstanceOf(UpdateCommand);
    expect(ddb.commands[0].input.ExpressionAttributeValues[':outcome']).toMatchObject({ canonicalWrites: 0 });
  });
});
