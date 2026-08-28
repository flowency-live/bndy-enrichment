import type { ClaimPredicate } from '../knowledge/types.js';
import type { TrustLoopReviewCase } from '../trust-loop/types.js';
import type { CanonicalEntitySnapshot } from './types.js';

const ARTIST_PREDICATES = [
  'hasArtistType',
  'hasActType',
  'isAcoustic',
  'hasGenre',
  'hasFacebookUrl',
  'hasWebsiteUrl',
  'hasInstagramUrl',
  'hasBandcampUrl',
  'hasSpotifyUrl',
  'hasOfficialUrl',
  'officialPresenceAttempted',
] as const satisfies ClaimPredicate[];

const VENUE_PREDICATES = [
  'hasAddress',
  'hasLocation',
  'hasGooglePlaceId',
  'hasFacebookUrl',
  'hasWebsiteUrl',
  'hasInstagramUrl',
  'hasOfficialUrl',
  'officialPresenceAttempted',
] as const satisfies ClaimPredicate[];

function caseName(item: TrustLoopReviewCase): string | undefined {
  return item.displayName ?? (item.candidateType === 'artist' ? item.artistName : item.venueName);
}

function ambiguityScore(item: TrustLoopReviewCase): number {
  const name = caseName(item)?.trim().toLowerCase() ?? '';
  const words = name.split(/\s+/).filter(Boolean);
  let score = words.length === 1 ? 5 : words.length === 2 ? 3 : 0;
  if (/^(the\s+)?(band|collective|reform|committee|manic|alibi|junction|exchange)$/i.test(name)) score += 3;
  if (/\b(pub|bar|club|hall|hotel|lounge|tavern|arms|inn|social|house)\b/i.test(name)) score += 2;
  if (!item.artistName && !item.venueName && !item.date) score += 1;
  return score;
}

function selectType(
  reviewCases: TrustLoopReviewCase[],
  candidateType: 'artist' | 'venue',
  limit: number,
): TrustLoopReviewCase[] {
  const unique = new Map<string, TrustLoopReviewCase>();
  for (const item of reviewCases) {
    if (item.candidateType !== candidateType) continue;
    const name = caseName(item);
    if (!name) continue;
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!unique.has(key)) unique.set(key, item);
  }
  const ranked = [...unique.values()].sort((left, right) =>
    ambiguityScore(right) - ambiguityScore(left)
    || left.sourceId.localeCompare(right.sourceId)
    || left.candidateKey.localeCompare(right.candidateKey));
  const selected: TrustLoopReviewCase[] = [];
  const selectedKeys = new Set<string>();
  const seenSources = new Set<string>();
  for (const item of ranked) {
    if (seenSources.has(item.sourceId)) continue;
    selected.push(item);
    selectedKeys.add(item.candidateKey);
    seenSources.add(item.sourceId);
    if (selected.length === limit) return selected;
  }
  for (const item of ranked) {
    if (selectedKeys.has(item.candidateKey)) continue;
    selected.push(item);
    if (selected.length === limit) break;
  }
  return selected;
}

export function selectEnrichmentQualificationCases(
  reviewCases: TrustLoopReviewCase[],
  perType = 10,
): TrustLoopReviewCase[] {
  return [
    ...selectType(reviewCases, 'artist', perType),
    ...selectType(reviewCases, 'venue', perType),
  ];
}

export function qualificationPredicates(candidateType: 'artist' | 'venue'): ClaimPredicate[] {
  return [...(candidateType === 'artist' ? ARTIST_PREDICATES : VENUE_PREDICATES)];
}

export function qualificationEntity(item: TrustLoopReviewCase): CanonicalEntitySnapshot {
  if (item.candidateType !== 'artist' && item.candidateType !== 'venue') {
    throw new Error(`Unsupported qualification entity type: ${item.candidateType}`);
  }
  const displayName = caseName(item);
  if (!displayName) throw new Error(`Qualification case has no display name: ${item.candidateKey}`);
  return {
    entityType: item.candidateType,
    entityId: `${item.sourceId}:${item.candidateKey}`,
    displayName,
    currentValues: {
      sourceId: item.sourceId,
      sourceCandidateKey: item.candidateKey,
      ...(item.artistName ? { gigArtistName: item.artistName } : {}),
      ...(item.venueName ? { gigVenueName: item.venueName } : {}),
      ...(item.date ? { gigDate: item.date } : {}),
    },
    ownerManagedPredicates: [],
    attachedToUpcomingGig: true,
  };
}
