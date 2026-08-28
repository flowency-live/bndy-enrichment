import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  EntityResolutionSchema,
  GigSourceSchema,
  KnowledgeClaimSchema,
  SourceObservationSchema,
  type ParsedEntityResolution,
  type GigSource,
  type KnowledgeClaim,
  type SourceObservation,
} from './types.js';
import { createDynamoStoreClient, type DynamoStoreClient } from './stores/clients.js';
import { CLAIM_BY_OBSERVATION_INDEX, CLAIM_BY_SUBJECT_INDEX } from './stores/claim-store.js';
import { TrustLoopRunSchema, type TrustLoopRun } from '../trust-loop/types.js';

// Bounded read-only graph traversal for the Backline Evidence Explorer
// (workboard: "Build the interactive Godmode evidence graph").
//
// This module NEVER scans the table. Every expansion is a keyed Get or an
// indexed Query with an explicit limit, so the explorer stays cheap no matter
// how large the knowledge substrate grows. It is deliberately self-contained:
// it reads the same key shapes the stores write but adds no write paths.

export type NodeKind = 'source' | 'observation' | 'claim' | 'candidate' | 'entity';

export type GraphNode = {
  ref: string;
  kind: NodeKind;
  label: string;
  data?: Record<string, unknown>;
};

export type GraphEdge = {
  from: string;
  to: string;
  kind: 'PRODUCED' | 'ASSERTS' | 'ABOUT' | 'RESOLVES_TO' | 'SUPPORTS' | 'REFERENCES';
};

export type Neighborhood = {
  center: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
};

export type NodeRef =
  | { kind: 'source'; id: string }
  | { kind: 'observation'; id: string }
  | { kind: 'claim'; id: string }
  | { kind: 'candidate'; subjectType: string; subjectKey: string }
  | { kind: 'entity'; entityType: string; entityId: string };

const CANDIDATE_TYPES = new Set(['artist-candidate', 'venue-candidate', 'event-candidate']);
const ENTITY_TYPES = new Set(['artist', 'venue', 'event', 'festival']);

/**
 * Node ref grammar, used in URLs and edges:
 *   source:<sourceId>
 *   obs:<observationId>
 *   claim:<claimId>
 *   candidate:<subjectType>:<subjectKey>     (subjectKey may contain ':')
 *   entity:<entityType>:<entityId>
 */
export function parseNodeRef(ref: string): NodeRef {
  const [head, ...rest] = ref.split(':');
  const tail = rest.join(':');
  if (head === 'source' && tail) return { kind: 'source', id: tail };
  if (head === 'obs' && tail) return { kind: 'observation', id: tail };
  if (head === 'claim' && tail) return { kind: 'claim', id: tail };
  if (head === 'candidate') {
    const [subjectType, ...keyParts] = rest;
    const subjectKey = keyParts.join(':');
    if (CANDIDATE_TYPES.has(subjectType) && subjectKey) return { kind: 'candidate', subjectType, subjectKey };
    throw new Error(`Invalid candidate ref: ${ref}`);
  }
  if (head === 'entity') {
    const [entityType, ...idParts] = rest;
    const entityId = idParts.join(':');
    if (ENTITY_TYPES.has(entityType) && entityId) return { kind: 'entity', entityType, entityId };
    throw new Error(`Invalid entity ref: ${ref}`);
  }
  throw new Error(`Unknown node ref: ${ref}`);
}

export function formatNodeRef(ref: NodeRef): string {
  switch (ref.kind) {
    case 'source': return `source:${ref.id}`;
    case 'observation': return `obs:${ref.id}`;
    case 'claim': return `claim:${ref.id}`;
    case 'candidate': return `candidate:${ref.subjectType}:${ref.subjectKey}`;
    case 'entity': return `entity:${ref.entityType}:${ref.entityId}`;
  }
}

function claimLabel(claim: KnowledgeClaim): string {
  const value = typeof claim.value === 'string' ? claim.value : JSON.stringify(claim.value);
  return `${claim.predicate} = ${String(value).slice(0, 60)}`;
}

function shortKey(key: string): string {
  return key.length > 48 ? `${key.slice(0, 45)}...` : key;
}

class Collector {
  readonly nodes = new Map<string, GraphNode>();
  readonly edges = new Map<string, GraphEdge>();
  truncated = false;

  constructor(private readonly limit: number) {}

  full(): boolean {
    if (this.nodes.size >= this.limit) {
      this.truncated = true;
      return true;
    }
    return false;
  }

  node(node: GraphNode): void {
    if (!this.nodes.has(node.ref)) {
      if (this.full()) return;
      this.nodes.set(node.ref, node);
    } else if (node.data && !this.nodes.get(node.ref)?.data) {
      this.nodes.set(node.ref, node);
    }
  }

