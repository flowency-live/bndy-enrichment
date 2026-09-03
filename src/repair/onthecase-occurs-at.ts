import { createHash } from 'node:crypto';
import type { KnowledgeClaim } from '../knowledge/types.js';
import { onTheCaseLocationFromAddress } from '../sources/adapters/onthecase/html.js';
import type { VenueLocationEvidence } from './lemonrock-occurs-at.js';
import { occursAtMissingVenueLocation } from './lemonrock-occurs-at.js';

function objectValue(claim: KnowledgeClaim): Record<string, unknown> | undefined {
  return claim.value && typeof claim.value === 'object' && !Array.isArray(claim.value)
    ? claim.value as Record<string, unknown>
    : undefined;
}

export function repairOnTheCaseOccursAtClaim(
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
    ? `; derived from venue address Claim ${evidence.supportingClaimId}`
    : '';
  const note = `Backline deterministic OnTheCase repair v1: ${evidence.method}${lineage}`;
  const priorText = original.evidence?.text?.trim();
  const id = `claim-${createHash('sha256')
    .update(['onthecase-occurs-at-repair-v1', original.id, location, evidence.supportingClaimId ?? ''].join('\u001f'))
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
