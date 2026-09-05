import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { ProjectionEventCandidate } from './candidate.js';

export type ExternalId = { source: string; id: string };

export type ResolvedArtist = { id: string; name?: string; created: boolean };
export type ResolvedVenue = { id: string; name?: string; created: boolean };
export type EnsuredEvent = { id: string; created: boolean; duplicate: boolean };
export type ResolveEntityOptions = { canCreate: boolean };

// The canonical API answers `action: 'review'` when it will not create (ADR-021,
// canCreate=false) or cannot match confidently. That is a decision, not a fault,
// so it must never become a retryable failure.
export class EntityResolutionReviewError extends Error {
  constructor(
    readonly entityType: 'artist' | 'venue',
    readonly entityName: string,
    readonly reason: string,
    readonly candidates: unknown[],
  ) {
    super(`${entityType} '${entityName}' needs review: ${reason}`);
    this.name = 'EntityResolutionReviewError';
  }
}

// A 422 from find-or-create is canonical refusing the fact itself: a name that fails
// data quality, a place that is a road rather than a building. Retrying cannot change
// that answer, so it is an exception for a person, never a dead letter.
export class EntityResolutionRejectedError extends Error {
  constructor(
    readonly entityType: 'artist' | 'venue',
    readonly entityName: string,
    readonly code: string,
    readonly detail: string,
  ) {
    super(`${entityType} '${entityName}' rejected by canonical (${code}): ${detail}`);
    this.name = 'EntityResolutionRejectedError';
  }
}

