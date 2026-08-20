import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { KlmaNormalisedEvent } from './klma-source.js';
import { KLMA_SOURCE_ID } from './klma-source.js';
import { lookupTrustedBndyId, lookupVenueCanonical } from './klma-venue-aliases.js';

const secrets = new SecretsManagerClient({});
let cachedToken: string | undefined;

async function serviceToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (process.env.BNDY_SERVICE_TOKEN) {
    cachedToken = process.env.BNDY_SERVICE_TOKEN;
    return cachedToken;
  }

  const secretName = process.env.BNDY_SERVICE_SECRET_NAME ?? 'bndy/mcp-service';
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretName }));
  if (!result.SecretString) throw new Error(`Secret ${secretName} has no SecretString`);
  const parsed = JSON.parse(result.SecretString) as Record<string, unknown>;
  const token = parsed.token ?? parsed.MCP_SERVICE_TOKEN;
  if (typeof token !== 'string' || !token) throw new Error(`Secret ${secretName} has no token`);
  cachedToken = token;
  return token;
}

function baseUrl(): string {
  return (process.env.BNDY_API_BASE ?? 'https://api.bndy.co.uk').replace(/\/$/, '');
}

async function request(
  path: string,
  init: RequestInit = {},
  allowedStatuses: number[] = [],
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${await serviceToken()}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  if (!response.ok && !allowedStatuses.includes(response.status)) {
    throw new Error(`BNDY API ${response.status} ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return { status: response.status, body };
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

export type ProjectionResult = {
  sourceEventKey: string;
  artist: { id: string; action: string; name?: string };
  venue: { id: string; action: string; name?: string };
  event: { id: string; action: 'created' | 'existing'; verified: boolean };
};

function assertSafeAdditiveProjection(event: KlmaNormalisedEvent): void {
  const defaultedTown = event.warnings.some((warning) => warning.startsWith('Town defaulted to Stoke-on-Trent'));
  if (defaultedTown) {
    throw new Error(`Venue location is not explicit enough for automatic projection: '${event.venueName}'`);
  }

  if (/\b(artisan\s+tap|eleven|the\s+rigger)\b/i.test(event.venueName)) {
    throw new Error(`Venue requires specialist/multi-act handling before automatic projection: '${event.venueName}'`);
  }
}

async function resolveArtist(event: KlmaNormalisedEvent): Promise<{ id: string; action: string; name?: string }> {
  const payload = {
    name: event.artistName,
    location: event.artistLocation,
    locationType: 'region',
    externalIds: [{ source: KLMA_SOURCE_ID, id: event.artistExternalId }],
    bio: '',
    genres: event.genre ? [event.genre] : [],
  };
  const out = await request('/api/artists/find-or-create', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, [409, 422]);
  const body = asRecord(out.body);

  if (body.action === 'review' || out.status === 422) {
    throw new Error(`Artist resolution needs review for '${event.artistName}': ${JSON.stringify(body)}`);
  }

  const artist = asRecord(body.artist);
  const id = artist.id ?? body.existingArtistId;
  if (typeof id !== 'string' || !id) {
    throw new Error(`Unexpected artist resolution for '${event.artistName}': ${JSON.stringify(body)}`);
  }

  return { id, action: String(body.action ?? (out.status === 409 ? 'duplicate' : 'matched')), name: artist.name };
}

async function resolveVenue(event: KlmaNormalisedEvent): Promise<{ id: string; action: string; name?: string }> {
  // Check for trusted BNDY venue ID from proven alias mappings
  const trustedBndyId = lookupTrustedBndyId(event.venueName);
  if (trustedBndyId) {
    const canonicalName = lookupVenueCanonical(event.venueName);
    return {
      id: trustedBndyId,
      action: 'trusted_alias',
      name: canonicalName ?? event.venueName,
    };
  }

  // Unknown venue - use canonical API for find-or-create
  const payload = {
    name: event.venueName,
    city: event.town,
    externalIds: [{ source: KLMA_SOURCE_ID, id: event.venueExternalId }],
  };
  const out = await request('/api/venues/find-or-create', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, [409, 422]);
  const body = asRecord(out.body);

  if (body.action === 'review' || body.needsReview || out.status === 422) {
    throw new Error(`Venue resolution needs review for '${event.venueName}' (${event.town}): ${JSON.stringify(body)}`);
  }

  const venue = asRecord(body.venue ?? body);
  if (typeof venue.id !== 'string' || !venue.id) {
    throw new Error(`Unexpected venue resolution for '${event.venueName}': ${JSON.stringify(body)}`);
  }

  return {
    id: venue.id,
    action: String(body.action ?? body.matchMethod ?? (body.isNew ? 'created' : 'matched')),
    name: venue.name,
  };
}

async function createOrFindEvent(
  event: KlmaNormalisedEvent,
  artistId: string,
  venueId: string,
): Promise<{ id: string; action: 'created' | 'existing' }> {
  const payload: Record<string, unknown> = {
    artistId,
    venueId,
    date: event.date,
    startTime: event.startTime,
    startTimeDefaulted: event.startTimeDefaulted,
    isPublic: true,
    source: KLMA_SOURCE_ID,
    externalIds: [{ source: KLMA_SOURCE_ID, id: event.sourceEventKey }],
  };
  if (event.eventUrl) payload.eventUrl = event.eventUrl;

  const out = await request('/api/events/community', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, [409]);
  const body = asRecord(out.body);

  if (out.status === 409) {
    const existingId = body.existingEventId;
    if (typeof existingId !== 'string' || !existingId) {
      throw new Error(`Duplicate event response has no existingEventId: ${JSON.stringify(body)}`);
    }
    return { id: existingId, action: 'existing' };
  }

  const createdId = asRecord(body.event).id ?? body.id;
  if (typeof createdId !== 'string' || !createdId) {
    throw new Error(`Unexpected event create response: ${JSON.stringify(body)}`);
  }
  return { id: createdId, action: 'created' };
}

async function verifyEvent(
  eventId: string,
  expected: { artistId: string; venueId: string; date: string },
): Promise<boolean> {
  const out = await request(`/api/events/${encodeURIComponent(eventId)}/mcp`);
  const body = asRecord(out.body);
  const record = asRecord(body.event ?? body);
  if (record.id !== eventId) return false;
  if (record.date !== expected.date) return false;
  if (record.venueId !== expected.venueId) return false;
  const artistIds = Array.isArray(record.artistIds) ? record.artistIds : [];
  if (record.artistId !== expected.artistId && !artistIds.includes(expected.artistId)) return false;
  return true;
}

export async function projectKlmaEvent(event: KlmaNormalisedEvent): Promise<ProjectionResult> {
  assertSafeAdditiveProjection(event);
  const artist = await resolveArtist(event);
  const venue = await resolveVenue(event);
  const projectedEvent = await createOrFindEvent(event, artist.id, venue.id);
  const verified = await verifyEvent(projectedEvent.id, {
    artistId: artist.id,
    venueId: venue.id,
    date: event.date,
  });
  if (!verified) throw new Error(`Read-back verification failed for event ${projectedEvent.id}`);

  return {
    sourceEventKey: event.sourceEventKey,
    artist,
    venue,
    event: { ...projectedEvent, verified },
  };
}
