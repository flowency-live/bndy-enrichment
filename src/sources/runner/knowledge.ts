import { createHash } from 'node:crypto';
import type {
  ClaimPredicate,
  ClaimSubjectType,
  EntityCandidate,
  EventCandidate,
  KnowledgeClaim,
  ProjectionAction,
  ProjectionWorkItem,
  SourceObservation,
} from '../../knowledge/types.js';
import type {
  KnowledgeOutput,
  NormalisedSourceClaim,
  NormalisedSourceEntity,
  NormalisedSourceEvent,
  SourceEventDiff,
} from './types.js';

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
  confidence = 1,
  evidenceText?: string,
): KnowledgeClaim {
  const candidateKey = eventCandidateKey(observation.sourceId, event.sourceEventKey);
  return {
    id: id('claim', observation.id, candidateKey, predicate, JSON.stringify(value)),
    observationId: observation.id,
    sourceId: observation.sourceId,
    subject: { type: 'event-candidate', key: candidateKey },
    predicate,
    value,
    confidence,
    evidence: {
      sourceUrl: event.eventUrl ?? observation.sourceUrl,
      evidenceKey: observation.evidenceKey,
      rawItemId: event.sourceNativeId ?? event.sourceEventKey,
      contentHash: event.contentHash,
      ...(evidenceText ? { text: evidenceText } : {}),
    },
    observedAt: observation.observedAt,
    status: 'active',
  };
}

function customEventClaim(observation: SourceObservation, event: NormalisedSourceEvent, claim: NormalisedSourceClaim): KnowledgeClaim {
  return claimFor(observation, event, claim.predicate, claim.value, claim.confidence ?? 1, claim.evidenceText);
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
  for (const custom of event.claims ?? []) claims.push(customEventClaim(observation, event, custom));
  if (claims.length === 0) claims.push(claimFor(observation, event, 'derivedFrom', event.sourceEventKey));
  return claims;
}

function entitySubjectType(entity: NormalisedSourceEntity): ClaimSubjectType {
  return entity.entityType === 'artist' ? 'artist-candidate' : 'venue-candidate';
}

function entityClaim(
  observation: SourceObservation,
  entity: NormalisedSourceEntity,
  claim: NormalisedSourceClaim,
): KnowledgeClaim {
  const subjectType = entitySubjectType(entity);
  return {
    id: id('claim', observation.id, entity.sourceEntityKey, claim.predicate, JSON.stringify(claim.value)),
    observationId: observation.id,
    sourceId: observation.sourceId,
    subject: { type: subjectType, key: entity.sourceEntityKey },
    predicate: claim.predicate,
    value: claim.value,
    confidence: claim.confidence ?? entity.confidence ?? 1,
    evidence: {
      sourceUrl: entity.sourceUrl ?? observation.sourceUrl,
      evidenceKey: observation.evidenceKey,
      rawItemId: entity.sourceNativeId ?? entity.sourceEntityKey,
      ...(claim.evidenceText ? { text: claim.evidenceText } : {}),
    },
    observedAt: observation.observedAt,
    status: 'active',
  };
}

function entityKnowledge(observation: SourceObservation, entity: NormalisedSourceEntity): {
  claims: KnowledgeClaim[];
  candidate: EntityCandidate;
} {
  const baseClaims: NormalisedSourceClaim[] = entity.displayName
    ? [{ predicate: 'hasName', value: entity.displayName }, ...entity.claims]
    : entity.claims;
  const claims = [...new Map(
    baseClaims
      .map((claim) => entityClaim(observation, entity, claim))
      .map((claim) => [claim.id, claim] as const),
  ).values()];
  return {
    claims,
    candidate: {
      candidateKey: entity.sourceEntityKey,
      entityType: entity.entityType,
      sourceId: observation.sourceId,
      sourceNativeId: entity.sourceNativeId,
      displayName: entity.displayName,
      observedAt: observation.observedAt,
      supportingClaimIds: claims.map((claim) => claim.id),
      confidence: entity.confidence ?? 1,
    },
  };
}

export function buildKnowledge(
  observation: SourceObservation,
  events: NormalisedSourceEvent[],
  entities: NormalisedSourceEntity[] = [],
): KnowledgeOutput {
  const claims: KnowledgeClaim[] = [];
  const candidates: Array<EventCandidate | EntityCandidate> = [];
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

  for (const entity of entities) {
    const output = entityKnowledge(observation, entity);
    claims.push(...output.claims);
    claimsByCandidate.set(entity.sourceEntityKey, output.claims);
    candidates.push(output.candidate);
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

function explicitlyCancelled(event: NormalisedSourceEvent): boolean {
  const status = event.status?.trim().toLowerCase();
  return status === 'cancelled' || status === 'canceled' || status === 'cancelled_event';
}

export function buildProjectionWork(
  observation: SourceObservation,
  diff: SourceEventDiff,
  claimsByCandidate: Map<string, KnowledgeClaim[]>,
  options: { mode?: 'full' | 'additive-only'; bootstrap?: boolean } = {},
): {
  workItems: ProjectionWorkItem[];
  withdrawalClaims: KnowledgeClaim[];
  blocked: Array<{ sourceEventKey: string; action: ProjectionAction }>;
} {
  const workItems: ProjectionWorkItem[] = [];
  const withdrawalClaims: KnowledgeClaim[] = [];
  const blocked: Array<{ sourceEventKey: string; action: ProjectionAction }> = [];
  const mode = options.mode ?? 'full';
  const added = options.bootstrap
    ? [...diff.added, ...diff.updated, ...diff.unchanged]
    : diff.added;

  for (const event of added) {
    const claimIds = (claimsByCandidate.get(eventCandidateKey(observation.sourceId, event.sourceEventKey)) ?? []).map((claim) => claim.id);
    const action = explicitlyCancelled(event) ? 'cancel' : 'create';
    if (mode === 'additive-only' && action !== 'create') blocked.push({ sourceEventKey: event.sourceEventKey, action });
    else workItems.push(workItem(observation, event, action, claimIds));
  }
  for (const event of diff.updated) {
    if (options.bootstrap) continue;
    const claimIds = (claimsByCandidate.get(eventCandidateKey(observation.sourceId, event.sourceEventKey)) ?? []).map((claim) => claim.id);
    const action = explicitlyCancelled(event) ? 'cancel' : 'update';
    if (mode === 'additive-only') blocked.push({ sourceEventKey: event.sourceEventKey, action });
    else workItems.push(workItem(observation, event, action, claimIds));
  }
  for (const prior of diff.withdrawn) {
    if (mode === 'additive-only') {
      blocked.push({ sourceEventKey: prior.sourceEventKey, action: 'withdraw' });
      continue;
    }
    const withdrawal = buildWithdrawalClaim(observation, prior);
    withdrawalClaims.push(withdrawal);
    workItems.push(workItem(observation, prior, 'withdraw', [withdrawal.id]));
  }

  return { workItems, withdrawalClaims, blocked };
}
