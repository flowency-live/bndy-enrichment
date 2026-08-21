import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { CaptureArtist, CaptureEvent } from '../capture/schema.js';

const secrets = new SecretsManagerClient({});
let cachedServiceToken: string | undefined;

async function serviceToken(): Promise<string> {
  if (cachedServiceToken) return cachedServiceToken;
  if (process.env.BNDY_SERVICE_TOKEN) {
    cachedServiceToken = process.env.BNDY_SERVICE_TOKEN;
    return cachedServiceToken;
  }

  const secretId = process.env.BNDY_SERVICE_SECRET_NAME ?? 'bndy/mcp-service';
  const out = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!out.SecretString) throw new Error(`BNDY service secret ${secretId} has no SecretString`);
  const parsed = JSON.parse(out.SecretString);
  cachedServiceToken = parsed.token ?? parsed.MCP_SERVICE_TOKEN;
  if (!cachedServiceToken) throw new Error(`BNDY service secret ${secretId} must contain token`);
  return cachedServiceToken;
}

function baseUrl(): string {
  return (process.env.BNDY_API_BASE ?? 'https://api.bndy.co.uk').replace(/\/$/, '');
}

async function request(path: string, init: RequestInit = {}, allowStatuses: number[] = []): Promise<{status:number; body:any}> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${await serviceToken()}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = undefined;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok && !allowStatuses.includes(res.status)) {
    throw new Error(`BNDY API ${res.status} ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return { status: res.status, body };
}

function artistTypeWire(value: CaptureArtist['artistType']): string | undefined {
  if (!value) return undefined;
  const map: Record<string, string> = {
    'Band': 'band',
    'Solo Act': 'solo',
    'Duo': 'duo',
    'Trio': 'trio',
    'Group': 'group',
    'DJ': 'dj',
    'Collective': 'collective',
  };
  return map[value];
}

function actTypesWire(values: CaptureArtist['actTypes']): string[] {
  const map: Record<string, string> = {
    'Originals': 'originals',
    'Covers': 'covers',
    'Tribute Act': 'tribute',
  };
  return values.map(v => map[v]).filter(Boolean);
}

export type ArtistResolution = {
  action: 'matched' | 'created' | 'review' | 'duplicate';
  artistId?: string;
  artistName?: string;
  candidates?: any[];
  raw: any;
};

export async function findOrCreateArtist(artist: CaptureArtist, captureId: string): Promise<ArtistResolution> {
  const payload = {
    name: artist.name,
    location: artist.location,
    locationType: artist.locationType ?? 'city',
    artistType: artistTypeWire(artist.artistType),
    actType: actTypesWire(artist.actTypes),
    facebookUrl: artist.facebookUrl,
    bio: artist.bio ?? '',
    genres: artist.genres,
    externalIds: [{ source: 'bndy-capture', id: captureId }],
    verifiedSourceName: Boolean(artist.facebookUrl),
  };

  const out = await request('/api/artists/find-or-create', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, [409, 422]);
  const body = out.body ?? {};

  if (body.action === 'matched' || body.action === 'created') {
    return {
      action: body.action,
      artistId: body.artist?.id,
      artistName: body.artist?.name,
      raw: body,
    };
  }
  if (body.action === 'review') {
    return { action: 'review', candidates: body.candidates ?? [], raw: body };
  }

  // The canonical artist Lambda returns a hard uniqueness conflict as HTTP 409
  // with { action: 'create_failed', code: 'DUPLICATE', existingArtistId }.
  // Older adapters expected action=duplicate/error=DUPLICATE_ARTIST, so a safe
  // duplicate was being treated as a processor failure instead of reusing the
  // canonical record. Accept every explicit duplicate shape, but only when the
  // API supplies the existing artist id.
  const duplicateArtistId = body.existingArtistId ?? body.existingId;
  const explicitDuplicate =
    body.action === 'duplicate' ||
    body.error === 'DUPLICATE_ARTIST' ||
    body.code === 'DUPLICATE' ||
    (out.status === 409 && /duplicate artist/i.test(String(body.error ?? body.message ?? '')));
  if (explicitDuplicate && duplicateArtistId) {
    return { action: 'duplicate', artistId: duplicateArtistId, raw: body };
  }

  throw new Error(`Unexpected artist find-or-create response: ${JSON.stringify(body)}`);
}

export async function getArtist(id: string): Promise<any> {
  const out = await request(`/api/artists/${encodeURIComponent(id)}`);
  return out.body?.artist ?? out.body;
}

export async function patchMissingArtistFields(id: string, existing: any, artist: CaptureArtist): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (!existing?.facebookUrl && !existing?.facebook_url && artist.facebookUrl) updates.facebookUrl = artist.facebookUrl;
  if (!existing?.location && artist.location) updates.location = artist.location;
  if (!existing?.locationType && artist.locationType) updates.locationType = artist.locationType;
  if (!existing?.artistType && !existing?.artist_type && artist.artistType) updates.artistType = artistTypeWire(artist.artistType);
  if ((!existing?.actType || existing.actType.length === 0) && artist.actTypes.length) updates.actType = actTypesWire(artist.actTypes);
  if ((!existing?.genres || existing.genres.length === 0) && artist.genres.length) updates.genres = artist.genres;
  if (!existing?.bio && artist.bio) updates.bio = artist.bio;
  if (Object.keys(updates).length === 0) return;

  await request(`/api/artists/${encodeURIComponent(id)}/mcp`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export type VenueResolution = {
  id: string;
  name: string;
  city?: string;
  isNew: boolean;
  matchMethod?: string;
  raw: any;
};

export async function findOrCreateVenue(event: CaptureEvent, captureId: string): Promise<VenueResolution> {
  if (!event.town) throw new Error(`Venue town missing for ${event.venueName}`);
  const payload = {
    name: event.venueName,
    city: event.town,
    ...(event.address ? { address: event.address } : {}),
    externalIds: [{ source: 'bndy-capture', id: `${captureId}:${event.date}:${event.venueName}` }],
  };

  const out = await request('/api/venues/find-or-create', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, [409, 422]);
  const body = out.body ?? {};

  if (out.status === 422 || body.needsReview) {
    throw new Error(`Venue resolution needs review for ${event.venueName}: ${body.error ?? body.message ?? 'unknown reason'}`);
  }
  if (body.action === 'review') {
    throw new Error(`Venue resolution needs review for ${event.venueName}`);
  }

  const venue = body.venue ?? body;
  if (!venue?.id) throw new Error(`Unexpected venue find-or-create response: ${JSON.stringify(body)}`);
  return {
    id: venue.id,
    name: venue.name ?? event.venueName,
    city: venue.city ?? event.town,
    isNew: body.isNew ?? venue.matchMethod === 'new_venue_created',
    matchMethod: body.matchMethod ?? venue.matchMethod,
    raw: body,
  };
}

export type EventWriteResult = {
  id: string;
  created: boolean;
  duplicate: boolean;
  raw: any;
};

function stableEventExternalId(captureId: string, event: CaptureEvent, venueId: string): string {
  const urlPart = event.eventUrl ? event.eventUrl : `${venueId}:${event.date}`;
  return `${captureId}:${urlPart}`;
}

export async function createEvent(artistId: string, venueId: string, event: CaptureEvent, captureId: string): Promise<EventWriteResult> {
  const externalId = stableEventExternalId(captureId, event, venueId);
  const payload: Record<string, unknown> = {
    artistId,
    venueId,
    date: event.date,
    isPublic: true,
    externalIds: [{ source: 'bndy-capture', id: externalId }],
    eventUrl: event.eventUrl,
    ticketed: event.ticketed ?? event.admission === 'PAID_CONFIRMED',
    ticketUrl: event.ticketUrl,
    price: event.price,
  };
  if (event.startTime) payload.startTime = event.startTime;
  if (event.endTime) payload.endTime = event.endTime;

  const out = await request('/api/events/community', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, [409]);
  const body = out.body ?? {};

  if (body.error === 'DUPLICATE_EVENT' || out.status === 409) {
    if (!body.existingEventId) throw new Error(`Duplicate event returned without existingEventId: ${JSON.stringify(body)}`);
    return { id: body.existingEventId, created: false, duplicate: true, raw: body };
  }

  const id = body.event?.id ?? body.id;
  if (!id) throw new Error(`Unexpected event creation response: ${JSON.stringify(body)}`);
  return { id, created: true, duplicate: false, raw: body };
}
