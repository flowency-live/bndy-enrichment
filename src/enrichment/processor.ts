import { createHash } from 'node:crypto';
import {
  EntityEnrichmentWorkItemSchema,
  KnowledgeClaimSchema,
  SourceObservationSchema,
  type DiscoveryBudget,
  type EntityEnrichmentWorkItem,
  type KnowledgeClaim,
  type SourceObservation,
} from '../knowledge/types.js';
import { assessEnrichmentFacts, capEnrichmentBudget } from './safety.js';
import {
  CanonicalEntitySnapshotSchema,
  EnrichmentEvidenceBundleSchema,
  EnrichmentOutcomeSchema,
  type CanonicalEntitySnapshot,
  type EnrichmentControlStart,
  type EnrichmentEvidenceBundle,
  type EnrichmentOutcome,
} from './types.js';

export interface CanonicalEntityReader {
  get(entityType: 'artist' | 'venue', entityId: string): Promise<CanonicalEntitySnapshot | null>;
}

export interface EntityEnrichmentProvider {
  readonly id: string;
  gather(
    entity: CanonicalEntitySnapshot,
    budget: DiscoveryBudget,
    requestedPredicates: EntityEnrichmentWorkItem['requestedPredicates'],
  ): Promise<EnrichmentEvidenceBundle>;
}

export interface EntityEnrichmentControlStore {
  begin(item: EntityEnrichmentWorkItem, providerId: string, budget: DiscoveryBudget): Promise<EnrichmentControlStart>;
  record(outcome: EnrichmentOutcome): Promise<void>;
}

export interface EnrichmentObservationStore {
  put(observation: SourceObservation, payload: string, options: { contentType: string; extension: string }): Promise<SourceObservation>;
}

export interface EnrichmentClaimStore {
  put(claim: KnowledgeClaim): Promise<void>;
  linkCanonicalEntity(entityType: 'artist' | 'venue', entityId: string, claimId: string): Promise<void>;
}

export type EntityEnrichmentDependencies = {
  entities: CanonicalEntityReader;
  provider: EntityEnrichmentProvider;
  controls: EntityEnrichmentControlStore;
  observations: EnrichmentObservationStore;
  claims: EnrichmentClaimStore;
};

function digest(...parts: string[]): string {
  return createHash('sha256').update(parts.join('\u001f')).digest('hex');
}

async function finish(deps: EntityEnrichmentDependencies, outcome: EnrichmentOutcome): Promise<EnrichmentOutcome> {
  const parsed = EnrichmentOutcomeSchema.parse(outcome);
  await deps.controls.record(parsed);
  return parsed;
}

export async function processEntityEnrichment(
  input: EntityEnrichmentWorkItem,
  deps: EntityEnrichmentDependencies,
): Promise<EnrichmentOutcome> {
  const item = EntityEnrichmentWorkItemSchema.parse(input);
  const budget = capEnrichmentBudget(item.budget);
  const start = await deps.controls.begin(item, deps.provider.id, budget);
  if (start === 'complete') {
    return EnrichmentOutcomeSchema.parse({ itemId: item.id, status: 'idempotent', canonicalWrites: 0 });
  }
  if (start === 'budget-exhausted') {
    return finish(deps, { itemId: item.id, status: 'budget-exhausted', reason: 'daily-provider-budget-exhausted', claimsWritten: 0, protectedFacts: 0, conflictingFacts: 0, factsNeedingReview: 0, canonicalWrites: 0 });
  }

  const loaded = await deps.entities.get(item.entityType, item.entityId);
  if (!loaded) {
    return finish(deps, { itemId: item.id, status: 'parked', reason: 'canonical-entity-not-found', claimsWritten: 0, protectedFacts: 0, conflictingFacts: 0, factsNeedingReview: 0, canonicalWrites: 0 });
  }
  const entity = CanonicalEntitySnapshotSchema.parse(loaded);
  if (entity.entityType !== item.entityType || entity.entityId !== item.entityId) {
    throw new Error('Canonical entity reader returned the wrong entity');
  }

  const bundle = EnrichmentEvidenceBundleSchema.parse(
    await deps.provider.gather(entity, budget, item.requestedPredicates),
  );
  if (bundle.providerId !== deps.provider.id) throw new Error('Enrichment provider identity mismatch');
  const sourceId = `entity-enrichment:${bundle.providerId}`;
  const observationId = `obs-enrich-${digest(item.id, bundle.providerId, bundle.providerRunId).slice(0, 32)}`;
  const raw = JSON.stringify(bundle);
  if (Buffer.byteLength(raw, 'utf8') > 1_048_576) throw new Error('Enrichment evidence bundle exceeds 1 MiB');
  const observation = await deps.observations.put(SourceObservationSchema.parse({
    id: observationId,
    sourceId,
    observedAt: bundle.retrievedAt,
    sourceUrl: bundle.facts.flatMap((fact) => fact.evidenceUrls)[0],
    captureHash: digest(raw),
    enumerationMethod: `entity-enrichment:${bundle.providerId}`,
    complete: false,
    captureStable: true,
    itemCount: bundle.facts.length,
    contentType: 'application/json',
  }), raw, { contentType: 'application/json', extension: 'json' });

  const assessed = assessEnrichmentFacts(entity, bundle);
  let claimsWritten = 0;
  for (const decision of assessed.filter((itemDecision) => itemDecision.writeClaim)) {
    const fact = decision.fact;
    const claim = KnowledgeClaimSchema.parse({
      id: `claim-enrich-${digest(observation.id, item.entityType, item.entityId, fact.predicate, JSON.stringify(fact.value)).slice(0, 32)}`,
      observationId: observation.id,
      sourceId,
      subject: { type: item.entityType, key: item.entityId },
      predicate: fact.predicate,
      value: fact.value,
      confidence: fact.confidence,
      evidence: {
        sourceUrl: fact.evidenceUrls[0],
        evidenceKey: observation.evidenceKey,
        text: fact.evidenceText,
      },
      observedAt: bundle.retrievedAt,
      status: 'active',
    });
    await deps.claims.put(claim);
    await deps.claims.linkCanonicalEntity(item.entityType, item.entityId, claim.id);
    claimsWritten += 1;
  }

  const identityParked = bundle.identityConfidence < 0.98;
  return finish(deps, {
    itemId: item.id,
    status: identityParked ? 'parked' : 'completed',
    ...(identityParked ? { reason: 'identity-confidence-below-0.98' } : {}),
    observationId: observation.id,
    claimsWritten,
    protectedFacts: assessed.filter((fact) => fact.protected).length,
    conflictingFacts: assessed.filter((fact) => fact.conflict).length,
    factsNeedingReview: assessed.filter((fact) => fact.review).length,
    canonicalWrites: 0,
  });
}
