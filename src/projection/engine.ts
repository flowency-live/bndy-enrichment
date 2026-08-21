import { createHash } from 'node:crypto';
import type {
  AuthorityClass,
  ClaimWithdrawal,
  GigSource,
  KnowledgeClaim,
  ProjectionWorkItem,
  Tombstone,
  TombstoneStatus,
} from '../knowledge/types.js';
import { ProjectionWorkItemSchema } from '../knowledge/types.js';
import { AuthorityPolicy, type SupportingClaim } from './authority-policy.js';
import { materialiseEventCandidate, ownerManagedEvent, type ProjectionEventCandidate } from './candidate.js';
import { mergeExternalIds, type ProjectionBndyApi, type ResolvedArtist, type ResolvedVenue } from './bndy-api.js';
import { enrichmentItem, type EntityEnrichmentPublisher } from './enrichment-publisher.js';
import type { ProjectionExceptionSink } from './exception-sink.js';
import type { ProjectionCountDelta, ProjectionMapping } from './projection-store.js';

export interface ProjectionSourceRegistry {
  get(sourceId: string): Promise<GigSource | null>;
}
export interface ProjectionClaimStore {
  get(claimId: string): Promise<KnowledgeClaim | null>;
  listBySubject(subjectType: 'event-candidate', subjectKey: string, limit?: number): Promise<KnowledgeClaim[]>;
  listSupportClaimIds(entityType: 'artist' | 'venue' | 'event', entityId: string): Promise<string[]>;
  linkCanonicalEntity(entityType: 'artist' | 'venue' | 'event', entityId: string, claimId: string): Promise<void>;
}
export interface ProjectionTombstoneStore {
  get(artistId: string, venueId: string, date: string): Promise<Tombstone | null>;
  put(tombstone: Tombstone): Promise<void>;
  updateLifecycle(
    artistId: string,
    venueId: string,
    date: string,
    status: TombstoneStatus,
    options?: { supersededAt?: string; supersededByClaimId?: string },
  ): Promise<void>;
}
export interface ProjectionStateStore {
  getMapping(sourceId: string, candidateKey: string): Promise<ProjectionMapping | null>;
  isItemComplete(idempotencyKey: string): Promise<boolean>;
  markSuccess(
    item: ProjectionWorkItem,
    mapping: Omit<ProjectionMapping, 'sourceId' | 'candidateKey'>,
    outcome: 'success' | 'shadow',
    details?: Record<string, unknown>,
  ): Promise<void>;
  recordFailure(item: ProjectionWorkItem, message: string): Promise<void>;
  putWithdrawal(withdrawal: ClaimWithdrawal): Promise<void>;
  recordRunItem(item: ProjectionWorkItem, delta: ProjectionCountDelta, error?: string): Promise<unknown>;
}

export type ProjectionDependencies = {
  sources: ProjectionSourceRegistry;
  claims: ProjectionClaimStore;
  tombstones: ProjectionTombstoneStore;
  state: ProjectionStateStore;
  api: ProjectionBndyApi;
  authority: AuthorityPolicy;
  exceptions: ProjectionExceptionSink;
  enrichment: EntityEnrichmentPublisher;
  now?: () => Date;
};

export type ProjectionResult = {
  status: 'success' | 'shadow' | 'exception' | 'idempotent';
  sourceId: string;
  candidateKey: string;
  action: string;
  artistId?: string;
  venueId?: string;
  eventId?: string;
  message?: string;
};

