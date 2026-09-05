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

// One act on a bill. The headliner is always first; artistName/artistExternalId on
// the candidate mirror it so single-act consumers keep working (ADR-118).
export type ProjectionPerformer = {
  name: string;
  externalId?: string;
  location?: string;
  headliner: boolean;
};

export type ProjectionEventCandidate = {
  candidateKey: string;
  sourceId: string;
  sourceEventKey: string;
  artistName: string;
  artistExternalId?: string;
  artistLocation?: string;
  performers: ProjectionPerformer[];
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

function claimOrder(claim: KnowledgeClaim): string {
  return `${claim.observedAt}#${claim.assertedAt ?? claim.observedAt}#${claim.id}`;
}

function latestByPredicate(claims: KnowledgeClaim[]): ClaimMap {
  const out = new Map<string, KnowledgeClaim>();
  for (const claim of claims) {
    if (claim.status !== 'active') continue;
    const current = out.get(claim.predicate);
    if (!current || claimOrder(claim) > claimOrder(current)) out.set(claim.predicate, claim);
  }
  return out;
}

function ordinalOf(value: Record<string, unknown>): number {
  return typeof value.ordinal === 'number' ? value.ordinal : Number.MAX_SAFE_INTEGER;
}

// One hasPerformer Claim per act (ADR-118). Acts are keyed by name so a re-observation
// replaces rather than duplicates; the bill is ordered by position, headliner first.
// A Claim without a position is a legacy one-act bill.
function billFromClaims(claims: KnowledgeClaim[]): ProjectionPerformer[] {
  const newest = new Map<string, { claim: KnowledgeClaim; value: Record<string, unknown>; name: string }>();
  for (const claim of claims) {
    if (claim.status !== 'active' || claim.predicate !== 'hasPerformer') continue;
    const value = objectValue(claim);
    const name = objectString(value, 'name');
    if (!value || !name) continue;
    const current = newest.get(name.toLowerCase());
    if (!current || claimOrder(claim) > claimOrder(current.claim)) newest.set(name.toLowerCase(), { claim, value, name });
  }
  return [...newest.values()]
    .sort((a, b) => (ordinalOf(a.value) - ordinalOf(b.value)) || claimOrder(a.claim).localeCompare(claimOrder(b.claim)))
    .map(({ value, name }, index) => ({
      name,
      externalId: objectString(value, 'sourceNativeId'),
      location: objectString(value, 'location'),
      headliner: typeof value.headliner === 'boolean' ? value.headliner : index === 0,
    }));
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
  const bill = billFromClaims(claims);
  const headliner = bill[0];
  const venue = objectValue(latest.get('occursAt'));

  const artistName = headliner?.name ?? stringValue(latest.get('hasPerformerName'));
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
    artistExternalId: headliner?.externalId,
    artistLocation: headliner?.location,
    performers: bill.length ? bill : [{ name: artistName!, headliner: true }],
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
