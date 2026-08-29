import type { DynamoDBBatchResponse, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import { canonicalChangeFromRecord } from '../bndy-baseline/change.js';
import { CanonicalChangeStore, type CanonicalChangePersistResult } from '../bndy-baseline/change-store.js';

export type CanonicalChangeSink = {
  persist(change: NonNullable<ReturnType<typeof canonicalChangeFromRecord>>): Promise<CanonicalChangePersistResult>;
};

export async function processCanonicalChangeRecord(
  record: DynamoDBRecord,
  sink: CanonicalChangeSink,
): Promise<'stored' | 'duplicate' | 'ignored'> {
  const change = canonicalChangeFromRecord(record);
  if (!change) return 'ignored';
  const result = await sink.persist(change);
  return result.evidence === 'existing' ? 'duplicate' : 'stored';
}

function runtimeStore(): CanonicalChangeStore {
  const tableName = process.env.STATE_TABLE;
  const evidenceBucket = process.env.EVIDENCE_BUCKET;
  if (!tableName) throw new Error('STATE_TABLE is required');
  if (!evidenceBucket) throw new Error('EVIDENCE_BUCKET is required');
  return new CanonicalChangeStore(tableName, evidenceBucket);
}

export async function handler(event: DynamoDBStreamEvent): Promise<DynamoDBBatchResponse> {
  const sink = runtimeStore();
  const batchItemFailures: DynamoDBBatchResponse['batchItemFailures'] = [];
  const counts = { stored: 0, duplicate: 0, ignored: 0, failed: 0 };
  for (const record of event.Records) {
    try {
      const result = await processCanonicalChangeRecord(record, sink);
      counts[result] += 1;
    } catch (error) {
      counts.failed += 1;
      console.error('Canonical change ingestion failed', {
        eventID: record.eventID,
        message: error instanceof Error ? error.message : String(error),
      });
      const itemIdentifier = record.dynamodb?.SequenceNumber ?? record.eventID;
      if (itemIdentifier) batchItemFailures.push({ itemIdentifier });
      else throw error;
    }
  }
  console.log('Canonical change stream batch', counts);
  return { batchItemFailures };
}
