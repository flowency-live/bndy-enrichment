import { createHash } from 'node:crypto';
import type { KnowledgeClaim } from '../knowledge/types.js';

export type VenueLocationEvidence = {
  location: string;
  method: 'gig-evidence-replay' | 'venue-claim-join';
  supportingClaimId?: string;
  confidence?: number;
};

function objectValue(claim: KnowledgeClaim): Record<string, unknown> | undefined {
  return claim.value && typeof claim.value === 'object' && !Array.isArray(claim.value)
    ? claim.value as Record<string, unknown>
    : undefined;
}

export function occursAtMissingVenueLocation(claim: KnowledgeClaim): boolean {
  if (claim.predicate !== 'occursAt' || claim.status !== 'active') return false;
  const location = objectValue(claim)?.location;
  return typeof location !== 'string' || !location.trim();
}

export function latestActiveStringClaim(
  claims: KnowledgeClaim[],
  predicate: KnowledgeClaim['predicate'],
): KnowledgeClaim | undefined {
  return claims
    .filter((claim) => claim.status === 'active'
      && claim.predicate === predicate
      && typeof claim.value === 'string'
      && claim.value.trim())
    .sort((left, right) => {
      const leftOrder = `${left.observedAt}#${left.assertedAt ?? left.observedAt}#${left.id}`;
      const rightOrder = `${right.observedAt}#${right.assertedAt ?? right.observedAt}#${right.id}`;
      return rightOrder.localeCompare(leftOrder);
    })[0];
}

export function repairOccursAtClaim(
  original: KnowledgeClaim,
  evidence: VenueLocationEvidence,
  assertedAt: string,
): KnowledgeClaim {
  if (!occursAtMissingVenueLocation(original)) {
    throw new Error(`Claim ${original.id} is not an active occursAt Claim missing venueLocation`);
  }
  const value = objectValue(original)!;
  const location = evidence.location.trim();
  if (!location) throw new Error('Repair venueLocation must not be empty');
  const lineage = evidence.supportingClaimId
    ? `; joined venue location Claim ${evidence.supportingClaimId}`
    : '';
  const note = `Backline deterministic repair v1: ${evidence.method}${lineage}`;
  const priorText = original.evidence?.text?.trim();
  const id = `claim-${createHash('sha256')
    .update(['lemonrock-occurs-at-repair-v1', original.id, location, evidence.supportingClaimId ?? ''].join('\u001f'))
    .digest('hex')
    .slice(0, 32)}`;

  return {
    ...original,
    id,
    value: { ...value, location },
    confidence: Math.min(original.confidence, evidence.confidence ?? original.confidence),
    assertedAt,
    evidence: {
      ...original.evidence,
      text: priorText ? `${priorText}\n${note}` : note,
    },
  };
}
