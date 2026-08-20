import { ClaimStore, ObservationStore, SourceRegistryStore, SourceStateStore } from '../../knowledge/stores/index.js';
import type { AcquisitionRouter } from './acquisition.js';
import { getSourceAdapter } from './adapter.js';
import { SqsProjectionPublisher } from './projection-publisher.js';
import { S3SourceRunArtifactStore } from './storage.js';
import type { RunnerDependencies } from './runner.js';

export function createRunnerDependencies(acquisition: AcquisitionRouter): RunnerDependencies {
  const tableName = process.env.STATE_TABLE;
  const evidenceBucket = process.env.EVIDENCE_BUCKET;
  const projectionQueueUrl = process.env.PROJECTION_QUEUE_URL;
  if (!tableName) throw new Error('STATE_TABLE is required');
  if (!evidenceBucket) throw new Error('EVIDENCE_BUCKET is required');
  if (!projectionQueueUrl) throw new Error('PROJECTION_QUEUE_URL is required');

  return {
    registry: new SourceRegistryStore(tableName),
    state: new SourceStateStore(tableName),
    observations: new ObservationStore(tableName, evidenceBucket),
    claims: new ClaimStore(tableName),
    artifacts: new S3SourceRunArtifactStore(evidenceBucket),
    projection: new SqsProjectionPublisher(projectionQueueUrl),
    acquisition,
    loadAdapter: getSourceAdapter,
  };
}
