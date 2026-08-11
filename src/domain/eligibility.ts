import type { EligibilityDecision, EventCandidate } from './schema.js';

const COMMERCIAL_SUPPRESSION_DAYS = 270;

export function classifyEligibility(events: EventCandidate[]): EligibilityDecision {
  const freeEventsSeen = events.filter(e => e.admission.status === 'FREE_CONFIRMED').length;
  const paidEventsSeen = events.filter(e => e.admission.status === 'PAID_CONFIRMED').length;
  const unknownEventsSeen = events.filter(e => e.admission.status === 'UNKNOWN').length;
  const known = freeEventsSeen + paidEventsSeen;
  const paidRatio = known ? paidEventsSeen / known : 0;
  const freeRatio = known ? freeEventsSeen / known : 0;

  if (paidEventsSeen >= 3 && paidRatio >= 0.8 && freeEventsSeen === 0) {
    return {
      classification: 'COMMERCIAL_TICKETING',
      autoEnrich: false,
      suppressed: true,
      suppressionDays: COMMERCIAL_SUPPRESSION_DAYS,
      freeEventsSeen,
      paidEventsSeen,
      unknownEventsSeen,
      reason: `${paidEventsSeen}/${known} known events are paid and no free grassroots event was found`,
    };
  }

  if (freeEventsSeen >= 2 && freeRatio >= 0.8) {
    return {
      classification: 'GRASSROOTS_FREE',
      autoEnrich: true,
      suppressed: false,
      suppressionDays: 0,
      freeEventsSeen,
      paidEventsSeen,
      unknownEventsSeen,
      reason: `${freeEventsSeen}/${known} known events are confirmed free`,
    };
  }

  if (freeEventsSeen >= 1 && paidEventsSeen === 0) {
    return {
      classification: 'LIKELY_GRASSROOTS',
      autoEnrich: true,
      suppressed: false,
      suppressionDays: 0,
      freeEventsSeen,
      paidEventsSeen,
      unknownEventsSeen,
      reason: 'At least one confirmed free event and no paid event was found',
    };
  }

  if (freeEventsSeen > 0 && paidEventsSeen > 0) {
    return {
      classification: 'MIXED',
      autoEnrich: false,
      suppressed: false,
      suppressionDays: 0,
      freeEventsSeen,
      paidEventsSeen,
      unknownEventsSeen,
      reason: 'Both free and paid events were found; assess free gigs individually',
    };
  }

  return {
    classification: 'UNKNOWN',
    autoEnrich: false,
    suppressed: false,
    suppressionDays: 0,
    freeEventsSeen,
    paidEventsSeen,
    unknownEventsSeen,
    reason: paidEventsSeen > 0
      ? 'Paid evidence exists but the entity-level commercial threshold has not been reached'
      : 'Not enough confirmed free/paid evidence to classify the entity',
  };
}

export function retainFreeEvents(events: EventCandidate[]): {
  retained: EventCandidate[];
  rejected: EventCandidate[];
} {
  return {
    retained: events.filter(e => e.admission.status === 'FREE_CONFIRMED'),
    rejected: events.filter(e => e.admission.status !== 'FREE_CONFIRMED'),
  };
}

export function suppressionUntilIso(decision: EligibilityDecision, now = new Date()): string | undefined {
  if (!decision.suppressed || decision.suppressionDays <= 0) return undefined;
  return new Date(now.getTime() + decision.suppressionDays * 86400000).toISOString();
}