export interface ProjectionBndyApi {
  resolveArtist(candidate: ProjectionEventCandidate, options?: ResolveEntityOptions): Promise<ResolvedArtist>;
  resolveVenue(candidate: ProjectionEventCandidate, options?: ResolveEntityOptions): Promise<ResolvedVenue>;
  ensureEvent(candidate: ProjectionEventCandidate, artistId: string, venueId: string): Promise<EnsuredEvent>;
  getEvent(eventId: string): Promise<Record<string, unknown> | null>;
  findEventByExternalId(sourceId: string, externalId: string): Promise<Record<string, unknown> | null>;
  updateEvent(eventId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  cancelEvent(eventId: string, reason: string): Promise<void>;
  uncancelEvent(eventId: string): Promise<void>;
  hideEvent(eventId: string, reason: string): Promise<void>;
  restoreEvent(eventId: string): Promise<void>;
}

function reviewError(entityType: 'artist' | 'venue', name: string, body: Record<string, unknown>): EntityResolutionReviewError {
  const reason = typeof body.reason === 'string' && body.reason ? body.reason : 'review';
  return new EntityResolutionReviewError(entityType, name, reason, Array.isArray(body.candidates) ? body.candidates : []);
}

function rejectedError(entityType: 'artist' | 'venue', name: string, body: Record<string, unknown>): EntityResolutionRejectedError {
  const detail = stringField(body.error) ?? stringField(body.message) ?? JSON.stringify(body);
  return new EntityResolutionRejectedError(entityType, name, stringField(body.code) ?? 'rejected', detail);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function eventBody(body: unknown): Record<string, unknown> {
  const record = asRecord(body);
  return asRecord(record.event ?? record);
}

export class HttpProjectionBndyApi implements ProjectionBndyApi {
  private readonly secrets = new SecretsManagerClient({});
  private cachedToken?: string;

  constructor(
    private readonly apiBase = (process.env.BNDY_API_BASE ?? 'https://api.bndy.co.uk').replace(/\/$/, ''),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async token(): Promise<string> {
    if (this.cachedToken) return this.cachedToken;
    if (process.env.BNDY_SERVICE_TOKEN) {
      this.cachedToken = process.env.BNDY_SERVICE_TOKEN;
      return this.cachedToken;
    }
    const secretName = process.env.BNDY_SERVICE_SECRET_NAME ?? 'bndy/mcp-service';
    const output = await this.secrets.send(new GetSecretValueCommand({ SecretId: secretName }));
    if (!output.SecretString) throw new Error(`BNDY service secret ${secretName} has no SecretString`);
    const parsed = asRecord(JSON.parse(output.SecretString));
    const token = stringField(parsed.token) ?? stringField(parsed.MCP_SERVICE_TOKEN);
    if (!token) throw new Error(`BNDY service secret ${secretName} must contain token`);
    this.cachedToken = token;
    return token;
  }

  private async request(
    path: string,
    init: RequestInit = {},
    allowedStatuses: number[] = [],
  ): Promise<{ status: number; body: unknown }> {
    const response = await this.fetchImpl(`${this.apiBase}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await this.token()}`,
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let body: unknown;
    try { body = text ? JSON.parse(text) : undefined; } catch { body = text; }
    if (!response.ok && !allowedStatuses.includes(response.status)) {
      throw new Error(`BNDY API ${response.status} ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    }
    return { status: response.status, body };
  }

  async resolveArtist(candidate: ProjectionEventCandidate, options: ResolveEntityOptions = { canCreate: true }): Promise<ResolvedArtist> {
    const artistExternalId = candidate.artistExternalId ?? `name:${candidate.artistName.toLowerCase()}`;
    const out = await this.request('/api/artists/find-or-create', {
      method: 'POST',
      body: JSON.stringify({
        name: candidate.artistName,
        canCreate: options.canCreate,
        location: candidate.artistLocation ?? candidate.venueLocation,
        locationType: 'region',
        venueRegion: candidate.venueLocation,
        externalIds: [{ source: candidate.sourceId, id: artistExternalId }],
        bio: '',
      }),
    }, [409, 422]);
    const body = asRecord(out.body);
    if (body.action === 'review') throw reviewError('artist', candidate.artistName, body);
    if (out.status === 422) throw rejectedError('artist', candidate.artistName, body);
    const artist = asRecord(body.artist);
    const id = stringField(artist.id) ?? stringField(body.existingArtistId);
    if (!id) throw new Error(`Unexpected artist resolution: ${JSON.stringify(body)}`);
    return { id, name: stringField(artist.name), created: body.action === 'created' };
  }

  async resolveVenue(candidate: ProjectionEventCandidate, options: ResolveEntityOptions = { canCreate: true }): Promise<ResolvedVenue> {
    const venueExternalId = candidate.venueExternalId ?? `name:${candidate.venueName.toLowerCase()}:${candidate.venueLocation.toLowerCase()}`;
    const out = await this.request('/api/venues/find-or-create', {
      method: 'POST',
      body: JSON.stringify({
        name: candidate.venueName,
        canCreate: options.canCreate,
        city: candidate.venueLocation,
        ...(candidate.venueAddress ? { address: candidate.venueAddress } : {}),
        externalIds: [{ source: candidate.sourceId, id: venueExternalId }],
      }),
    }, [409, 422]);
    const body = asRecord(out.body);
    if (body.action === 'review') throw reviewError('venue', candidate.venueName, body);
    if (out.status === 422 || body.needsReview === true) throw rejectedError('venue', candidate.venueName, body);
    const venue = asRecord(body.venue ?? body);
    const id = stringField(venue.id);
    if (!id) throw new Error(`Unexpected venue resolution: ${JSON.stringify(body)}`);
    return {
      id,
      name: stringField(venue.name),
      created: body.action === 'created' || body.isNew === true || venue.matchMethod === 'new_venue_created',
    };
  }

  async ensureEvent(candidate: ProjectionEventCandidate, artistId: string, venueId: string): Promise<EnsuredEvent> {
    const payload: Record<string, unknown> = {
      artistId,
      venueId,
      date: candidate.date,
      startTime: candidate.startTime,
      isPublic: true,
      source: candidate.sourceId,
      externalIds: [{ source: candidate.sourceId, id: candidate.sourceEventKey }],
    };
    if (candidate.endTime) payload.endTime = candidate.endTime;
    if (candidate.title) payload.title = candidate.title;
    if (candidate.eventUrl) payload.eventUrl = candidate.eventUrl;
    if (candidate.ticketUrl) payload.ticketUrl = candidate.ticketUrl;
    if (candidate.price) payload.price = candidate.price;
    if (candidate.admissionStatus) payload.ticketed = candidate.admissionStatus === 'PAID_CONFIRMED';

    const out = await this.request('/api/events/community', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, [409]);
    const body = asRecord(out.body);
    if (out.status === 409) {
      const id = stringField(body.existingEventId);
      if (!id) throw new Error(`Duplicate event response has no existingEventId: ${JSON.stringify(body)}`);
      return { id, created: false, duplicate: true };
    }
    const id = stringField(asRecord(body.event).id) ?? stringField(body.id);
    if (!id) throw new Error(`Unexpected event create response: ${JSON.stringify(body)}`);
    return { id, created: true, duplicate: false };
  }

  async getEvent(eventId: string): Promise<Record<string, unknown> | null> {
    const out = await this.request(`/api/events/${encodeURIComponent(eventId)}/mcp`, {}, [404]);
    if (out.status === 404) return null;
    return eventBody(out.body);
  }

  async findEventByExternalId(sourceId: string, externalId: string): Promise<Record<string, unknown> | null> {
    const query = new URLSearchParams({ source: sourceId, id: externalId });
    const out = await this.request(`/api/events/by-external-id?${query.toString()}`, {}, [404]);
    if (out.status === 404) return null;
    const event = eventBody(out.body);
    return stringField(event.id) ? event : null;
  }

  async updateEvent(eventId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const out = await this.request(`/api/events/${encodeURIComponent(eventId)}/mcp`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, [409]);
    const body = asRecord(out.body);
    if (out.status === 409) {
      const existingId = stringField(body.existingEventId);
      throw new Error(`DUPLICATE:${existingId ?? 'unknown'}`);
    }
    return eventBody(out.body);
  }

  async cancelEvent(eventId: string, reason: string): Promise<void> {
    await this.request(`/api/curator/events/${encodeURIComponent(eventId)}/cancel`, {
      method: 'POST', body: JSON.stringify({ reason }),
    });
  }

  async uncancelEvent(eventId: string): Promise<void> {
    await this.request(`/api/curator/events/${encodeURIComponent(eventId)}/uncancel`, { method: 'POST', body: '{}' });
  }

  async hideEvent(eventId: string, reason: string): Promise<void> {
    await this.request(`/api/curator/events/${encodeURIComponent(eventId)}/hide`, {
      method: 'POST', body: JSON.stringify({ reason }),
    });
  }

  async restoreEvent(eventId: string): Promise<void> {
    await this.request(`/api/curator/events/${encodeURIComponent(eventId)}/restore`, { method: 'POST', body: '{}' });
  }
}

export function mergeExternalIds(existing: unknown, sourceId: string, sourceEventKey: string): ExternalId[] {
  const merged = new Map<string, ExternalId>();
  if (Array.isArray(existing)) {
    for (const item of existing) {
      const record = asRecord(item);
      const source = stringField(record.source);
      const id = stringField(record.id);
      if (source && id) merged.set(`${source}\u001f${id}`, { source, id });
    }
  }
  merged.set(`${sourceId}\u001f${sourceEventKey}`, { source: sourceId, id: sourceEventKey });
  return [...merged.values()];
}