function digest(prefix: string, value: string): string {
  return `${prefix}-${createHash('sha256').update(value).digest('hex').slice(0, 32)}`;
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

async function loadItemClaims(item: ProjectionWorkItem, store: ProjectionClaimStore): Promise<KnowledgeClaim[]> {
  const subjectClaims = await store.listBySubject('event-candidate', item.candidateKey, 1000);
  if (subjectClaims.length) return subjectClaims;
  const claims: KnowledgeClaim[] = [];
  for (const id of item.claimIds) {
    const claim = await store.get(id);
    if (claim) claims.push(claim);
  }
  return claims;
}

function mappingFrom(
  artist?: ResolvedArtist,
  venue?: ResolvedVenue,
  eventId?: string,
  previous?: ProjectionMapping | null,
): Omit<ProjectionMapping, 'sourceId' | 'candidateKey'> {
  return {
    artistId: artist?.id ?? previous?.artistId,
    venueId: venue?.id ?? previous?.venueId,
    eventId: eventId ?? previous?.eventId,
  };
}

function updatePayload(
  candidate: ProjectionEventCandidate,
  artistId: string,
  venueId: string,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    artistId,
    venueId,
    date: candidate.date,
    startTime: candidate.startTime,
    externalIds: mergeExternalIds(existing.externalIds, candidate.sourceId, candidate.sourceEventKey),
  };
  if (candidate.endTime) payload.endTime = candidate.endTime;
  if (candidate.title) payload.title = candidate.title;
  if (candidate.eventUrl) payload.eventUrl = candidate.eventUrl;
  if (candidate.ticketUrl) payload.ticketUrl = candidate.ticketUrl;
  if (candidate.price) payload.price = candidate.price;
  if (candidate.admissionStatus) payload.ticketed = candidate.admissionStatus === 'PAID_CONFIRMED';
  return payload;
}

function verifyEvent(
  event: Record<string, unknown> | null,
  eventId: string,
  artistId: string,
  venueId: string,
  date: string,
): void {
  if (!event || event.id !== eventId) throw new Error(`Read-back verification failed: event ${eventId} missing`);
  if (event.date !== date) throw new Error(`Read-back verification failed: event ${eventId} date mismatch`);
  if (event.venueId !== venueId) throw new Error(`Read-back verification failed: event ${eventId} venue mismatch`);
  const artists = Array.isArray(event.artistIds) ? event.artistIds : [];
  if (event.artistId !== artistId && !artists.includes(artistId)) {
    throw new Error(`Read-back verification failed: event ${eventId} artist mismatch`);
  }
}

async function supportingClaimsForEvent(
  eventId: string,
  deps: ProjectionDependencies,
): Promise<SupportingClaim[]> {
  const ids = await deps.claims.listSupportClaimIds('event', eventId);
  const out: SupportingClaim[] = [];
  const sourceCache = new Map<string, AuthorityClass>();
  for (const id of ids) {
    const claim = await deps.claims.get(id);
    if (!claim) continue;
    let authority = sourceCache.get(claim.sourceId);
    if (!authority) {
      const config = await deps.sources.get(claim.sourceId);
      authority = config?.authorityClass ?? 'capture';
      sourceCache.set(claim.sourceId, authority);
    }
    out.push({ claim, authorityClass: authority });
  }
  return out;
}

async function linkSupport(
  claims: KnowledgeClaim[],
  artistId: string,
  venueId: string,
  eventId: string,
  store: ProjectionClaimStore,
): Promise<void> {
  for (const claim of claims) {
    await store.linkCanonicalEntity('event', eventId, claim.id);
    if (claim.predicate === 'hasPerformer' || claim.predicate === 'hasPerformerName') {
      await store.linkCanonicalEntity('artist', artistId, claim.id);
    }
    if (claim.predicate === 'occursAt' || claim.predicate === 'hasVenueName') {
      await store.linkCanonicalEntity('venue', venueId, claim.id);
    }
  }
}

async function handledException(
  item: ProjectionWorkItem,
  reason: string,
  deps: ProjectionDependencies,
  details?: Record<string, unknown>,
): Promise<ProjectionResult> {
  await deps.exceptions.raise({
    id: digest('projection-exception', item.idempotencyKey),
    item,
    reason,
    details,
    createdAt: (deps.now ?? (() => new Date()))().toISOString(),
  });
  await deps.state.markSuccess(item, {}, 'success', { outcome: 'exception', reason });
  await deps.state.recordRunItem(item, { claims: item.claimIds.length });
  return {
    status: 'exception',
    sourceId: item.sourceId,
    candidateKey: item.candidateKey,
    action: item.action,
    message: reason,
  };
}

