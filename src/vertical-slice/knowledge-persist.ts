import { ClaimStore, ObservationStore } from '../knowledge/stores/index.js';
import type { KnowledgeBuildResult } from './klma-source.js';

export type PersistedKnowledge = {
  tableName: string;
  bucketName: string;
  evidenceKey: string;
  observationRecords: number;
  claimRecords: number;
};

export async function persistKnowledgeToAws(
  knowledge: KnowledgeBuildResult,
  rawEvidence: string,
): Promise<PersistedKnowledge> {
  const tableName = process.env.STATE_TABLE;
  const bucketName = process.env.EVIDENCE_BUCKET;
  if (!tableName || !bucketName) {
    throw new Error('STATE_TABLE and EVIDENCE_BUCKET are required for --persist-aws');
  }

  const observations = new ObservationStore(tableName, bucketName);
  const claims = new ClaimStore(tableName);
  const storedObservation = await observations.put(knowledge.observation, rawEvidence, {
    contentType: 'text/csv; charset=utf-8',
    extension: 'csv',
  });

  for (const claim of knowledge.claims) {
    await claims.put(claim);
  }

  return {
    tableName,
    bucketName,
    evidenceKey: storedObservation.evidenceKey ?? '',
    observationRecords: 1,
    claimRecords: knowledge.claims.length,
  };
}
