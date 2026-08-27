import { describe, expect, it } from 'vitest';
import { DeleteCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  DynamoEntityEnrichmentDueStore,
  ENTITY_ENRICHMENT_DUE_PK,
  MAX_DUE_CANDIDATES_PER_PLAN,
} from '../src/enrichment/due-store.js';
import type { EntityEnrichmentCandidate } from '../src/enrichment/types.js';

const candidate: EntityEnrichmentCandidate = {
  entityType: 'artist',
  entityId: 'artist-1',
  displayName: 'Example Artist',
  identityState: 'resolved',
  missingPredicates: ['hasWebsiteUrl'],
  ownerManagedPredicates: [],
  attachedToUpcomingGig: true,
  upcomingGigCount: 2,
  sourceCount: 2,
  activeConflictCount: 0,
};

class FakeDdb {
  commands: any[] = [];
  responses: any[] = [];
  async send(command: any) {
    this.commands.push(command);
    return this.responses.shift() ?? {};
  }
}

describe('Dynamo entity enrichment due store', () => {
  it('writes an idempotent time-ordered due-set record with TTL', async () => {
    const ddb = new FakeDdb();
    const store = new DynamoEntityEnrichmentDueStore(
      'state-table',
      ddb as any,
      () => new Date('2026-08-27T12:00:00.000Z'),
    );
    const record = await store.schedule(candidate, new Date('2026-08-28T03:00:00.000Z'));
    expect(record.key).toEqual({
      pk: ENTITY_ENRICHMENT_DUE_PK,
      sk: '2026-08-28T03:00:00.000Z#artist#artist-1',
    });
    expect(ddb.commands[0]).toBeInstanceOf(PutCommand);
    expect(ddb.commands[0].input.Item).toMatchObject({
      ...record.key,
      entityType: 'EntityEnrichmentDue',
      dueAt: record.dueAt,
      candidate,
    });
    expect(ddb.commands[0].input.Item.expiresAt).toBeGreaterThan(1_788_000_000);
  });

  it('queries the primary-key due set without scanning the corpus', async () => {
    const ddb = new FakeDdb();
    ddb.responses.push({ Items: [{
      pk: ENTITY_ENRICHMENT_DUE_PK,
      sk: '2026-08-27T02:00:00.000Z#artist#artist-1',
      dueAt: '2026-08-27T02:00:00.000Z',
      candidate,
    }] });
    const store = new DynamoEntityEnrichmentDueStore('state-table', ddb as any);
    const records = await store.listDue(new Date('2026-08-27T12:00:00.000Z'), 1_000);
    expect(records).toHaveLength(1);
    expect(ddb.commands[0]).toBeInstanceOf(QueryCommand);
    expect(ddb.commands[0].input).toMatchObject({
      KeyConditionExpression: 'pk = :pk AND sk <= :upper',
      ScanIndexForward: true,
      ConsistentRead: true,
      Limit: MAX_DUE_CANDIDATES_PER_PLAN,
    });
    expect(ddb.commands[0].input.ExpressionAttributeValues[':pk']).toBe(ENTITY_ENRICHMENT_DUE_PK);
  });

  it('removes only the exact consumed due record', async () => {
    const ddb = new FakeDdb();
    const store = new DynamoEntityEnrichmentDueStore('state-table', ddb as any);
    const record = {
      key: { pk: ENTITY_ENRICHMENT_DUE_PK, sk: '2026-08-27T02:00:00.000Z#artist#artist-1' },
      dueAt: '2026-08-27T02:00:00.000Z',
      candidate,
    };
    await store.remove(record);
    expect(ddb.commands[0]).toBeInstanceOf(DeleteCommand);
    expect(ddb.commands[0].input.Key).toEqual(record.key);
  });

  it('fails before DynamoDB for invalid candidate identity', async () => {
    const ddb = new FakeDdb();
    const store = new DynamoEntityEnrichmentDueStore('state-table', ddb as any);
    await expect(store.schedule({ ...candidate, entityId: '' }, new Date())).rejects.toThrow();
    expect(ddb.commands).toEqual([]);
  });
});