async function maybeReinstate(
  tombstone: Tombstone | null,
  candidate: ProjectionEventCandidate,
  source: GigSource,
  proposedClaim: KnowledgeClaim | undefined,
  deps: ProjectionDependencies,
): Promise<{ allowed: boolean; eventId?: string; reason?: string }> {
  if (!tombstone || tombstone.status !== 'active') return { allowed: true };
  const evaluation = deps.authority.evaluate({
    predicate: 'hasStatus',
    proposedAuthority: source.authorityClass,
    proposedClaim,
    tombstone,
    mutation: true,
  });
  if (!evaluation.allowed) return { allowed: false, reason: evaluation.reason };

  if (tombstone.canonicalEventId) {
    const existing = await deps.api.getEvent(tombstone.canonicalEventId);
    if (existing) {
      if (existing.cancelled === true) await deps.api.uncancelEvent(tombstone.canonicalEventId);
      if (existing.isPublic === false) await deps.api.restoreEvent(tombstone.canonicalEventId);
    }
  }
  await deps.tombstones.updateLifecycle(candidate.artistExternalId ?? '', candidate.venueExternalId ?? '', candidate.date, 'reinstated').catch(() => undefined);
  return { allowed: true, eventId: tombstone.canonicalEventId };
}

function tombstoneRecord(
  item: ProjectionWorkItem,
  candidate: ProjectionEventCandidate,
  artistId: string,
  venueId: string,
  eventId: string,
  source: GigSource,
  claimId: string,
  reason: string,
  createdAt: string,
): Tombstone {
  const fingerprint = `${artistId}|${venueId}|${candidate.date}`;
  return {
    id: digest('tombstone', fingerprint),
    eventFingerprint: fingerprint,
    canonicalEventId: eventId,
    artistId,
    venueId,
    date: candidate.date,
    status: 'active',
    reason,
    authorityClass: source.authorityClass,
    sourceId: item.sourceId,
    claimId,
    observationId: item.observationId,
    createdAt,
  };
}

