import {
  EntityResolutionSchema,
  type ClaimPredicate,
  type KnowledgeClaim,
  type ResolutionEvidenceDimension,
} from '../knowledge/types.js';
import {
  coreArtistName,
  eventIdentityKey,
  normaliseIdentityText,
} from '../knowledge/stores/candidate-store.js';
import type {
  CandidateEvidence,
  ResolutionCase,
  TrustLoopDecision,
  TrustLoopEnrichmentAssessment,
} from './types.js';

const OFFICIAL_LINK_PREDICATES = [
  'hasFacebookUrl',
  'hasWebsiteUrl',
  'hasInstagramUrl',
  'hasBandcampUrl',
  'hasSpotifyUrl',
  'hasOfficialUrl',
] as const satisfies ClaimPredicate[];

const ENRICHMENT_PREDICATES = [
  'hasArtistType',
  'hasActType',
  'isAcoustic',
  'hasGenre',
  'officialPresenceAttempted',
  ...OFFICIAL_LINK_PREDICATES,
] as const satisfies ClaimPredicate[];

// Trust Loop decisions are stored in DynamoDB, whose item limit is 400 KB.
// Keep enough Claim references for direct audit while the complete Claims stay
// available in the Claim store through the candidate and canonical subjects.
const DECISION_CLAIM_LIMIT = 40;
const HYPOTHESIS_CLAIM_LIMIT = 12;
const HYPOTHESIS_LIMIT = 5;

function limitedClaimIds(ids: string[], limit: number): string[] {
  return [...new Set(ids)].slice(0, limit);
}

function activeClaims(evidence: CandidateEvidence, predicate: ClaimPredicate): KnowledgeClaim[] {
  return evidence.claims.filter((claim) => claim.status === 'active' && claim.predicate === predicate);
}

function values(evidence: CandidateEvidence, predicate: ClaimPredicate): unknown[] {
  return activeClaims(evidence, predicate).map((claim) => claim.value);
}

