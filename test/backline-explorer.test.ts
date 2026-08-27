import { describe, expect, it } from 'vitest';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoStoreClient, DynamoStoreCommand, DynamoStoreResponse } from '../src/knowledge/stores/index.js';
import { GraphReader, formatNodeRef, parseNodeRef } from '../src/knowledge/graph-read.js';
import { createHandler } from '../src/handlers/backline-admin-api.js';
import { knowledgeClaimItem } from '../src/knowledge/stores/claim-store.js';
import { sourceObservationItem } from '../src/knowledge/stores/observation-store.js';
import type { KnowledgeClaim, SourceObservation } from '../src/knowledge/types.js';

// A keyed fake Dynamo: routes Get by pk/sk and Query by index + partition key,
// so tests exercise the real key shapes rather than replaying canned queues.
class KeyedFakeDynamo implements DynamoStoreClient {
  readonly items = new Map<string, Record<string, unknown>>();
  readonly commands: DynamoStoreCommand[] = [];

  put(item: Record<string, unknown>): void {
    this.items.set(`${item.pk}|${item.sk}`, item);
  }

  async send(command: DynamoStoreCommand): Promise<DynamoStoreResponse> {
    this.commands.push(command);
    if (command instanceof GetCommand) {
      const key = command.input.Key as { pk: string; sk: string };
      return { Item: this.items.get(`${key.pk}|${key.sk}`) };
    }
    if (command instanceof QueryCommand) {
      const values = command.input.ExpressionAttributeValues as Record<string, string>;
      const index = command.input.IndexName;
      const limit = command.input.Limit ?? 1000;
      const partition = values[':pk'];
      const prefix = values[':prefix'];
      const matches = [...this.items.values()].filter((item) => {
        if (index === 'ObservationClaimsIndex') {
          return item.GSI1PK === partition && (!prefix || String(item.GSI1SK ?? '').startsWith(prefix));
        }
        if (index === 'SubjectClaimsIndex') return item.GSI2PK === partition;
        return item.pk === partition && (!prefix || String(item.sk).startsWith(prefix));
      });
      return { Items: matches.slice(0, limit) };
    }
    return {};
  }
}

function observation(over: Partial<SourceObservation> = {}): SourceObservation {
  return {
    id: 'obs-1',
    sourceId: 'onthecase-gig-index',
    observedAt: '2026-08-27T05:00:00.000Z',
    url: 'https://onthecasemusic.co.uk/gigs',
    evidenceKey: 'source-observations/x/raw.html',
    enumerationMethod: 'http-onthecase',
    complete: true,
    itemCount: 1,
    contentType: 'text/html',
    ...over,
  } as SourceObservation;
}

function claim(over: Partial<KnowledgeClaim> = {}): KnowledgeClaim {
  return {
    id: 'clm-1',
    observationId: 'obs-1',
    sourceId: 'onthecase-gig-index',
    subject: { type: 'event-candidate', key: 'event:onthecase-gig-index:onthecase:gig:131412' },
    predicate: 'occursAt',
    value: { name: 'Old Fat Ox Holywell', sourceNativeId: 'onthecase:venue:6011' },
    confidence: 1,
    evidence: { sourceUrl: 'https://onthecasemusic.co.uk/gigs' },
    observedAt: '2026-08-27T05:00:00.000Z',
    status: 'active',
    ...over,
  } as KnowledgeClaim;
}

describe('node refs', () => {
  it('round-trips every ref shape, including keys containing colons', () => {
    const refs = [
      'source:onthecase-gig-index',
      'obs:obs-1',
      'claim:clm-1',
      'candidate:event-candidate:event:onthecase-gig-index:onthecase:gig:131412',
      'entity:venue:abc-123',
    ];
    for (const ref of refs) expect(formatNodeRef(parseNodeRef(ref))).toBe(ref);
  });

  it('rejects unknown shapes', () => {
    expect(() => parseNodeRef('nonsense:x')).toThrow(/Unknown node ref/);
    expect(() => parseNodeRef('candidate:not-a-type:key')).toThrow(/Invalid candidate ref/);
  });
});