export async function projectWorkItem(rawItem: ProjectionWorkItem, deps: ProjectionDependencies): Promise<ProjectionResult> {
  const item = ProjectionWorkItemSchema.parse(rawItem);
  if (await deps.state.isItemComplete(item.idempotencyKey)) {
    return { status: 'idempotent', sourceId: item.sourceId, candidateKey: item.candidateKey, action: item.action };
  }

  const source = await deps.sources.get(item.sourceId);
  if (!source) return await handledException(item, `Unknown source ${item.sourceId}`, deps);

  const claims = await loadItemClaims(item, deps.claims);
  if (!claims.length) return await handledException(item, 'Projection item has no readable Claims', deps);

  let candidate: ProjectionEventCandidate;
  try {
    candidate = materialiseEventCandidate(item.candidateKey, item.sourceId, claims);
  } catch (error) {
    return await handledException(item, error instanceof Error ? error.message : String(error), deps);
  }

  const previous = await deps.state.getMapping(item.sourceId, item.candidateKey);

  // Shadow and Cowork-owned sources execute the whole evidence/candidate path but
  // never call BNDY mutation APIs. D19: only one live writer exists at a time.
  if (source.shadow || source.writerAuthority !== 'aws') {
    const reason = source.shadow ? 'source is in shadow mode' : `writerAuthority=${source.writerAuthority}`;
    await deps.state.markSuccess(item, mappingFrom(undefined, undefined, undefined, previous), 'shadow', {
      wouldWrite: item.action,
      candidate,
      reason,
    });
    await deps.state.recordRunItem(item, { claims: claims.length });
    return { status: 'shadow', sourceId: item.sourceId, candidateKey: item.candidateKey, action: item.action, message: reason };
  }

  try {
    if (item.action === 'cancel' || item.action === 'withdraw') {
      let eventId = previous?.eventId;
      if (!eventId) {
        const found = await deps.api.findEventByExternalId(item.sourceId, candidate.sourceEventKey);
        eventId = stringField(found?.id);
      }
      if (!eventId) return await handledException(item, 'No canonical event mapping for destructive projection', deps);
      const event = await deps.api.getEvent(eventId);
      if (!event) return await handledException(item, `Canonical event ${eventId} no longer exists`, deps);

      const existingSupport = await supportingClaimsForEvent(eventId, deps);
      const proposedClaim = claims.find((claim) => item.claimIds.includes(claim.id));
      const evaluation = deps.authority.evaluate({
        predicate: 'hasStatus',
        proposedAuthority: source.authorityClass,
        proposedClaim,
        existingSupportingClaims: existingSupport,
        ownerManaged: ownerManagedEvent(event),
        destructive: true,
      });
      if (!evaluation.allowed) {
        return await handledException(item, evaluation.reason, deps, { strongestFreshSupport: evaluation.strongestFreshSupport });
      }

      const artistId = stringField(event.artistId)
        ?? (Array.isArray(event.artistIds) ? stringField(event.artistIds[0]) : undefined)
        ?? previous?.artistId;
      const venueId = stringField(event.venueId) ?? previous?.venueId;
      if (!artistId || !venueId) return await handledException(item, 'Canonical event is missing artistId/venueId', deps);

      if (item.action === 'cancel') {
        await deps.api.cancelEvent(eventId, 'Explicit cancellation asserted by source');
        const verified = await deps.api.getEvent(eventId);
        if (verified?.cancelled !== true) throw new Error(`Read-back verification failed: event ${eventId} not cancelled`);
      } else {
        await deps.api.hideEvent(eventId, 'Absent from complete authoritative source snapshot');
        const verified = await deps.api.getEvent(eventId);
        if (verified?.isPublic !== false) throw new Error(`Read-back verification failed: event ${eventId} not hidden`);
      }

      const now = (deps.now ?? (() => new Date()))().toISOString();
      const claimId = proposedClaim?.id ?? item.claimIds[0]!;
      const existingTombstone = await deps.tombstones.get(artistId, venueId, candidate.date);
      if (!existingTombstone) {
        await deps.tombstones.put(tombstoneRecord(
          item, candidate, artistId, venueId, eventId, source, claimId,
          item.action === 'cancel' ? 'explicit cancellation' : 'absent from complete snapshot', now,
        ));
      }
      if (item.action === 'withdraw') {
        const prior = [...claims]
          .filter((claim) => claim.sourceId === item.sourceId && claim.id !== claimId && claim.predicate !== 'hasStatus')
          .sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
        if (prior) {
          await deps.state.putWithdrawal({
            id: digest('withdrawal', item.idempotencyKey),
            sourceId: item.sourceId,
            observationId: item.observationId,
            priorClaimId: prior.id,
            sourceEventKey: candidate.sourceEventKey,
            reason: 'absent-from-complete-snapshot',
            createdAt: now,
          });
        }
      }

      await deps.state.markSuccess(item, mappingFrom(undefined, undefined, eventId, previous), 'success');
      await deps.state.recordRunItem(item, { claims: claims.length, eventsCancelled: item.action === 'cancel' ? 1 : 0 });
      return { status: 'success', sourceId: item.sourceId, candidateKey: item.candidateKey, action: item.action, eventId };
    }

    const artist = previous?.artistId
      ? { id: previous.artistId, created: false } satisfies ResolvedArtist
      : await deps.api.resolveArtist(candidate);
    const venue = previous?.venueId
      ? { id: previous.venueId, created: false } satisfies ResolvedVenue
      : await deps.api.resolveVenue(candidate);

    const tombstone = await deps.tombstones.get(artist.id, venue.id, candidate.date);
    const proposedClaim = claims.find((claim) => item.claimIds.includes(claim.id));
    if (tombstone?.status === 'active') {
      const evaluation = deps.authority.evaluate({
        predicate: 'hasStatus',
        proposedAuthority: source.authorityClass,
        proposedClaim,
        tombstone,
        mutation: true,
      });
      if (!evaluation.allowed) return await handledException(item, evaluation.reason, deps);
    }

    let eventId = previous?.eventId;
    let eventCreated = false;
    let event = eventId ? await deps.api.getEvent(eventId) : null;

    if (!event) {
      const ensured = await deps.api.ensureEvent(candidate, artist.id, venue.id);
      eventId = ensured.id;
      eventCreated = ensured.created;
      event = await deps.api.getEvent(eventId);
      if (!event) throw new Error(`Read-back verification failed: ensured event ${eventId} missing`);
    }

    const mutationEvaluation = deps.authority.evaluate({
      predicate: 'hasStatus',
      proposedAuthority: source.authorityClass,
      proposedClaim,
      ownerManaged: ownerManagedEvent(event),
      mutation: item.action === 'update' || !eventCreated,
    });
    if (!mutationEvaluation.allowed) {
      // Matching an owner-managed event is safe; changing it is not.
      if (!eventCreated) {
        await linkSupport(claims, artist.id, venue.id, eventId!, deps.claims);
        await deps.state.markSuccess(item, mappingFrom(artist, venue, eventId, previous), 'success', { protectedMatch: true });
        await deps.state.recordRunItem(item, {
          claims: claims.length,
          artistsMatched: artist.created ? 0 : 1,
          venuesMatched: venue.created ? 0 : 1,
        });
        return { status: 'success', sourceId: item.sourceId, candidateKey: item.candidateKey, action: item.action, artistId: artist.id, venueId: venue.id, eventId, message: mutationEvaluation.reason };
      }
      return await handledException(item, mutationEvaluation.reason, deps);
    }

    if (!eventCreated && (item.action === 'update' || item.action === 'create')) {
      await deps.api.updateEvent(eventId!, updatePayload(candidate, artist.id, venue.id, event));
      event = await deps.api.getEvent(eventId!);
    }

    if (tombstone?.status === 'active') {
      if (event?.cancelled === true) await deps.api.uncancelEvent(eventId!);
      if (event?.isPublic === false) await deps.api.restoreEvent(eventId!);
      await deps.tombstones.updateLifecycle(artist.id, venue.id, candidate.date, 'reinstated', {
        supersededAt: (deps.now ?? (() => new Date()))().toISOString(),
        supersededByClaimId: proposedClaim?.id,
      });
      event = await deps.api.getEvent(eventId!);
    }

    verifyEvent(event, eventId!, artist.id, venue.id, candidate.date);
    await linkSupport(claims, artist.id, venue.id, eventId!, deps.claims);

    if (artist.created) await deps.enrichment.publish(enrichmentItem('artist', artist.id, item.sourceId, item.observationId, item.createdAt));
    if (venue.created) await deps.enrichment.publish(enrichmentItem('venue', venue.id, item.sourceId, item.observationId, item.createdAt));

    await deps.state.markSuccess(item, mappingFrom(artist, venue, eventId, previous), 'success');
    const delta: ProjectionCountDelta = {
      claims: claims.length,
      artistsCreated: artist.created ? 1 : 0,
      artistsMatched: artist.created ? 0 : 1,
      venuesCreated: venue.created ? 1 : 0,
      venuesMatched: venue.created ? 0 : 1,
      eventsCreated: eventCreated ? 1 : 0,
      eventsUpdated: !eventCreated && item.action === 'update' ? 1 : 0,
    };
    await deps.state.recordRunItem(item, delta);
    return {
      status: 'success', sourceId: item.sourceId, candidateKey: item.candidateKey, action: item.action,
      artistId: artist.id, venueId: venue.id, eventId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.state.recordFailure(item, message);
    await deps.state.recordRunItem(item, { claims: claims.length, projectionFailures: 1 }, message);
    throw error;
  }
}
