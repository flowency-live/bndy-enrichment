import { createHash } from 'node:crypto';
import type { ClaimPredicate, ClaimSubjectType, KnowledgeClaim } from '../knowledge/types.js';

export type BaselineEntityType = 'artist' | 'venue' | 'event' | 'festival';

export type BaselineProvenance = {
  classification: 'recoverable-source-label' | 'bndy-legacy-canonical';
  sourceLabel?: string;
};

export type CanonicalBaselineInput = {
  snapshotId: string;
  snapshotAt: string;
  sourceId: string;
  entityType: BaselineEntityType;
  canonicalId: string;
  observationId: string;
  record: Record<string, unknown>;
  contentHash: string;
};

type FlatField = { path: string; value: unknown };
type SemanticClaim = { predicate: ClaimPredicate; value: unknown };

function sortForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForStableJson);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = sortForStableJson((value as Record<string, unknown>)[key]);
  }
  return out;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortForStableJson(value));
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function flatten(value: unknown, path: string, out: FlatField[]): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push({ path, value: [] });
      return;
    }
    value.forEach((item, index) => flatten(item, `${path}[${index}]`, out));
    return;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      out.push({ path, value: {} });
      return;
    }
    for (const [key, child] of entries) flatten(child, path ? `${path}.${key}` : key, out);
    return;
  }
  out.push({ path, value });
}

export function flattenCanonicalRecord(record: Record<string, unknown>): FlatField[] {
  const out: FlatField[] = [];
  for (const [key, value] of Object.entries(record)) flatten(value, key, out);
  return out;
}

export function provenanceForRecord(record: Record<string, unknown>): BaselineProvenance {
  const source = typeof record.source === 'string' && record.source.trim() ? record.source.trim() : undefined;
  return source
    ? { classification: 'recoverable-source-label', sourceLabel: source }
    : { classification: 'bndy-legacy-canonical' };
}

function semanticClaim(entityType: BaselineEntityType, path: string, value: unknown): SemanticClaim | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const stringValue = String(value).trim();
  if (!stringValue) return null;
  const cleanPath = path.replace(/\[\d+\]/g, '');

  if (cleanPath === 'name') {
    return entityType === 'event'
      ? { predicate: 'hasTitle', value: stringValue }
      : { predicate: 'hasName', value: stringValue };
  }
  if (cleanPath === 'title') return { predicate: 'hasTitle', value: stringValue };
  if (/^(facebookUrl|facebook_url)$/i.test(cleanPath)) return { predicate: 'hasFacebookUrl', value: stringValue };
  if (/^(websiteUrl|website_url)$/i.test(cleanPath)) return { predicate: 'hasWebsiteUrl', value: stringValue };
  if (/^(instagramUrl|instagram_url)$/i.test(cleanPath)) return { predicate: 'hasInstagramUrl', value: stringValue };
  if (/^(location|basedIn|based_in)$/i.test(cleanPath)) return { predicate: 'hasLocation', value: stringValue };
  if (/^(artistType|artist_type)$/i.test(cleanPath)) return { predicate: 'hasArtistType', value: stringValue };
  if (/^(actType|actTypes)$/i.test(cleanPath)) return { predicate: 'hasActType', value: stringValue };
  if (/^(genre|genres)$/i.test(cleanPath)) return { predicate: 'hasGenre', value: stringValue };
  if (/^bio$/i.test(cleanPath)) return { predicate: 'hasBio', value: stringValue };
  if (/^address$/i.test(cleanPath)) return { predicate: 'hasAddress', value: stringValue };
  if (/^(googlePlaceId|placeId|google_place_id)$/i.test(cleanPath)) return { predicate: 'hasGooglePlaceId', value: stringValue };
  if (entityType === 'event' && /^artistId$/i.test(cleanPath)) {
    return { predicate: 'hasPerformer', value: { canonicalEntityId: stringValue } };
  }
  if (entityType === 'event' && /^artistName$/i.test(cleanPath)) return { predicate: 'hasPerformerName', value: stringValue };
  if (entityType === 'event' && /^venueId$/i.test(cleanPath)) {
    return { predicate: 'occursAt', value: { canonicalEntityId: stringValue } };
  }
  if (entityType === 'event' && /^venueName$/i.test(cleanPath)) return { predicate: 'hasVenueName', value: stringValue };
  if (entityType === 'event' && /^date$/i.test(cleanPath)) return { predicate: 'occursOn', value: stringValue };
  if (entityType === 'event' && /^startTime$/i.test(cleanPath)) return { predicate: 'startsAt', value: stringValue };
  if (entityType === 'event' && /^endTime$/i.test(cleanPath)) return { predicate: 'endsAt', value: stringValue };
  if (/^ticketUrl$/i.test(cleanPath)) return { predicate: 'hasTicketUrl', value: stringValue };
  if (/^eventUrl$/i.test(cleanPath)) return { predicate: 'hasEventUrl', value: stringValue };
  if (/^status$/i.test(cleanPath)) return { predicate: 'hasStatus', value: stringValue };
  if (/^price$/i.test(cleanPath)) return { predicate: 'hasPrice', value: stringValue };
  return null;
}

function claimId(parts: unknown[]): string {
  return `claim_${sha256(stableJson(parts)).slice(0, 40)}`;
}

export function buildCanonicalBaselineClaims(input: CanonicalBaselineInput): KnowledgeClaim[] {
  const subject = { type: input.entityType as ClaimSubjectType, key: input.canonicalId };
  const provenance = provenanceForRecord(input.record);
  const evidence = { rawItemId: input.canonicalId, contentHash: input.contentHash };
  const claims: KnowledgeClaim[] = [];

  for (const field of flattenCanonicalRecord(input.record)) {
    claims.push({
      id: claimId([input.snapshotId, input.entityType, input.canonicalId, 'derivedFrom', field.path]),
      observationId: input.observationId,
      sourceId: input.sourceId,
      subject,
      predicate: 'derivedFrom',
      value: { field: field.path, value: field.value, provenance },
      confidence: 1,
      evidence,
      observedAt: input.snapshotAt,
      assertedAt: input.snapshotAt,
      status: 'active',
    });

    const semantic = semanticClaim(input.entityType, field.path, field.value);
    if (semantic) {
      claims.push({
        id: claimId([input.snapshotId, input.entityType, input.canonicalId, semantic.predicate, field.path]),
        observationId: input.observationId,
        sourceId: input.sourceId,
        subject,
        predicate: semantic.predicate,
        value: semantic.value,
        confidence: 1,
        evidence,
        observedAt: input.snapshotAt,
        assertedAt: input.snapshotAt,
        status: 'active',
      });
    }
  }

  claims.push({
    id: claimId([input.snapshotId, input.entityType, input.canonicalId, 'resolvesTo']),
    observationId: input.observationId,
    sourceId: input.sourceId,
    subject,
    predicate: 'resolvesTo',
    value: {
      entityType: input.entityType,
      canonicalEntityId: input.canonicalId,
      method: 'canonical-self-baseline',
      snapshotId: input.snapshotId,
    },
    confidence: 1,
    evidence,
    observedAt: input.snapshotAt,
    assertedAt: input.snapshotAt,
    status: 'active',
  });

  return claims;
}
