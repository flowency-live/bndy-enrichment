import { describe, expect, it } from 'vitest';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { PutCommand, QueryCommand, UpdateCommand, type GetCommand } from '@aws-sdk/lib-dynamodb';
import type { GigSource, KnowledgeClaim, SourceObservation, Tombstone } from '../src/knowledge/types.js';
import {
  ClaimStore,
  ObservationStore,
  SourceRegistryStore,
  SourceStateStore,
  TombstoneStore,
  type DynamoStoreClient,
  type DynamoStoreCommand,
  type DynamoStoreResponse,
  type S3StoreClient,
} from '../src/knowledge/stores/index.js';

class FakeDynamo implements DynamoStoreClient {
  readonly commands: DynamoStoreCommand[] = [];
  readonly responses: DynamoStoreResponse[] = [];

  async send(command: DynamoStoreCommand): Promise<DynamoStoreResponse> {
    this.commands.push(command);
    return this.responses.shift() ?? {};
  }
}

class FakeS3 implements S3StoreClient {
  readonly commands: PutObjectCommand[] = [];

  async send(command: PutObjectCommand): Promise<Record<string, unknown>> {
    this.commands.push(command);
    return {};
  }
}

function source(overrides: Partial<GigSource> = {}): GigSource {
  return {
    id: 'klma-stoke',
    name: 'KLMA Stoke',
    type: 'CURATED_SOURCE',
    url: 'https://example.test/klma',
    region: 'Staffordshire',
    timezone: 'Europe/London',
    cadence: 'daily',
    localTime: '05:00',
    mode: 'delta',
    snapshotSemantics: 'complete',
    authorityClass: 'curated',
    thresholds: {},
    adapter: 'klma-stoke',
    runtimeClass: 'standard',
    enabled: true,
    shadow: true,
    writerAuthority: 'cowork',
    health: 'healthy',
    nextScanAt: '2026-08-21T04:00:00.000Z',
    ...overrides,
  };
}

function observation(): SourceObservation {
  return {
    id: 'obs-1',
    sourceId: 'klma-stoke',
    observedAt: '2026-08-20T22:00:00.000Z',
    sourceUrl: 'https://example.test/klma',
    enumerationMethod: 'export_csv',
    complete: true,
    itemCount: 427,
    futureItemCount: 402,
    contentType: 'text/csv',
  };
}

function claim(): KnowledgeClaim {
  return {
    id: 'claim-1',
    observationId: 'obs-1',
    sourceId: 'klma-stoke',
    subject: { type: 'event-candidate', key: 'event:klma:123' },
    predicate: 'hasPerformerName',
    value: 'Walters & Bligh',
    confidence: 1,
    observedAt: '2026-08-20T22:00:00.000Z',
    status: 'active',
  };
}

function tombstone(): Tombstone {
  return {
    id: 'tomb-1',
    eventFingerprint: 'artist-1#venue-1#2026-08-21',
    canonicalEventId: 'event-1',
    artistId: 'artist-1',
    venueId: 'venue-1',
    date: '2026-08-21',
    status: 'active',
    reason: 'explicit cancellation',
    authorityClass: 'venue-owned',
    sourceId: 'venue-source',
    claimId: 'claim-cancel',
    observationId: 'obs-cancel',
    createdAt: '2026-08-20T22:00:00.000Z',
  };
}