function strings(evidence: CandidateEvidence, predicate: ClaimPredicate): string[] {
  return values(evidence, predicate)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function comparable(value: unknown, predicate: ClaimPredicate): string {
  if (typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return JSON.stringify(value);
  if (OFFICIAL_LINK_PREDICATES.includes(predicate as typeof OFFICIAL_LINK_PREDICATES[number])) {
    try {
      const url = new URL(value);
      return `${url.hostname.replace(/^www\./, '').toLowerCase()}${url.pathname.replace(/\/+$/, '').toLowerCase()}`;
    } catch {
      return normaliseIdentityText(value);
    }
  }
  return normaliseIdentityText(value);
}

function overlaps(left: CandidateEvidence, right: CandidateEvidence, predicate: ClaimPredicate): boolean {
  const rightValues = new Set(values(right, predicate).map((value) => comparable(value, predicate)));
  return values(left, predicate).some((value) => rightValues.has(comparable(value, predicate)));
}

function conflicts(left: CandidateEvidence, right: CandidateEvidence, predicate: ClaimPredicate): boolean {
  const leftValues = values(left, predicate).map((value) => comparable(value, predicate));
  const rightValues = values(right, predicate).map((value) => comparable(value, predicate));
  return leftValues.length > 0 && rightValues.length > 0 && !leftValues.some((value) => rightValues.includes(value));
}

function namesMatch(candidate: CandidateEvidence, canonical: CandidateEvidence): boolean {
  const left = candidate.candidate.displayName;
  const right = canonical.candidate.displayName;
  if (!left || !right) return false;
  const normalise = candidate.candidate.candidateType === 'artist' ? coreArtistName : normaliseIdentityText;
  return normalise(left) === normalise(right);
}

function eventMatches(candidate: CandidateEvidence, canonical: CandidateEvidence): boolean {
  const left = eventIdentityKey(
    candidate.candidate.artistName,
    candidate.candidate.venueName,
    candidate.candidate.date,
  );
  const right = eventIdentityKey(
    canonical.candidate.artistName,
    canonical.candidate.venueName,
    canonical.candidate.date,
  );
  return Boolean(left && right && left === right);
}

type ScoredHypothesis = {
  evidence: CandidateEvidence;
  confidence: number;
  hardMatch: boolean;
  matchedDimensions: ResolutionEvidenceDimension[];
  conflictingDimensions: ResolutionEvidenceDimension[];
  supportingClaimIds: string[];
  reasons: string[];
};

function scoreHypothesis(input: ResolutionCase, canonical: CandidateEvidence): ScoredHypothesis {
  const matched = new Set<ResolutionEvidenceDimension>();
  const conflicting = new Set<ResolutionEvidenceDimension>();
  const reasons: string[] = [];
  let score = 0;

  if (input.candidate.candidate.candidateType === 'event' && eventMatches(input.candidate, canonical)) {
    matched.add('event-fingerprint');
    score = 0.99;
    reasons.push('Exact performer, Venue and date fingerprint');
  } else {
    if (namesMatch(input.candidate, canonical)) {
      matched.add('name');
      score += 0.45;
      reasons.push('Normalised name agrees');
    }
    const dimensions: Array<[ClaimPredicate, ResolutionEvidenceDimension, number, boolean]> = [
      ['hasGooglePlaceId', 'google-place', 0.6, true],
      ['hasFacebookUrl', 'facebook', 0.55, true],
      ['hasWebsiteUrl', 'website', 0.5, true],
      ['hasInstagramUrl', 'instagram', 0.45, true],
      ['hasLocation', 'location', 0.2, false],
      ['hasGenre', 'genre', 0.1, false],
      ['hasArtistType', 'artist-type', 0.08, false],
      ['hasActType', 'act-type', 0.08, false],
    ];
    for (const [predicate, dimension, weight] of dimensions) {
      if (overlaps(input.candidate, canonical, predicate)) {
        matched.add(dimension);
        score += weight;
        reasons.push(`${predicate} agrees`);
      } else if (conflicts(input.candidate, canonical, predicate)) {
        conflicting.add(dimension);
        reasons.push(`${predicate} conflicts`);
      }
    }
    const corroboratingSources = new Set(input.corroboratingCandidates
      .filter((candidate) => namesMatch(input.candidate, candidate))
      .map((candidate) => candidate.candidate.sourceId));
    corroboratingSources.delete(input.candidate.candidate.sourceId);
    if (corroboratingSources.size > 0) {
      matched.add('gig-footprint');
      score += Math.min(0.2, corroboratingSources.size * 0.1);
      reasons.push(`${corroboratingSources.size} independent source name agreement(s)`);
    }
  }

  const hardMatch = matched.has('google-place')
    || matched.has('facebook')
    || matched.has('website')
    || matched.has('instagram')
    || matched.has('event-fingerprint');
  const claimIds = limitedClaimIds([
    ...input.candidate.claims.map((claim) => claim.id),
    ...canonical.claims.map((claim) => claim.id),
  ], HYPOTHESIS_CLAIM_LIMIT);
  return {
    evidence: canonical,
    confidence: Math.min(1, score),
    hardMatch,
    matchedDimensions: [...matched],
    conflictingDimensions: [...conflicting],
    supportingClaimIds: claimIds,
    reasons,
  };
}

export function classifyResolution(input: ResolutionCase): TrustLoopDecision {
  const ranked = input.canonicalHypotheses
    .map((canonical) => scoreHypothesis(input, canonical))
    .sort((left, right) => right.confidence - left.confidence);
  const hypotheses = ranked.slice(0, HYPOTHESIS_LIMIT).map((item) => ({
    canonicalEntityId: item.evidence.candidate.canonicalEntityId!,
    confidence: item.confidence,
    matchedDimensions: item.matchedDimensions,
    conflictingDimensions: item.conflictingDimensions,
    supportingClaimIds: item.supportingClaimIds,
    corroboratingSourceIds: [...new Set(input.corroboratingCandidates.map((candidate) => candidate.candidate.sourceId))],
    reasons: item.reasons,
  }));
  const top = ranked[0];
  const runnerUp = ranked[1];
  const ambiguousHardMatches = ranked.filter((item) => item.hardMatch && item.confidence >= 0.9).length > 1;
  const disputedOfficialIdentity = Boolean(top && top.conflictingDimensions.some((dimension) =>
    ['facebook', 'website', 'instagram', 'google-place'].includes(dimension)));
  const narrowMargin = Boolean(top && runnerUp && top.confidence >= 0.8 && top.confidence - runnerUp.confidence < 0.15);
  const resolved = Boolean(top
    && top.hardMatch
    && top.confidence >= 0.95
    && !ambiguousHardMatches
    && !disputedOfficialIdentity
    && !narrowMargin);
  const conflicted = !resolved && (ambiguousHardMatches || disputedOfficialIdentity || narrowMargin);
  const status = resolved ? 'resolved' : conflicted ? 'conflicted' : 'unresolved';
  const decisionReasoning = top?.reasons.length
    ? top.reasons
    : ['No canonical hypothesis had enough evidence for a safe match'];
  if (!resolved && !conflicted) decisionReasoning.push('Name similarity or footprint alone is not sufficient');

  return EntityResolutionSchema.parse({
    candidateType: input.candidate.candidate.candidateType,
    candidateKey: input.candidate.candidate.candidateKey,
    sourceId: input.candidate.candidate.sourceId,
    ...(resolved ? { canonicalEntityId: top!.evidence.candidate.canonicalEntityId } : {}),
    method: 'backline-trust-loop-v1',
    confidence: top?.confidence ?? 0,
    supportingClaimIds: limitedClaimIds(
      top?.supportingClaimIds ?? input.candidate.claims.map((claim) => claim.id),
      DECISION_CLAIM_LIMIT,
    ),
    hypotheses,
    decisionReasoning,
    status,
    classifiedAt: input.classifiedAt,
    ...(resolved ? { resolvedAt: input.classifiedAt } : {}),
  });
}

function fieldState(
  candidate: CandidateEvidence,
  canonical: CandidateEvidence | undefined,
  corroborating: CandidateEvidence[],
  predicate: ClaimPredicate,
): TrustLoopEnrichmentAssessment['fields'][string] {
  const candidateValues = values(candidate, predicate);
  const canonicalValues = canonical ? values(canonical, predicate) : [];
  if (predicate === 'officialPresenceAttempted'
    && candidateValues.some((value) => value === false || value === 'no-official-presence-found')) {
    return 'attempted-no-official-presence';
  }
  const agreements = new Set<string>();
  for (const value of candidateValues) {
    const key = comparable(value, predicate);
    if (canonicalValues.some((other) => comparable(other, predicate) === key)) agreements.add(key);
    const corroboratingSources = new Set(corroborating
      .filter((other) => values(other, predicate).some((otherValue) => comparable(otherValue, predicate) === key))
      .map((other) => other.candidate.sourceId));
    if (corroboratingSources.size > 0) agreements.add(key);
  }
  if (agreements.size > 0) return 'confirmed';
  if (candidateValues.length > 0 && canonicalValues.length > 0) return 'conflicted';
  if (candidateValues.length > 0) return 'candidate-only';
  if (canonicalValues.length > 0) return 'canonical-only';
  return 'missing';
}

export function assessEnrichment(
  candidate: CandidateEvidence,
  decision: TrustLoopDecision,
  canonical: CandidateEvidence | undefined,
  corroborating: CandidateEvidence[],
): TrustLoopEnrichmentAssessment {
  const eligible = candidate.candidate.candidateType === 'artist';
  const fields: Record<string, TrustLoopEnrichmentAssessment['fields'][string]> = {};
  if (eligible) {
    for (const predicate of ENRICHMENT_PREDICATES) {
      fields[predicate] = fieldState(candidate, canonical, corroborating, predicate);
    }
  }
  const confirmedOfficialLinks = OFFICIAL_LINK_PREDICATES.filter((predicate) => fields[predicate] === 'confirmed');
  const wrongLinkIncidents = OFFICIAL_LINK_PREDICATES.filter((predicate) => fields[predicate] === 'conflicted').length;
  return {
    candidateKey: candidate.candidate.candidateKey,
    canonicalEntityId: decision.canonicalEntityId,
    eligible,
    fields,
    confirmedOfficialLinks,
    wrongLinkIncidents,
    evidenceClaimIds: limitedClaimIds([
      ...candidate.claims.map((claim) => claim.id),
      ...(canonical?.claims.map((claim) => claim.id) ?? []),
    ], DECISION_CLAIM_LIMIT),
  };
}
