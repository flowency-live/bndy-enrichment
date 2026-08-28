import { randomUUID } from 'node:crypto';
import type { EntityCandidateType } from '../knowledge/types.js';
import {
  coreArtistName,
  eventIdentityKey,
  normaliseIdentityText,
  type CandidateStore,
  type IndexedCandidate,
} from '../knowledge/stores/candidate-store.js';
import type { ClaimStore } from '../knowledge/stores/claim-store.js';
import type { EntityResolutionStore } from '../knowledge/stores/resolution-store.js';
import { assessEnrichment, classifyResolution } from './evaluator.js';
import type { CandidateEvidence, TrustLoopDecision, TrustLoopEnrichmentAssessment, TrustLoopReviewCase, TrustLoopRun } from './types.js';
import { TrustLoopRunSchema } from './types.js';
import type { TrustLoopRunStore } from './run-store.js';

export type ReviewedKnownAnswer = {
  candidateType: EntityCandidateType;
  candidateKey: string;
  sourceId: string;
  expectedStatus: 'resolved' | 'unresolved' | 'conflicted';
  canonicalEntityId?: string;
  reviewedBy: string;
  reviewedAt: string;
};

export type RunTrustLoopOptions = {
  sourceIds: string[];
  candidateLimit?: number;
  reviewedKnownAnswers?: ReviewedKnownAnswer[];
  now?: () => Date;
  newId?: () => string;
};

export type TrustLoopDependencies = {
  candidates: CandidateStore;
  claims: ClaimStore;
  resolutions: EntityResolutionStore;
  runs: TrustLoopRunStore;
};

function subjectType(candidateType: EntityCandidateType): 'artist-candidate' | 'venue-candidate' | 'event-candidate' {
  if (candidateType === 'artist') return 'artist-candidate';
  if (candidateType === 'venue') return 'venue-candidate';
  return 'event-candidate';
}

function identityKeys(candidate: IndexedCandidate): string[] {
  if (candidate.candidateType === 'event') {
    const key = eventIdentityKey(candidate.artistName, candidate.venueName, candidate.date);
    return key ? [`event:${key}`] : [];
  }
  if (!candidate.displayName) return [];
  const exact = normaliseIdentityText(candidate.displayName);
  const core = candidate.candidateType === 'artist' ? coreArtistName(candidate.displayName) : exact;
  return [...new Set([exact, core].filter(Boolean).map((name) => `${candidate.candidateType}:${name}`))];
}

async function evidenceForSource(candidate: IndexedCandidate, claims: ClaimStore): Promise<CandidateEvidence> {
  return {
    candidate,
    claims: await claims.listBySubject(subjectType(candidate.candidateType), candidate.candidateKey, 250),
  };
}

async function evidenceForCanonical(candidate: IndexedCandidate, claims: ClaimStore): Promise<CandidateEvidence> {
  if (!candidate.canonicalEntityId) throw new Error('Canonical hypothesis lacks canonicalEntityId');
  return {
    candidate,
    claims: await claims.listBySubject(candidate.candidateType, candidate.canonicalEntityId, 250),
  };
}

function uniqueCandidates(candidates: IndexedCandidate[]): IndexedCandidate[] {
  const map = new Map<string, IndexedCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.candidateType}#${candidate.sourceId}#${candidate.candidateKey}`;
    if (!map.has(key) || candidate.observedAt > map.get(key)!.observedAt) map.set(key, candidate);
  }
  return [...map.values()];
}

