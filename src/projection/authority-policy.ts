import type { AuthorityClass, ClaimPredicate, KnowledgeClaim, Tombstone } from '../knowledge/types.js';

export type SupportingClaim = {
  claim: KnowledgeClaim;
  authorityClass: AuthorityClass;
};

export type AuthorityEvaluation = {
  allowed: boolean;
  reason: string;
  proposedScore: number;
  strongestFreshSupport?: {
    claimId: string;
    sourceId: string;
    authorityClass: AuthorityClass;
    score: number;
  };
};

export type AuthorityInput = {
  predicate: ClaimPredicate;
  proposedAuthority: AuthorityClass;
  proposedClaim?: KnowledgeClaim;
  existingSupportingClaims?: SupportingClaim[];
  ownerManaged?: boolean;
  destructive?: boolean;
  mutation?: boolean;
  tombstone?: Tombstone | null;
  now?: Date;
  freshnessDays?: number;
};

const EVENT_PREDICATES = new Set<ClaimPredicate>([
  'hasPerformer', 'hasPerformerName', 'occursAt', 'hasVenueName', 'occursOn',
  'startsAt', 'endsAt', 'hasTitle', 'hasAdmissionStatus', 'hasPrice',
  'hasTicketUrl', 'hasEventUrl', 'hasStatus', 'performsAt',
]);

const ARTIST_PROFILE_PREDICATES = new Set<ClaimPredicate>([
  'hasName', 'hasNameVariant', 'hasFacebookUrl', 'hasWebsiteUrl', 'hasInstagramUrl',
  'hasLocation', 'hasArtistType', 'hasActType', 'hasGenre', 'hasBio',
]);

const VENUE_PROFILE_PREDICATES = new Set<ClaimPredicate>([
  'hasAddress', 'hasGooglePlaceId', 'locatedIn',
]);

const BASE_SCORE: Record<AuthorityClass, number> = {
  owner: 100,
  'artist-owned': 90,
  'venue-owned': 90,
  'official-ticket': 80,
  curated: 65,
  aggregator: 45,
  capture: 35,
};

/**
 * Wave-one deterministic authority policy (ADR-109).
 *
 * This is intentionally explicit rather than learned. The ranking is adjusted
 * by predicate so an artist-owned source leads artist profile facts, a
 * venue-owned source leads venue facts and both remain strong for event facts.
 */
export function authorityScore(predicate: ClaimPredicate, authority: AuthorityClass): number {
  let score = BASE_SCORE[authority];

  if (ARTIST_PROFILE_PREDICATES.has(predicate)) {
    if (authority === 'artist-owned') score = 100;
    if (authority === 'venue-owned') score = 50;
    if (authority === 'official-ticket') score = 55;
  } else if (VENUE_PROFILE_PREDICATES.has(predicate)) {
    if (authority === 'venue-owned') score = 100;
    if (authority === 'artist-owned') score = 55;
    if (authority === 'official-ticket') score = 65;
  } else if (EVENT_PREDICATES.has(predicate)) {
    if (authority === 'venue-owned') score = 95;
    if (authority === 'artist-owned') score = 92;
    if (authority === 'official-ticket') score = 88;
  }

  return score;
}

function fresh(claim: KnowledgeClaim, now: Date, freshnessDays: number): boolean {
  const observed = Date.parse(claim.observedAt);
  if (!Number.isFinite(observed)) return false;
  return observed >= now.getTime() - freshnessDays * 24 * 60 * 60 * 1000;
}

function isStrongReinstatement(authority: AuthorityClass): boolean {
  return authority === 'owner' || authority === 'artist-owned' || authority === 'venue-owned';
}

export class AuthorityPolicy {
  evaluate(input: AuthorityInput): AuthorityEvaluation {
    const now = input.now ?? new Date();
    const freshnessDays = input.freshnessDays ?? 30;
    const proposedScore = authorityScore(input.predicate, input.proposedAuthority);

    if (input.ownerManaged && (input.mutation || input.destructive)) {
      const ownerAllowed = input.proposedAuthority === 'owner' || input.proposedAuthority === 'artist-owned';
      if (!ownerAllowed) {
        return {
          allowed: false,
          reason: `owner-managed event blocks ${input.proposedAuthority} mutation`,
          proposedScore,
        };
      }
    }

    if (input.tombstone?.status === 'active' && !input.destructive) {
      if (!isStrongReinstatement(input.proposedAuthority)) {
        return {
          allowed: false,
          reason: `active tombstone requires explicit owner/artist/venue-owned reinstatement`,
          proposedScore,
        };
      }
    }

    if (input.destructive) {
      let strongest: AuthorityEvaluation['strongestFreshSupport'];
      for (const support of input.existingSupportingClaims ?? []) {
        if (support.claim.status !== 'active') continue;
        if (input.proposedClaim && support.claim.id === input.proposedClaim.id) continue;
        if (!fresh(support.claim, now, freshnessDays)) continue;
        const score = authorityScore(input.predicate, support.authorityClass);
        if (!strongest || score > strongest.score) {
          strongest = {
            claimId: support.claim.id,
            sourceId: support.claim.sourceId,
            authorityClass: support.authorityClass,
            score,
          };
        }
      }

      if (strongest && strongest.score > proposedScore) {
        return {
          allowed: false,
          reason: `fresh higher-authority support (${strongest.authorityClass}) blocks destructive projection`,
          proposedScore,
          strongestFreshSupport: strongest,
        };
      }

      return {
        allowed: true,
        reason: strongest
          ? `proposed authority is not lower than strongest fresh support`
          : `no fresh higher-authority support exists`,
        proposedScore,
        strongestFreshSupport: strongest,
      };
    }

    return { allowed: true, reason: 'non-destructive projection allowed', proposedScore };
  }
}
