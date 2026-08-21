import { createHash } from 'node:crypto';
import type {
  ClaimPredicate,
  EventCandidate,
  KnowledgeClaim,
  ProjectionAction,
  ProjectionWorkItem,
  SourceObservation,
} from '../../knowledge/types.js';
import type { KnowledgeOutput, NormalisedSourceEvent, SourceEventDiff } from './types.js';

function id(prefix: string, ...parts: string[]): string {
  return `${prefix}-${createHash('sha256').update(parts.join('\u001f')).digest('hex').slice(0, 32)}`;
}

export function eventCandidateKey(sourceId: string, sourceEventKey: string): string {
  return `event:${sourceId}:${sourceEventKey}`;
}

function claimFor(
  observation: SourceObservation,
  event: NormalisedSourceEvent,
  predicate: ClaimPredicate,
  value: unknown,
): KnowledgeClaim {
  const candidateKey = eventCandidateKey(observation.sourceId, event.sourceEventKey);
  return {
    id: id('claim', observation.id, candidateKey, predicate, JSON.stringify(value)),
    observationId: observation.id,
    sourceId: observation.sourceId,
    subject: { type: 'event-candidate', key: candidateKey },
    predicate,
    value,
    confidence: 1,
    evidence: {
      sourceUrl: observation.sourceUrl,
      evidenceKey: observation.evidenceKey,
      rawItemId: event.sourceEventKey,
      contentHash: event.contentHash,
    },
    observedAt: observation.observedAt,
    status: 'active',
  };
}

function eventClaims(observation: SourceObservation, event: NormalisedSourceEvent): KnowledgeClaim[] {
  const claims: KnowledgeClaim[] = [];
  if (event.artistName) {
    claims.push(claimFor(observation, event, 'hasPerformerName', event.artistName));
    claims.push(claimFor(observation, event, 'hasPerformer', {
      name: event.artistName,
      ...(event.artistExternalId ? { sourceNativeId: event.artistExternalId } : {}),
      ...(event.artistLocation ? { location: event.artistLocation } : {}),
    }));
  }
  if (event.venueName) {
    claims.push(claimFor(observation, event, 'hasVenueName', event.venueName));
    claims.push(claimFor(observation, event, 'occursAt', {
      name: event.venueName,
      ...(event.venueExternalId ? { sourceNativeId: event.venueExternalId } : {}),
      ...(event.venueLocation ? { location: event.venueLocation } : {}),
      ...(event.venueAddress ? { address: event.venueAddress } : {}),
    }));
  }
  if (event.date) claims.push(claimFor(observation, event, 'occursOn', event.date));
  if (event.startTime) claims.push(claimFor(observation, event, 'startsAt', event.startTime));
  if (event.endTime) claims.push(claimFor(observation, event, 'endsAt', event.endTime));
  if (event.title) claims.push(claimFor(observation, event, 'hasTitle', event.title));
  if (event.eventUrl) claims.push(claimFor(observation, event, 'hasEventUrl', event.eventUrl));
  if (event.ticketUrl) claims.push(claimFor(observation, event, 'hasTicketUrl', event.ticketUrl));
  if (event.admissionStatus) claims.push(claimFor(observation, event, 'hasAdmissionStatus', event.admissionStatus));
  if (event.price) claims.push(claimFor(observation, event, 'hasPrice', event.price));
  if (event.status) claims.push(claimFor(observation, event, 'hasStatus', event.status));
  if (claims.length === 0) claims.push(claimFor(observation, event, 'derivedFrom', event.sourceEventKey));
  return claims;
}

export function buildKnowledge(
  observation: SourceObservation,
  events: NormalisedSourceEvent[],
): KnowledgeOutput {
  const claims: KnowledgeClaim[] = [];
  const candidates: EventCandidate[] = [];
  const claimsByCandidate = new Map<string, KnowledgeClaim[]>();

  for (const event of events) {
    const candidateKey = eventCandidateKey(observation.sourceId, event.sourceEventKey);
    const candidateClaims = eventClaims(observation, event);
    claims.push(...candidateClaims);
    claimsByCandidate.set(candidateKey, candidateClaims);
    candidates.push({
      candidateKey,
      sourceId: observation.sourceId,
      sourceEventKey: event.sourceEventKey,
      sourceNativeId: event.sourceNativeId,
      artistName: event.artistName,
      venueName: event.venueName,
      date: event.date,
      startTime: event.startTime,
      eventUrl: event.eventUrl,
      title: event.title,
      supportingClaimIds: candidateClaims.map((claim) => claim.id),
      confidence: 1,
      observedAt: observation.observedAt,
    });
  }

  return { observation, claims, candidates, claimsByCandidate };
}

export function buildWithdrawalClaim(
  observation: SourceObservation,
  prior: NormalisedSourceEvent,
): KnowledgeClaim {
  return claimFor(observation, prior, 'hasStatus', 'absent-from-complete-snapshot');
}

function workItem(
  observation: SourceObservation,
  event: NormalisedSourceEvent,
  action: ProjectionAction,
  claimIds: string[],
): ProjectionWorkItem {
  const candidateKey = eventCandidateKey(observation.sourceId, event.sourceEventKey);
  return {
    id: id('projection', observation.sourceId, observation.id, candidateKey, action),
    sourceId: observation.sourceId,
    observationId: observation.id,
    candidateKey,
    entityType: 'event',
    action,
    idempotencyKey: `${observation.sourceId}:${observation.id}:${candidateKey}:${action}`,
    claimIds,
    createdAt: observation.observedAt,
  };
}

export function buildProjectionWork(
  observation: SourceObservation,
  diff: SourceEventDiff,
  claimsByCandidate: Map<string, KnowledgeClaim[]>,
): { workItems: ProjectionWorkItem[]; withdrawalClaims: KnowledgeClaim[] } {
  const workItems: ProjectionWorkItem[] = [];
  const withdrawalClaims: KnowledgeClaim[] = [];

  for (const event of diff.added) {
    const claimIds = (claimsByCandidate.get(eventCandidateKey(observation.sourceId, event.sourceEventKey)) ?? []).map((claim) => claim.id);
    workItems.push(workItem(observation, event, 'create', claimIds));
  }
  for (const event of diff.updated) {
    const claimIds = (claimsByCandidate.get(eventCandidateKey(observation.sourceId, event.sourceEventKey)) ?? []).map((claim) => claim.id);
    workItems.push(workItem(observation, event, 'update', claimIds));
  }
  for (const prior of diff.withdrawn) {
    const withdrawal = buildWithdrawalClaim(observation, prior);
    withdrawalClaims.push(withdrawal);
    workItems.push(workItem(observation, prior, 'withdraw', [withdrawal.id]));
  }

  return { workItems, withdrawalClaims };
}
