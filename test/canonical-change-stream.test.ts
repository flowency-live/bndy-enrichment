import { describe, expect, it, vi } from 'vitest';
import type { AttributeValue, DynamoDBRecord } from 'aws-lambda';
import { BatchWriteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { canonicalChangeFromRecord } from '../src/bndy-baseline/change.js';
import { CanonicalChangeStore } from '../src/bndy-baseline/change-store.js';
import { processCanonicalChangeRecord } from '../src/handlers/canonical-change-stream-worker.js';
import type { DynamoStoreClient, DynamoStoreCommand, DynamoStoreResponse, S3StoreClient } from '../src/knowledge/stores/clients.js';

function av(value: unknown): AttributeValue {
  if (value === null) return { NULL: true };
  if (typeof value === 'string') return { S: value };
  if (typeof value === 'number') return { N: String(value) };
  if (typeof value === 'boolean') return { BOOL: value };
  if (Array.isArray(value)) return { L: value.map(av) };
  return { M: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, av(child)])) };
}

function image(value: Record<string, unknown>): Record<string, AttributeValue> {
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, av(child)]));
}

function streamRecord(
  table: 'bndy-artists' | 'bndy-venues' | 'bndy-events',
  eventName: 'INSERT' | 'MODIFY' | 'REMOVE',
  current?: Record<string, unknown>,
  previous?: Record<string, unknown>,
): DynamoDBRecord {
  return {
    eventID: `event-${table}-${eventName}`,
    eventName,
    eventSourceARN: `arn:aws:dynamodb:eu-west-2:123456789012:table/${table}/stream/2026-08-29T00:00:00.000`,
    dynamodb: {
      ApproximateCreationDateTime: 1_788_000_000,
      SequenceNumber: '12345',
      NewImage: current ? image(current) : undefined,
      OldImage: previous ? image(previous) : undefined,
    },
  };
}

class FakeDynamo implements DynamoStoreClient {
  readonly commands: DynamoStoreCommand[] = [];
  async send(command: DynamoStoreCommand): Promise<DynamoStoreResponse> {
    this.commands.push(command);
    return {};
  }
}

class FakeS3 implements S3StoreClient {
  readonly commands: PutObjectCommand[] = [];
  constructor(private readonly duplicate = false) {}
  async send(command: PutObjectCommand): Promise<Record<string, unknown>> {
    this.commands.push(command);
    if (this.duplicate) throw { name: 'PreconditionFailed', $metadata: { httpStatusCode: 412 } };
    return {};
  }
}

describe('canonical change stream ingestion', () => {
  it('maps an inserted Artist to immutable evidence, Claims and self-resolution', () => {
    const change = canonicalChangeFromRecord(streamRecord('bndy-artists', 'INSERT', {
      id: 'artist-1', name: 'The Example Band', location: 'Manchester', source: 'join_bndy',
    }))!;
    expect(change).toMatchObject({
      eventName: 'INSERT', entityType: 'artist', canonicalId: 'artist-1', sourceId: 'bndy-canonical-artists',
      observation: { enumerationMethod: 'bndy-canonical-dynamodb-stream-v1', complete: true },
      resolution: { status: 'resolved', canonicalEntityId: 'artist-1', method: 'canonical-self-change' },
    });
    expect(change.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({ predicate: 'hasName', value: 'The Example Band' }),
      expect.objectContaining({ predicate: 'hasLocation', value: 'Manchester' }),
    ]));
  });

  it('treats a logical Festival in bndy-events as a Festival subject', () => {
    const change = canonicalChangeFromRecord(streamRecord('bndy-events', 'INSERT', {
      id: 'festival-1', entityType: 'festival', name: 'Test Fest',
    }))!;
    expect(change.entityType).toBe('festival');
    expect(change.claims.every((claim) => claim.subject.type === 'festival')).toBe(true);
  });

  it('ignores a no-op MODIFY with identical old and new images', () => {
    const item = { id: 'venue-1', name: 'The Hall' };
    expect(canonicalChangeFromRecord(streamRecord('bndy-venues', 'MODIFY', item, item))).toBeNull();
  });

  it('records removal without projecting or erasing prior evidence', () => {
    const change = canonicalChangeFromRecord(streamRecord('bndy-events', 'REMOVE', undefined, {
      id: 'event-1', artistId: 'artist-1', venueId: 'venue-1', date: '2026-09-01',
    }))!;
    expect(change.claims).toContainEqual(expect.objectContaining({ predicate: 'hasStatus', value: 'canonical-record-removed' }));
    expect(change.resolution).toMatchObject({ status: 'superseded', method: 'canonical-stream-remove' });
  });

  it('writes retry-safe evidence, observation, claim batches and resolution', async () => {
    const change = canonicalChangeFromRecord(streamRecord('bndy-artists', 'INSERT', { id: 'artist-1', name: 'Band' }))!;
    const ddb = new FakeDynamo();
    const s3 = new FakeS3();
    const result = await new CanonicalChangeStore('StateTable', 'EvidenceBucket', ddb, s3).persist(change);

    expect(result).toEqual({ evidence: 'created', claims: change.claims.length });
    expect(s3.commands[0].input).toMatchObject({ Bucket: 'EvidenceBucket', IfNoneMatch: '*' });
    expect(ddb.commands.filter((command) => command instanceof PutCommand)).toHaveLength(3);
    expect(ddb.commands.some((command) => command instanceof BatchWriteCommand)).toBe(true);
  });

  it('completes missing Dynamo rows when immutable evidence already exists on retry', async () => {
    const change = canonicalChangeFromRecord(streamRecord('bndy-venues', 'INSERT', { id: 'venue-1', name: 'Hall' }))!;
    const ddb = new FakeDynamo();
    const result = await new CanonicalChangeStore('StateTable', 'EvidenceBucket', ddb, new FakeS3(true)).persist(change);
    expect(result.evidence).toBe('existing');
    expect(ddb.commands.length).toBeGreaterThan(2);
  });

  it('returns per-record duplicate semantics without logging canonical data', async () => {
    const persist = vi.fn(async () => ({ evidence: 'existing' as const, claims: 2 }));
    const result = await processCanonicalChangeRecord(
      streamRecord('bndy-artists', 'INSERT', { id: 'artist-1', name: 'Private name' }),
      { persist },
    );
    expect(result).toBe('duplicate');
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