describe('SourceRegistryStore', () => {
  it('writes executable source config with due-source GSI keys', async () => {
    const ddb = new FakeDynamo();
    await new SourceRegistryStore('StateTable', ddb).put(source());

    const input = (ddb.commands[0] as PutCommand).input;
    expect(input.Item?.pk).toBe('SOURCE#klma-stoke');
    expect(input.Item?.sk).toBe('CONFIG');
    expect(input.Item?.GSI_SCHEDULE_PK).toBe('SOURCE_SCHEDULE');
    expect(input.Item?.GSI_SCHEDULE_SK).toBe('2026-08-21T04:00:00.000Z#klma-stoke');
  });

  it('keeps disabled sources out of the schedule index', async () => {
    const ddb = new FakeDynamo();
    await new SourceRegistryStore('StateTable', ddb).put(source({ enabled: false }));
    const input = (ddb.commands[0] as PutCommand).input;
    expect(input.Item?.GSI_SCHEDULE_PK).toBeUndefined();
    expect(input.Item?.GSI_SCHEDULE_SK).toBeUndefined();
  });

  it('queries due sources through the schedule index and never scans', async () => {
    const ddb = new FakeDynamo();
    ddb.responses.push({ Items: [source()] as unknown as Record<string, unknown>[] });
    const due = await new SourceRegistryStore('StateTable', ddb).queryDue('2026-08-21T05:00:00.000Z');

    expect(due).toHaveLength(1);
    const command = ddb.commands[0] as QueryCommand;
    expect(command.input.IndexName).toBe('SourceScheduleIndex');
    expect(command.input.KeyConditionExpression).toContain('GSI_SCHEDULE_PK');
  });

  it('retires legacy aliases and removes their schedule index keys', async () => {
    const ddb = new FakeDynamo();
    ddb.responses.push({ Item: { pk: 'SOURCE#sceniceye-weekly-listing' } }, {});
    const retired = await new SourceRegistryStore('StateTable', ddb).retireSchedule(
      'sceniceye-weekly-listing',
      '2026-08-29T12:00:00.000Z',
    );
    expect(retired).toBe(true);
    const input = (ddb.commands[1] as UpdateCommand).input;
    expect(input.Key).toEqual({ pk: 'SOURCE#sceniceye-weekly-listing', sk: 'CONFIG' });
    expect(input.UpdateExpression).toContain('REMOVE nextScanAt, lastScheduledAt, GSI_SCHEDULE_PK, GSI_SCHEDULE_SK');
    expect(input.ExpressionAttributeValues?.[':disabled']).toBe(false);
  });

  it('does not create a phantom record when a legacy alias is absent', async () => {
    const ddb = new FakeDynamo();
    const retired = await new SourceRegistryStore('StateTable', ddb).retireSchedule(
      'missing-alias',
      '2026-08-29T12:00:00.000Z',
    );
    expect(retired).toBe(false);
    expect(ddb.commands).toHaveLength(1);
  });
});

describe('SourceStateStore', () => {
  it('stores runtime state under SOURCE#id / STATE', async () => {
    const ddb = new FakeDynamo();
    await new SourceStateStore('StateTable', ddb).put({
      sourceId: 'klma-stoke',
      lastObservationId: 'obs-1',
      lastCompleteObservationId: 'obs-1',
      consecutiveFailures: 0,
    });
    const input = (ddb.commands[0] as PutCommand).input;
    expect(input.Item?.pk).toBe('SOURCE#klma-stoke');
    expect(input.Item?.sk).toBe('STATE');
  });

  it('reads existing runtime state', async () => {
    const ddb = new FakeDynamo();
    ddb.responses.push({ Item: { sourceId: 'klma-stoke', consecutiveFailures: 2 } });
    const state = await new SourceStateStore('StateTable', ddb).get('klma-stoke');
    expect(state?.consecutiveFailures).toBe(2);
    expect((ddb.commands[0] as GetCommand).input.Key).toEqual({ pk: 'SOURCE#klma-stoke', sk: 'STATE' });
  });
});

describe('ObservationStore', () => {
  it('writes raw evidence immutably before the observation index row', async () => {
    const ddb = new FakeDynamo();
    const s3 = new FakeS3();
    const stored = await new ObservationStore('StateTable', 'EvidenceBucket', ddb, s3)
      .put(observation(), 'artist,venue,date', { contentType: 'text/csv', extension: 'csv' });

    const s3Input = s3.commands[0].input;
    expect(s3Input.IfNoneMatch).toBe('*');
    expect(s3Input.Key).toBe('source-observations/klma-stoke/2026/08/20/obs-1/raw.csv');
    expect(stored.evidenceKey).toBe(s3Input.Key);

    const ddbInput = (ddb.commands[0] as PutCommand).input;
    expect(ddbInput.Item?.pk).toBe('OBS#obs-1');
    expect(ddbInput.Item?.GSI1PK).toBe('SOURCE#klma-stoke');
    expect(ddbInput.ConditionExpression).toBe('attribute_not_exists(pk)');
  });
});

