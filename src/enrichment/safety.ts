import type { DiscoveryBudget } from '../knowledge/types.js';
import { assertSafeUrl } from '../sources/runner/acquisition.js';
import type { CanonicalEntitySnapshot, EnrichmentEvidenceBundle, EnrichmentEvidenceFact } from './types.js';

export const SAFE_ENRICHMENT_BUDGET: DiscoveryBudget = {
  maxDepth: 1,
  maxEntities: 1,
  maxSearches: 3,
  maxFetches: 6,
  maxModelCalls: 1,
  maxInputTokens: 12_000,
  maxOutputTokens: 2_000,
  maxEstimatedCost: 0.03,
  allowExpensiveModel: false,
  deadlineMs: 60_000,
};

export const SAFE_ENRICHMENT_PREDICATES = new Set([
  'hasNameVariant', 'hasFacebookUrl', 'hasWebsiteUrl', 'hasInstagramUrl',
  'hasLocation', 'hasArtistType', 'hasActType', 'hasGenre', 'hasBio',
  'hasAddress', 'hasGooglePlaceId', 'locatedIn',
]);

function bounded(requested: number, ceiling: number): number {
  return Math.min(Math.max(0, requested), ceiling);
}

export function capEnrichmentBudget(requested?: DiscoveryBudget): DiscoveryBudget {
  if (!requested) return { ...SAFE_ENRICHMENT_BUDGET };
  return {
    maxDepth: bounded(requested.maxDepth, SAFE_ENRICHMENT_BUDGET.maxDepth),
    maxEntities: Math.max(1, bounded(requested.maxEntities, SAFE_ENRICHMENT_BUDGET.maxEntities)),
    maxSearches: bounded(requested.maxSearches, SAFE_ENRICHMENT_BUDGET.maxSearches),
    maxFetches: bounded(requested.maxFetches, SAFE_ENRICHMENT_BUDGET.maxFetches),
    maxModelCalls: bounded(requested.maxModelCalls, SAFE_ENRICHMENT_BUDGET.maxModelCalls),
    maxInputTokens: bounded(requested.maxInputTokens, SAFE_ENRICHMENT_BUDGET.maxInputTokens),
    maxOutputTokens: bounded(requested.maxOutputTokens, SAFE_ENRICHMENT_BUDGET.maxOutputTokens),
    maxEstimatedCost: bounded(requested.maxEstimatedCost, SAFE_ENRICHMENT_BUDGET.maxEstimatedCost),
    allowExpensiveModel: false,
    deadlineMs: Math.max(1, bounded(requested.deadlineMs, SAFE_ENRICHMENT_BUDGET.deadlineMs)),
  };
}

function normalised(value: unknown): string {
  return JSON.stringify(value, Object.keys(value && typeof value === 'object' && !Array.isArray(value) ? value as object : {}).sort());
}

function evidenceHosts(fact: EnrichmentEvidenceFact): Set<string> {
  const hosts = new Set<string>();
  for (const value of fact.evidenceUrls) {
    try {
      const url = assertSafeUrl(value);
      if (url.protocol !== 'https:') continue;
      hosts.add(url.hostname.toLowerCase().replace(/^www\./, ''));
    } catch {
      // Unsafe citations remain in raw evidence but cannot support a Claim.
    }
  }
  return hosts;
}

function emptyValue(value: unknown): boolean {
  return value === null
    || value === undefined
    || (typeof value === 'string' && value.trim().length === 0)
    || (Array.isArray(value) && value.length === 0);
}

function invalidUrlValue(fact: EnrichmentEvidenceFact): boolean {
  if (!['hasWebsiteUrl', 'hasFacebookUrl', 'hasInstagramUrl'].includes(fact.predicate)) return false;
  if (typeof fact.value !== 'string') return true;
  try {
    return assertSafeUrl(fact.value).protocol !== 'https:';
  } catch {
    return true;
  }
}

export type AssessedEnrichmentFact = {
  fact: EnrichmentEvidenceFact;
  writeClaim: boolean;
  protected: boolean;
  conflict: boolean;
  review: boolean;
  reason?: string;
};

export function assessEnrichmentFacts(
  entity: CanonicalEntitySnapshot,
  bundle: EnrichmentEvidenceBundle,
): AssessedEnrichmentFact[] {
  const identitySafe = bundle.identityConfidence >= 0.98;
  return bundle.facts.map((fact) => {
    const hosts = evidenceHosts(fact);
    const current = entity.currentValues[fact.predicate];
    const conflict = current !== undefined && normalised(current) !== normalised(fact.value);
    const protectedFact = entity.ownerManagedPredicates.includes(fact.predicate);
    const unsafePredicate = !SAFE_ENRICHMENT_PREDICATES.has(fact.predicate);
    const invalidValue = emptyValue(fact.value)
      || invalidUrlValue(fact)
      || (fact.predicate === 'hasBio' && (typeof fact.value !== 'string' || fact.value.length > 4_000));
    const weak = fact.confidence < 0.8 || hosts.size === 0 || invalidValue;
    const materialChange = ['hasAddress', 'hasLocation', 'locatedIn', 'hasArtistType'].includes(fact.predicate);
    const materialEvidenceWeak = materialChange && conflict && (fact.confidence < 0.995 || hosts.size < 2);
    const writeClaim = identitySafe && !unsafePredicate && !weak;
    const review = writeClaim && (protectedFact || conflict || materialEvidenceWeak || fact.confidence < 0.98);
    let reason: string | undefined;
    if (!identitySafe) reason = 'identity-confidence-below-0.98';
    else if (unsafePredicate) reason = 'predicate-not-allow-listed';
    else if (invalidValue) reason = 'invalid-or-empty-value';
    else if (hosts.size === 0) reason = 'no-safe-https-evidence';
    else if (fact.confidence < 0.8) reason = 'fact-confidence-below-0.8';
    else if (protectedFact) reason = 'owner-managed-field';
    else if (materialEvidenceWeak) reason = 'material-conflict-needs-two-source-review';
    else if (conflict) reason = 'conflicts-with-canonical';
    else if (fact.confidence < 0.98) reason = 'confidence-needs-review';
    return { fact, writeClaim, protected: protectedFact, conflict, review, reason };
  });
}
