import type { KnowledgeClaim } from '../knowledge/types.js';

export class IncompleteProjectionCandidateError extends Error {
  constructor(
    public readonly candidateKey: string,
    public readonly missingFields: string[],
  ) {
    super(`Projection candidate ${candidateKey} missing ${missingFields.join(', ')}`);
    this.name = 'IncompleteProjectionCandidateError';
  }
}

export type ProjectionEventCandidate = {
  candidateKey: string;
  sourceId: string;
  sourceEventKey: string;
  artistName: string;
  artistExternalId?: string;
  artistLocation?: string;
  venueName: string;
  venueExternalId?: string;
  venueLocation: string;
  venueAddress?: string;
  date: string;
  startTime: string;
  endTime?: string;
  title?: string;
  eventUrl?: string;
  ticketUrl?: string;
  admissionStatus?: string;
  price?: string;
  status?: string;
  observedAt: string;
  supportingClaims: KnowledgeClaim[];
};

type ClaimMap = Map<string, KnowledgeClaim>;

function latestByPredicate(claims: KnowledgeClaim[]): ClaimMap {
  const out = new Map<string, KnowledgeClaim>();
  for (const claim of claims) {
    if (claim.status !== 'active') continue;
    const current = out.get(claim.predicate);
    if (!current || claim.observedAt > current.observedAt) out.set(claim.predicate, claim);
  }
  return out;
}

function stringValue(claim?: KnowledgeClaim): string | undefined {
  return typeof claim?.value === 'string' && claim.value.trim() ? claim.value.trim() : undefined;
}

function objectValue(claim?: KnowledgeClaim): Record<string, unknown> | undefined {
  return claim?.value && typeof claim.value === 'object' && !Array.isArray(claim.value)
    ? claim.value as Record<string, unknown>
    : undefined;
}

function objectString(value: Record<string, unknown> | undefined, key: string): string | undefined {
  const raw = value?.[key];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

function sourceEventKey(candidateKey: string, sourceId: string): string {
  const prefix = `event:${sourceId}:`;
  return candidateKey.startsWith(prefix) ? candidateKey.slice(prefix.length) : candidateKey;
}

export function materialiseEventCandidate(
  candidateKey: string,
  sourceId: string,
  claims: KnowledgeClaim[],
): ProjectionEventCandidate {
  const latest = latestByPredicate(claims);
  const performer = objectValue(latest.get('hasPerformer'));
  const venue = objectValue(latest.get('occursAt'));

  const artistName = objectString(performer, 'name') ?? stringValue(latest.get('hasPerformerName'));
  const venueName = objectString(venue, 'name') ?? stringValue(latest.get('hasVenueName'));
  const venueLocation = objectString(venue, 'location');
  const date = stringValue(latest.get('occursOn'));
  const startTime = stringValue(latest.get('startsAt'));

  const missing = [
    !artistName ? 'artistName' : undefined,
    !venueName ? 'venueName' : undefined,
    !venueLocation ? 'venueLocation' : undefined,
    !date ? 'date' : undefined,
    !startTime ? 'startTime' : undefined,
  ].filter(Boolean);
  if (missing.length) throw new IncompleteProjectionCandidateError(candidateKey, missing as string[]);

  const observedAt = claims.reduce((latestAt, claim) => claim.observedAt > latestAt ? claim.observedAt : latestAt, '');

  return {
    candidateKey,
    sourceId,
    sourceEventKey: sourceEventKey(candidateKey, sourceId),
    artistName: artistName!,
    artistExternalId: objectString(performer, 'sourceNativeId'),
    artistLocation: objectString(performer, 'location'),
    venueName: venueName!,
    venueExternalId: objectString(venue, 'sourceNativeId'),
    venueLocation: venueLocation!,
    venueAddress: objectString(venue, 'address'),
    date: date!,
    startTime: startTime!,
    endTime: stringValue(latest.get('endsAt')),
    title: stringValue(latest.get('hasTitle')),
    eventUrl: stringValue(latest.get('hasEventUrl')),
    ticketUrl: stringValue(latest.get('hasTicketUrl')),
    admissionStatus: stringValue(latest.get('hasAdmissionStatus')),
    price: stringValue(latest.get('hasPrice')),
    status: stringValue(latest.get('hasStatus')),
    observedAt,
    supportingClaims: claims.filter((claim) => claim.status === 'active'),
  };
}

export function ownerManagedEvent(event: Record<string, unknown> | null | undefined): boolean {
  if (!event) return false;
  return Boolean(event.membershipId || event.verifiedByArtist === true);
}