  edge(edge: GraphEdge): void {
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) return;
    this.edges.set(`${edge.from}|${edge.kind}|${edge.to}`, edge);
  }
}

export class GraphReader {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoStoreClient = createDynamoStoreClient(),
  ) {}

  private async getItem(pk: string, sk: string): Promise<Record<string, unknown> | undefined> {
    const response = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { pk, sk } }));
    return response.Item;
  }

  async getSource(sourceId: string): Promise<GigSource | null> {
    const item = await this.getItem(`SOURCE#${sourceId}`, 'CONFIG');
    return item ? GigSourceSchema.parse(item) : null;
  }

  async listSources(sourceIds: string[]): Promise<GigSource[]> {
    const sources: GigSource[] = [];
    for (const id of sourceIds) {
      const source = await this.getSource(id);
      if (source) sources.push(source);
    }
    return sources;
  }

  async getObservation(observationId: string): Promise<SourceObservation | null> {
    const item = await this.getItem(`OBS#${observationId}`, 'META');
    return item ? SourceObservationSchema.parse(item) : null;
  }

  async listObservationsBySource(sourceId: string, limit: number): Promise<SourceObservation[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: CLAIM_BY_OBSERVATION_INDEX,
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `SOURCE#${sourceId}`, ':prefix': 'OBS#' },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (response.Items ?? [])
      .filter((item) => item.entityType === 'SourceObservation')
      .map((item) => SourceObservationSchema.parse(item));
  }

  async getClaim(claimId: string): Promise<KnowledgeClaim | null> {
    const item = await this.getItem(`CLAIM#${claimId}`, 'META');
    return item ? KnowledgeClaimSchema.parse(item) : null;
  }

  async listClaimsByObservation(observationId: string, limit: number): Promise<KnowledgeClaim[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: CLAIM_BY_OBSERVATION_INDEX,
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `OBS#${observationId}` },
      ScanIndexForward: true,
      Limit: limit,
    }));
    return (response.Items ?? []).map((item) => KnowledgeClaimSchema.parse(item));
  }

  async listClaimsBySubject(subjectType: string, subjectKey: string, limit: number): Promise<KnowledgeClaim[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: CLAIM_BY_SUBJECT_INDEX,
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `SUBJECT#${subjectType}#${subjectKey}` },
      ScanIndexForward: true,
      Limit: limit,
    }));
    return (response.Items ?? []).map((item) => KnowledgeClaimSchema.parse(item));
  }

  async getResolution(candidateType: string, candidateKey: string): Promise<ParsedEntityResolution | null> {
    const item = await this.getItem(`RESOLUTION#${candidateType}#${candidateKey}`, 'META');
    return item ? EntityResolutionSchema.parse(item) : null;
  }

  async listTrustLoopRuns(limit = 10): Promise<TrustLoopRun[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': 'TRUST_LOOP', ':prefix': 'RUN#' },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return (response.Items ?? []).map((item) => TrustLoopRunSchema.parse(item));
  }

  async listSupportClaimIds(entityType: string, entityId: string, limit: number): Promise<string[]> {
    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': `ENTITY#${entityType}#${entityId}`, ':prefix': 'SUPPORT#' },
      ScanIndexForward: true,
      Limit: limit,
    }));
    return (response.Items ?? [])
      .map((item) => item.claimId)
      .filter((claimId): claimId is string => typeof claimId === 'string' && claimId.length > 0);
  }

  private addClaimNode(collector: Collector, claim: KnowledgeClaim): string {
    const ref = `claim:${claim.id}`;
    collector.node({ ref, kind: 'claim', label: claimLabel(claim), data: claim as unknown as Record<string, unknown> });
    return ref;
  }

  private addCandidateNode(collector: Collector, subjectType: string, subjectKey: string): string {
    const ref = `candidate:${subjectType}:${subjectKey}`;
    collector.node({ ref, kind: 'candidate', label: shortKey(subjectKey), data: { subjectType, subjectKey } });
    return ref;
  }

  /** One bounded hop around a node. The UI expands the graph one click at a time. */
  async neighborhood(refText: string, limit = 60): Promise<Neighborhood> {
    const ref = parseNodeRef(refText);
    const collector = new Collector(Math.max(limit, 5));
    const center = formatNodeRef(ref);

    if (ref.kind === 'source') {
      const source = await this.getSource(ref.id);
      collector.node({ ref: center, kind: 'source', label: ref.id, data: source ?? undefined });
      const observations = await this.listObservationsBySource(ref.id, Math.min(limit, 20));
      for (const observation of observations) {
        collector.node({
          ref: `obs:${observation.id}`,
          kind: 'observation',
          label: observation.observedAt,
          data: observation as unknown as Record<string, unknown>,
        });
        collector.edge({ from: center, to: `obs:${observation.id}`, kind: 'PRODUCED' });
      }
    }

    if (ref.kind === 'observation') {
      const observation = await this.getObservation(ref.id);
      collector.node({
        ref: center,
        kind: 'observation',
        label: observation?.observedAt ?? ref.id,
        data: (observation ?? undefined) as unknown as Record<string, unknown> | undefined,
      });
      if (observation) {
        collector.node({ ref: `source:${observation.sourceId}`, kind: 'source', label: observation.sourceId });
        collector.edge({ from: `source:${observation.sourceId}`, to: center, kind: 'PRODUCED' });
      }
      for (const claim of await this.listClaimsByObservation(ref.id, limit)) {
        const claimRef = this.addClaimNode(collector, claim);
        collector.edge({ from: center, to: claimRef, kind: 'ASSERTS' });
        const candidateRef = this.addCandidateNode(collector, claim.subject.type, claim.subject.key);
        collector.edge({ from: claimRef, to: candidateRef, kind: 'ABOUT' });
      }
    }

    if (ref.kind === 'claim') {
      const claim = await this.getClaim(ref.id);
      if (claim) {
        this.addClaimNode(collector, claim);
        collector.node({ ref: `obs:${claim.observationId}`, kind: 'observation', label: claim.observedAt });
        collector.edge({ from: `obs:${claim.observationId}`, to: center, kind: 'ASSERTS' });
        collector.node({ ref: `source:${claim.sourceId}`, kind: 'source', label: claim.sourceId });
        collector.edge({ from: `source:${claim.sourceId}`, to: `obs:${claim.observationId}`, kind: 'PRODUCED' });
        const candidateRef = this.addCandidateNode(collector, claim.subject.type, claim.subject.key);
        collector.edge({ from: center, to: candidateRef, kind: 'ABOUT' });
      } else {
        collector.node({ ref: center, kind: 'claim', label: ref.id });
      }
    }

    if (ref.kind === 'candidate') {
      this.addCandidateNode(collector, ref.subjectType, ref.subjectKey);
      const claims = await this.listClaimsBySubject(ref.subjectType, ref.subjectKey, limit);
      for (const claim of claims) {
        const claimRef = this.addClaimNode(collector, claim);
        collector.edge({ from: claimRef, to: center, kind: 'ABOUT' });
        collector.node({ ref: `obs:${claim.observationId}`, kind: 'observation', label: claim.observedAt });
        collector.edge({ from: `obs:${claim.observationId}`, to: claimRef, kind: 'ASSERTS' });

        // Source-native cross references inside claim values become REFERENCES
        // edges so the gig -> venue -> band shape is walkable.
        const value = claim.value as Record<string, unknown> | string | undefined;
        if (value && typeof value === 'object') {
          const nativeId = (value as Record<string, unknown>).sourceNativeId;
          if (typeof nativeId === 'string' && nativeId.length > 0) {
            const kindGuess = claim.predicate === 'occursAt' ? 'venue-candidate'
              : claim.predicate === 'hasPerformer' ? 'artist-candidate'
                : undefined;
            if (kindGuess) {
              const otherRef = this.addCandidateNode(collector, kindGuess, nativeId);
              collector.edge({ from: center, to: otherRef, kind: 'REFERENCES' });
            }
          }
        }
      }
      const candidateType = ref.subjectType.replace(/-candidate$/, '');
      const resolution = await this.getResolution(candidateType, ref.subjectKey);
      if (resolution?.status === 'resolved' && resolution.canonicalEntityId) {
        const entityType = resolution.candidateType;
        const entityRef = `entity:${entityType}:${resolution.canonicalEntityId}`;
        collector.node({
          ref: entityRef,
          kind: 'entity',
          label: `${entityType} ${shortKey(resolution.canonicalEntityId)}`,
          data: resolution as unknown as Record<string, unknown>,
        });
        collector.edge({ from: center, to: entityRef, kind: 'RESOLVES_TO' });
      }
    }

    if (ref.kind === 'entity') {
      collector.node({ ref: center, kind: 'entity', label: `${ref.entityType} ${shortKey(ref.entityId)}` });
      const claimIds = await this.listSupportClaimIds(ref.entityType, ref.entityId, limit);
      for (const claimId of claimIds.slice(0, Math.min(limit, 30))) {
        const claim = await this.getClaim(claimId);
        if (!claim) continue;
        const claimRef = this.addClaimNode(collector, claim);
        collector.edge({ from: claimRef, to: center, kind: 'SUPPORTS' });
        const candidateRef = this.addCandidateNode(collector, claim.subject.type, claim.subject.key);
        collector.edge({ from: claimRef, to: candidateRef, kind: 'ABOUT' });
      }
    }

    return {
      center,
      nodes: [...collector.nodes.values()],
      edges: [...collector.edges.values()],
      truncated: collector.truncated,
    };
  }
}