describe('GraphReader neighborhoods (keyed reads only, never scans)', () => {
  function seeded(): { ddb: KeyedFakeDynamo; reader: GraphReader } {
    const ddb = new KeyedFakeDynamo();
    ddb.put(sourceObservationItem(observation()));
    ddb.put(knowledgeClaimItem(claim()));
    ddb.put(knowledgeClaimItem(claim({ id: 'clm-2', predicate: 'occursOn', value: '2026-08-27' })));
    ddb.put({
      pk: 'RESOLUTION#event-candidate#event:onthecase-gig-index:onthecase:gig:131412',
      sk: 'META',
      candidateType: 'event',
      candidateKey: 'event:onthecase-gig-index:onthecase:gig:131412',
      canonicalEntityId: 'evt-999',
      method: 'sentinel',
      confidence: 1,
      supportingClaimIds: ['clm-1'],
      resolvedAt: '2026-08-27T06:00:00.000Z',
    });
    return { ddb, reader: new GraphReader('TestTable', ddb) };
  }

  it('observation neighborhood links source, claims and candidates', async () => {
    const { reader } = seeded();
    const graph = await reader.neighborhood('obs:obs-1');
    const kinds = new Set(graph.nodes.map((node) => node.kind));
    expect(kinds).toEqual(new Set(['observation', 'source', 'claim', 'candidate']));
    expect(graph.edges).toContainEqual({ from: 'source:onthecase-gig-index', to: 'obs:obs-1', kind: 'PRODUCED' });
    expect(graph.edges).toContainEqual({ from: 'obs:obs-1', to: 'claim:clm-1', kind: 'ASSERTS' });
  });

  it('candidate neighborhood resolves to the canonical entity and follows native references', async () => {
    const { reader } = seeded();
    const graph = await reader.neighborhood('candidate:event-candidate:event:onthecase-gig-index:onthecase:gig:131412');
    expect(graph.nodes).toContainEqual(expect.objectContaining({ ref: 'entity:event:evt-999', kind: 'entity' }));
    expect(graph.edges).toContainEqual(expect.objectContaining({ to: 'entity:event:evt-999', kind: 'RESOLVES_TO' }));
    // occursAt.sourceNativeId walks to the venue candidate.
    expect(graph.nodes).toContainEqual(expect.objectContaining({ ref: 'candidate:venue-candidate:onthecase:venue:6011' }));
    expect(graph.edges).toContainEqual(expect.objectContaining({ kind: 'REFERENCES', to: 'candidate:venue-candidate:onthecase:venue:6011' }));
  });

  it('caps the node count and reports truncation', async () => {
    const ddb = new KeyedFakeDynamo();
    ddb.put(sourceObservationItem(observation()));
    for (let index = 0; index < 40; index += 1) {
      ddb.put(knowledgeClaimItem(claim({ id: `clm-${index}`, predicate: 'hasTitle', value: `t${index}` })));
    }
    const reader = new GraphReader('TestTable', ddb);
    const graph = await reader.neighborhood('obs:obs-1', 10);
    expect(graph.nodes.length).toBeLessThanOrEqual(10);
    expect(graph.truncated).toBe(true);
  });
});

describe('admin API handler', () => {
  const reader = new GraphReader('TestTable', new KeyedFakeDynamo());

  function event(path: string, token?: string, queryString = ''): Parameters<ReturnType<typeof createHandler>>[0] {
    return {
      rawPath: path,
      rawQueryString: queryString,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      requestContext: { http: { method: 'GET' } },
    };
  }

  it('health needs no token; everything else does', async () => {
    const handler = createHandler({ reader, loadToken: async () => 'secret-token' });
    expect((await handler(event('/health'))).statusCode).toBe(200);
    expect((await handler(event('/sources'))).statusCode).toBe(401);
    expect((await handler(event('/sources', 'wrong'))).statusCode).toBe(401);
  });

  it('serves the graph with a valid bearer and rejects bad refs as 400', async () => {
    const handler = createHandler({ reader, loadToken: async () => 'secret-token' });
    const ok = await handler(event('/graph', 'secret-token', 'node=obs%3Aobs-x'));
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body)).toMatchObject({ center: 'obs:obs-x' });
    const bad = await handler(event('/graph', 'secret-token', 'node=nonsense%3Ax'));
    expect(bad.statusCode).toBe(400);
    const missing = await handler(event('/graph', 'secret-token'));
    expect(missing.statusCode).toBe(400);
  });

  it('lists known sources without scanning', async () => {
    const ddb = new KeyedFakeDynamo();
    ddb.put({
      pk: 'SOURCE#onthecase-gig-index', sk: 'CONFIG', entityType: 'GigSource',
      id: 'onthecase-gig-index', name: 'On The Case future gig listing', type: 'CURATED_SOURCE',
      timezone: 'Europe/London', cadence: 'manual', localTime: '02:40', mode: 'delta',
      snapshotSemantics: 'complete', authorityClass: 'curated', thresholds: {}, adapter: 'onthecase',
      runtimeClass: 'standard', enabled: true, shadow: true, writerAuthority: 'cowork', health: 'unknown',
    });
    const handler = createHandler({ reader: new GraphReader('TestTable', ddb), loadToken: async () => 't' });
    const response = await handler(event('/sources', 't'));
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { sources: Array<{ id: string }> };
    expect(body.sources.map((source) => source.id)).toEqual(['onthecase-gig-index']);
  });
});
