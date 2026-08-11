import type {
  CommercialEntitySignal,
  EligibilityDecision,
  EventCandidate,
  SearchEntity,
} from './schema.js';

const COMMERCIAL_SUPPRESSION_DAYS = 270;

export function classifyEligibility(events: EventCandidate[], entityType: SearchEntity['type'] = 'artist'): EligibilityDecision {
  const freeEventsSeen = events.filter(e => e.admission.status === 'FREE_CONFIRMED').length;
  const paidEventsSeen = events.filter(e => e.admission.status === 'PAID_CONFIRMED').length;
  const unknownEventsSeen = events.filter(e => e.admission.status === 'UNKNOWN').length;
  const known = freeEventsSeen + paidEventsSeen;
  const paidRatio = known ? paidEventsSeen / known : 0;
  const freeRatio = known ? freeEventsSeen / known : 0;

  // Venues are cheaper to classify: two confirmed paid gigs and no free evidence is enough
  // to treat the venue as ticketed/commercial and stop scheduled discovery/enrichment.
  if (entityType === 'venue' && paidEventsSeen >= 2 && freeEventsSeen === 0) {
    return {
      classification: 'COMMERCIAL_TICKETING',
      autoEnrich: false,
      suppressed: true,
      suppressionDays: COMMERCIAL_SUPPRESSION_DAYS,
      freeEventsSeen,
      paidEventsSeen,
      unknownEventsSeen,
      ticketedVenue: true,
      reason: `${paidEventsSeen} confirmed paid events and no free grassroots event were found at this venue`,
    };
  }

  if (paidEventsSeen >= 3 && paidRatio >= 0.8 && freeEventsSeen === 0) {
    return {
      classification: 'COMMERCIAL_TICKETING',
      autoEnrich: false,
      suppressed: true,
      suppressionDays: COMMERCIAL_SUPPRESSION_DAYS,
      freeEventsSeen,
      paidEventsSeen,
      unknownEventsSeen,
      ticketedVenue: entityType === 'venue',
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
      ticketedVenue: false,
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
      ticketedVenue: false,
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
      ticketedVenue: false,
      reason: 'Both free and paid events were found; publish both, but only free events may drive enrichment/graph expansion',
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
    ticketedVenue: false,
    reason: paidEventsSeen > 0
      ? 'Paid evidence exists but the entity-level commercial threshold has not been reached'
      : 'Not enough confirmed free/paid evidence to classify the entity',
  };
}

export function partitionEvents(events: EventCandidate[]): {
  publishable: EventCandidate[];
  held: EventCandidate[];
  expansionEligible: EventCandidate[];
} {
  const withProcessing = events.map(event => {
    if (event.admission.status === 'FREE_CONFIRMED') {
      return {
        ...event,
        processing: {
          publish: true,
          enrichEntities: true,
          expandGraph: true,
          reason: 'Confirmed free grassroots event',
        },
      };
    }

    if (event.admission.status === 'PAID_CONFIRMED') {
      return {
        ...event,
        processing: {
          publish: true,
          enrichEntities: false,
          expandGraph: false,
          reason: 'Paid event is useful bndy data but must not trigger subsidised enrichment or graph expansion',
        },
      };
    }

    return {
      ...event,
      processing: {
        publish: false,
        enrichEntities: false,
        expandGraph: false,
        reason: 'Admission unresolved; hold until FREE or PAID can be established',
      },
    };
  });

  return {
    publishable: withProcessing.filter(e => e.processing.publish),
    held: withProcessing.filter(e => !e.processing.publish),
    expansionEligible: withProcessing.filter(e => e.processing.expandGraph),
  };
}

export function commercialEntitySignals(events: EventCandidate[]): CommercialEntitySignal[] {
  const paid = events.filter(event => event.admission.status === 'PAID_CONFIRMED');
  const byKey = new Map<string, CommercialEntitySignal>();

  for (const event of paid) {
    const venueKey = `venue:${event.venueName.trim().toLowerCase()}:${(event.town ?? '').trim().toLowerCase()}`;
    const existingVenue = byKey.get(venueKey);
    const venueEvidence = [...new Set([...(existingVenue?.evidenceUrls ?? []), ...event.sourceUrls, ...event.admission.evidenceUrls])];
    byKey.set(venueKey, {
      entityType: 'venue',
      name: event.venueName,
      town: event.town,
      ticketed: true,
      autoEnrich: false,
      scanEligible: false,
      evidenceUrls: venueEvidence,
      reason: 'Encountered through a confirmed paid event; retain/create and mark ticketed, but do not enrich or expand from it',
    });
  }

  return [...byKey.values()];
}

export function suppressionUntilIso(decision: EligibilityDecision, now = new Date()): string | undefined {
  if (!decision.suppressed || decision.suppressionDays <= 0) return undefined;
  return new Date(now.getTime() + decision.suppressionDays * 86400000).toISOString();
}
