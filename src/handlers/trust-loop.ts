import { CandidateStore, ClaimStore, EntityResolutionStore } from '../knowledge/stores/index.js';
import { TrustLoopRunStore } from '../trust-loop/run-store.js';
import { runTrustLoop, type ReviewedKnownAnswer } from '../trust-loop/runner.js';

type TrustLoopEvent = {
  sourceIds?: string[];
  candidateLimit?: number;
  reviewedKnownAnswers?: ReviewedKnownAnswer[];
};

const DEFAULT_SOURCE_IDS = [
  'lemonrock-new-gigs',
  'lemonrock-artist-hydration',
  'lemonrock-venue-hydration',
  'onthecase-gig-index',
  'onthecase-band-hydration',
  'onthecase-venue-hydration',
  'klma-stoke-gig-list',
  'gigs-news-daily-import',
];

export async function handler(event: TrustLoopEvent = {}): Promise<unknown> {
  const tableName = process.env.STATE_TABLE;
  if (!tableName) throw new Error('STATE_TABLE is required');
  return runTrustLoop({
    sourceIds: event.sourceIds?.length ? event.sourceIds : DEFAULT_SOURCE_IDS,
    candidateLimit: event.candidateLimit ?? 40,
    reviewedKnownAnswers: event.reviewedKnownAnswers,
  }, {
    candidates: new CandidateStore(tableName),
    claims: new ClaimStore(tableName),
    resolutions: new EntityResolutionStore(tableName),
    runs: new TrustLoopRunStore(tableName),
  });
}