function answerKey(answer: Pick<ReviewedKnownAnswer, 'candidateType' | 'sourceId' | 'candidateKey'>): string {
  return `${answer.candidateType}#${answer.sourceId}#${answer.candidateKey}`;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function enrichmentSummary(assessments: TrustLoopEnrichmentAssessment[]) {
  const artists = assessments.filter((assessment) => assessment.eligible);
  const classified = artists.filter((assessment) =>
    ['confirmed', 'canonical-only'].includes(assessment.fields.hasArtistType ?? '')
    && ['confirmed', 'canonical-only'].includes(assessment.fields.hasActType ?? ''));
  const genres = artists.filter((assessment) =>
    ['confirmed', 'canonical-only'].includes(assessment.fields.hasGenre ?? ''));
  const links = artists.filter((assessment) =>
    assessment.confirmedOfficialLinks.length > 0
    || Object.values(assessment.fields).includes('attempted-no-official-presence'));
  return {
    eligibleArtists: artists.length,
    assessedArtists: artists.length,
    classificationCoverage: ratio(classified.length, artists.length),
    genreCoverage: ratio(genres.length, artists.length),
    officialLinkCoverage: ratio(links.length, artists.length),
    attemptedNoOfficialPresence: artists.filter((assessment) =>
      Object.values(assessment.fields).includes('attempted-no-official-presence')).length,
    parkedOrConflicted: artists.filter((assessment) =>
      Object.values(assessment.fields).some((state) => state === 'candidate-only' || state === 'conflicted')).length,
    wrongLinkIncidents: artists.reduce((total, assessment) => total + assessment.wrongLinkIncidents, 0),
  };
}

export async function runTrustLoop(
  options: RunTrustLoopOptions,
  deps: TrustLoopDependencies,
): Promise<TrustLoopRun> {
  if (options.sourceIds.length === 0) throw new Error('At least one sourceId is required');
  const clock = options.now ?? (() => new Date());
  const startedAt = clock().toISOString();
  const candidateLimit = Math.min(Math.max(options.candidateLimit ?? 40, 1), 200);
  const perSourceLimit = Math.max(5, Math.ceil(candidateLimit / options.sourceIds.length));
  const sourceCandidates = uniqueCandidates((await Promise.all(
    options.sourceIds.map((sourceId) => deps.candidates.listBySource(sourceId, perSourceLimit)),
  )).flat())
    .filter((candidate) => ['artist', 'venue', 'event'].includes(candidate.candidateType))
    .slice(0, candidateLimit);

  const decisions: TrustLoopDecision[] = [];
  const assessments: TrustLoopEnrichmentAssessment[] = [];
  const reviewCases: TrustLoopReviewCase[] = [];
  for (const candidate of sourceCandidates) {
    const sourceEvidence = await evidenceForSource(candidate, deps.claims);
    const identityRows = uniqueCandidates((await Promise.all(
      identityKeys(candidate).map((identity) => deps.candidates.listByIdentity(identity, 30)),
    )).flat());
    const canonicalRows = identityRows.filter((row) => Boolean(row.canonicalEntityId));
    const corroboratingRows = identityRows.filter((row) => !row.canonicalEntityId
      && !(row.sourceId === candidate.sourceId && row.candidateKey === candidate.candidateKey));
    const canonicalHypotheses = await Promise.all(canonicalRows.map((row) => evidenceForCanonical(row, deps.claims)));
    const corroboratingCandidates = await Promise.all(corroboratingRows.map((row) => evidenceForSource(row, deps.claims)));
    const decision = classifyResolution({
      candidate: sourceEvidence,
      canonicalHypotheses,
      corroboratingCandidates,
      classifiedAt: clock().toISOString(),
    });
    await deps.resolutions.put(decision, { sourceId: candidate.sourceId });
    if (decision.status === 'resolved' && decision.canonicalEntityId) {
      for (const claimId of sourceEvidence.claims.map((claim) => claim.id)) {
        await deps.claims.linkCanonicalEntity(candidate.candidateType, decision.canonicalEntityId, claimId);
      }
    }
    const canonical = decision.canonicalEntityId
      ? canonicalHypotheses.find((item) => item.candidate.canonicalEntityId === decision.canonicalEntityId)
      : undefined;
    decisions.push(decision);
    assessments.push(assessEnrichment(sourceEvidence, decision, canonical, corroboratingCandidates));
    reviewCases.push({
      candidateType: candidate.candidateType,
      candidateKey: candidate.candidateKey,
      sourceId: candidate.sourceId,
      displayName: candidate.displayName,
      artistName: candidate.artistName,
      venueName: candidate.venueName,
      date: candidate.date,
      status: decision.status as 'resolved' | 'unresolved' | 'conflicted',
      canonicalEntityId: decision.canonicalEntityId,
      canonicalHypotheses: canonicalRows.slice(0, 5).map((row) => ({
        canonicalEntityId: row.canonicalEntityId!,
        displayName: row.displayName,
        artistName: row.artistName,
        venueName: row.venueName,
        date: row.date,
      })),
      supportingClaimIds: decision.supportingClaimIds,
      decisionReasoning: decision.decisionReasoning,
    });
  }

  const knownAnswers = new Map((options.reviewedKnownAnswers ?? []).map((answer) => [answerKey(answer), answer]));
  const knownAnswerChecks = decisions.map((decision) => {
    const answer = knownAnswers.get(answerKey({
      candidateType: decision.candidateType,
      sourceId: decision.sourceId ?? '',
      candidateKey: decision.candidateKey,
    }));
    if (!answer) return null;
    return answer.expectedStatus === decision.status
      && (answer.expectedStatus !== 'resolved' || answer.canonicalEntityId === decision.canonicalEntityId);
  }).filter((value): value is boolean => value !== null);
  const reviewedKnownAnswerSetPassed = knownAnswerChecks.length >= 20 && knownAnswerChecks.every(Boolean);
  const classifications = {
    resolved: decisions.filter((decision) => decision.status === 'resolved').length,
    unresolved: decisions.filter((decision) => decision.status === 'unresolved').length,
    conflicted: decisions.filter((decision) => decision.status === 'conflicted').length,
  };
  const entityTypes = { artist: 0, venue: 0, event: 0, festival: 0 };
  for (const decision of decisions) entityTypes[decision.candidateType] += 1;
  const enrichment = enrichmentSummary(assessments);
  const completeClassification = decisions.length === sourceCandidates.length;
  const traceableDecisions = decisions.every((decision) =>
    decision.supportingClaimIds.length > 0 && decision.decisionReasoning.length > 0);
  const acceptance = {
    completeClassification,
    zeroWrongLinks: enrichment.wrongLinkIncidents === 0,
    traceableDecisions,
    reviewedKnownAnswerSetPassed,
  };
  const status = !completeClassification || !acceptance.zeroWrongLinks || !traceableDecisions
    ? 'failed'
    : reviewedKnownAnswerSetPassed ? 'passed' : 'needs-review';
  const completedAt = clock().toISOString();
  const run = TrustLoopRunSchema.parse({
    id: `trust-loop-${(options.newId ?? randomUUID)()}`,
    startedAt,
    completedAt,
    sourceIds: options.sourceIds,
    candidateLimit,
    candidatesSeen: sourceCandidates.length,
    candidatesClassified: decisions.length,
    classifications,
    entityTypes,
    noSilentDrops: completeClassification,
    canonicalWrites: 0,
    enrichment,
    acceptance,
    status,
    decisions,
    reviewCases,
    enrichmentAssessments: assessments,
  });
  await deps.runs.put(run);
  return run;
}
