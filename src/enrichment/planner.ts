import { createHash } from 'node:crypto';
import type { ClaimPredicate, EntityEnrichmentWorkItem } from '../knowledge/types.js';
import { SAFE_ENRICHMENT_BUDGET, SAFE_ENRICHMENT_PREDICATES } from './safety.js';
import {
  EntityEnrichmentCandidateSchema,
  type EntityEnrichmentCandidate,
} from './types.js';

export type DailyEnrichmentPlanOptions = {
  runAt: Date;
  maxArtists?: number;
  maxVenues?: number;
  cooldownDays?: number;
};

export type PlannedEntityEnrichment = {
  candidate: EntityEnrichmentCandidate;
  item: EntityEnrichmentWorkItem;
  score: number;
  actionablePredicates: ClaimPredicate[];
};

export type DailyEnrichmentPlan = {
  runDate: string;
  supplied: number;
  eligible: number;
  selected: PlannedEntityEnrichment[];
  skipped: {
    unresolved: number;
    conflicted: number;
    noActionableGaps: number;
    coolingDown: number;
    overDailyLimit: number;
  };
};

const IMPORTANT_GAPS = new Set<ClaimPredicate>([
  'hasWebsiteUrl',
  'hasFacebookUrl',
  'hasLocation',
  'hasAddress',
  'hasGooglePlaceId',
  'hasArtistType',
]);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function daysBetween(earlier: string, later: Date): number {
  return (later.getTime() - Date.parse(earlier)) / 86_400_000;
}

function actionable(candidate: EntityEnrichmentCandidate): ClaimPredicate[] {
  return unique(candidate.missingPredicates)
    .filter((predicate) => SAFE_ENRICHMENT_PREDICATES.has(predicate));
}

function score(candidate: EntityEnrichmentCandidate, predicates: ClaimPredicate[]): number {
  return (candidate.attachedToUpcomingGig ? 1_000 : 0)
    + Math.min(candidate.upcomingGigCount, 10) * 20
    + (candidate.lastEnrichedAt ? 0 : 150)
    + predicates.length * 25
    + predicates.filter((predicate) => IMPORTANT_GAPS.has(predicate)).length * 20
    + Math.min(candidate.sourceCount, 5) * 3
    + Math.min(candidate.activeConflictCount, 3) * 5;
}

function workItem(
  candidate: EntityEnrichmentCandidate,
  predicates: ClaimPredicate[],
  runAt: Date,
): EntityEnrichmentWorkItem {
  const runDate = runAt.toISOString().slice(0, 10);
  const digest = createHash('sha256')
    .update([runDate, candidate.entityType, candidate.entityId, ...predicates.sort()].join('\u001f'))
    .digest('hex')
    .slice(0, 32);
  return {
    id: `enrich-daily-${digest}`,
    entityType: candidate.entityType,
    entityId: candidate.entityId,
    reason: 'source-discovery',
    requestedPredicates: predicates,
    budget: { ...SAFE_ENRICHMENT_BUDGET },
    createdAt: runAt.toISOString(),
  };
}

export function planDailyEntityEnrichment(
  rawCandidates: EntityEnrichmentCandidate[],
  options: DailyEnrichmentPlanOptions,
): DailyEnrichmentPlan {
  const maxArtists = Math.max(0, options.maxArtists ?? 5);
  const maxVenues = Math.max(0, options.maxVenues ?? 5);
  const cooldownDays = Math.max(1, options.cooldownDays ?? 30);
  const skipped = {
    unresolved: 0,
    conflicted: 0,
    noActionableGaps: 0,
    coolingDown: 0,
    overDailyLimit: 0,
  };

  const candidates: PlannedEntityEnrichment[] = [];
  for (const raw of rawCandidates) {
    const candidate = EntityEnrichmentCandidateSchema.parse(raw);
    if (candidate.identityState === 'unresolved') {
      skipped.unresolved += 1;
      continue;
    }
    if (candidate.identityState === 'conflicted') {
      skipped.conflicted += 1;
      continue;
    }
    const predicates = actionable(candidate);
    if (!predicates.length) {
      skipped.noActionableGaps += 1;
      continue;
    }
    if (candidate.lastAttemptAt && daysBetween(candidate.lastAttemptAt, options.runAt) < cooldownDays) {
      skipped.coolingDown += 1;
      continue;
    }
    candidates.push({
      candidate,
      item: workItem(candidate, predicates, options.runAt),
      score: score(candidate, predicates),
      actionablePredicates: predicates,
    });
  }

  candidates.sort((left, right) => right.score - left.score
    || left.candidate.entityType.localeCompare(right.candidate.entityType)
    || left.candidate.entityId.localeCompare(right.candidate.entityId));

  const selected: PlannedEntityEnrichment[] = [];
  let artists = 0;
  let venues = 0;
  for (const candidate of candidates) {
    if (candidate.candidate.entityType === 'artist') {
      if (artists >= maxArtists) {
        skipped.overDailyLimit += 1;
        continue;
      }
      artists += 1;
    } else {
      if (venues >= maxVenues) {
        skipped.overDailyLimit += 1;
        continue;
      }
      venues += 1;
    }
    selected.push(candidate);
  }

  return {
    runDate: options.runAt.toISOString().slice(0, 10),
    supplied: rawCandidates.length,
    eligible: candidates.length,
    selected,
    skipped,
  };
}