describe('ClaimStore', () => {
  it('stores each claim once with observation and subject GSIs', async () => {
    const ddb = new FakeDynamo();
    await new ClaimStore('StateTable', ddb).put(claim());
    const input = (ddb.commands[0] as PutCommand).input;

    expect(input.Item?.pk).toBe('CLAIM#claim-1');
    expect(input.Item?.sk).toBe('META');
    expect(input.Item?.GSI1PK).toBe('OBS#obs-1');
    expect(input.Item?.GSI2PK).toBe('SUBJECT#event-candidate#event:klma:123');
    expect(input.ConditionExpression).toBe('attribute_not_exists(pk)');
  });

  it('uses lightweight immutable support links rather than copying the claim', async () => {
    const ddb = new FakeDynamo();
    const store = new ClaimStore('StateTable', ddb);
    await store.linkCanonicalEntity('event', 'event-1', 'claim-1');
    const input = (ddb.commands[0] as PutCommand).input;

    expect(input.Item).toEqual({
      pk: 'ENTITY#event#event-1',
      sk: 'SUPPORT#claim-1',
      claimId: 'claim-1',
    });
  });

  it('looks up canonical support claim ids without scanning', async () => {
    const ddb = new FakeDynamo();
    ddb.responses.push({ Items: [{ claimId: 'claim-1' }, { claimId: 'claim-2' }] });
    const ids = await new ClaimStore('StateTable', ddb).listSupportClaimIds('venue', 'venue-1');
    expect(ids).toEqual(['claim-1', 'claim-2']);
    expect((ddb.commands[0] as QueryCommand).input.KeyConditionExpression).toContain('begins_with');
  });

  it('paginates complete subject reads and rejects silent claim truncation', async () => {
    const ddb = new FakeDynamo();
    const first = {
      ...claim(),
      GSI2PK: 'SUBJECT#event-candidate#event:klma:123',
      GSI2SK: '2026-08-20T22:00:00.000Z#claim-1',
    };
    const second = {
      ...claim(),
      id: 'claim-2',
      GSI2PK: 'SUBJECT#event-candidate#event:klma:123',
      GSI2SK: '2026-08-20T22:00:00.000Z#claim-2',
    };
    ddb.responses.push(
      { Items: [first], LastEvaluatedKey: { GSI2PK: first.GSI2PK, GSI2SK: first.GSI2SK } },
      { Items: [second] },
    );
    const store = new ClaimStore('StateTable', ddb);

    await expect(store.listBySubjectComplete('event-candidate', 'event:klma:123', 1))
      .rejects.toThrow(/Claim safety limit exceeded/);
    expect(ddb.commands).toHaveLength(2);
    expect((ddb.commands[1] as QueryCommand).input.ExclusiveStartKey).toBeDefined();
  });
});

describe('TombstoneStore', () => {
  it('stores the tombstone at the durable artist+venue+date key', async () => {
    const ddb = new FakeDynamo();
    await new TombstoneStore('StateTable', ddb).put(tombstone());
    const input = (ddb.commands[0] as PutCommand).input;
    expect(input.Item?.pk).toBe('TOMBSTONE#artist-1#venue-1#2026-08-21');
    expect(input.Item?.status).toBe('active');
  });

  it('updates lifecycle without deleting the tombstone', async () => {
    const ddb = new FakeDynamo();
    await new TombstoneStore('StateTable', ddb).updateLifecycle(
      'artist-1',
      'venue-1',
      '2026-08-21',
      'reinstated',
      { supersededAt: '2026-08-20T23:00:00.000Z', supersededByClaimId: 'claim-reinstate' },
    );
    const input = (ddb.commands[0] as UpdateCommand).input;
    expect(input.UpdateExpression).toContain('#status = :status');
    expect(input.ExpressionAttributeValues?.[':status']).toBe('reinstated');
    expect(input.ConditionExpression).toBe('attribute_exists(pk)');
  });
});
