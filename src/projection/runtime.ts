import { ClaimStore, SourceRegistryStore, TombstoneStore } from '../knowledge/stores/index.js';
import { AuthorityPolicy } from './authority-policy.js';
import { HttpProjectionBndyApi } from './bndy-api.js';
import { SqsEntityEnrichmentPublisher } from './enrichment-publisher.js';
import { DynamoProjectionExceptionSink } from './exception-sink.js';
import { ProjectionStore } from './projection-store.js';
import type { ProjectionDependencies } from './engine.js';
import { DynamoProjectionControlStore } from './control-store.js';

export function createProjectionDependencies(): ProjectionDependencies {
  const tableName = process.env.STATE_TABLE;
  const enrichmentQueueUrl = process.env.ENTITY_ENRICHMENT_QUEUE_URL;
  if (!tableName) throw new Error('STATE_TABLE is required');
  if (!enrichmentQueueUrl) throw new Error('ENTITY_ENRICHMENT_QUEUE_URL is required');

  return {
    controls: new DynamoProjectionControlStore(tableName),
    sources: new SourceRegistryStore(tableName),
    claims: new ClaimStore(tableName),
    tombstones: new TombstoneStore(tableName),
    state: new ProjectionStore(tableName),
    api: new HttpProjectionBndyApi(),
    authority: new AuthorityPolicy(),
    exceptions: new DynamoProjectionExceptionSink(tableName),
    enrichment: new SqsEntityEnrichmentPublisher(enrichmentQueueUrl),
  };
}
