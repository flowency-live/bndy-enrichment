import crypto from 'node:crypto';
import type { BrassBandIdentityCandidate } from './types.js';
import type { ResolvedBrassBand } from './resolve-band.js';

export interface BrassActProjection {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  actKind: 'production';
  productionKind: 'standard_concert' | 'themed_concert' | 'live_cinema' | 'collaboration' | 'other';
  imageUrl: string | null;
  websiteUrl: string | null;
  publicationScopes: ['brass'];
}

export interface BrassBandProjectionPackage {
  projectionVersion: 2;
  entityType: 'artist';
  edition: 'brass';
  proposedId: string;
  record: {
    name: string;
    artist_type: 'band';
    performerKind: 'brass_band';
    publicationScopes: ['brass'];
    discoveryScopes: ['brass'];
    location?: string;
    websiteUrl?: string;
    name_variants: string[];
    names: Array<{
      name: string;
      nameType: 'current_official' | 'former_official' | 'common' | 'sponsored' | 'alternate';
      sourceUrls: string[];
      confidence: number;
    }>;
    acts: BrassActProjection[];
    domainProfiles: {
      brass: {
        organisationType: 'brass_band';
        town?: string;
        county?: string;
        country?: string;
        officialWebsiteUrl?: string;
        sourceRefs: string[];
      };
    };
    source: 'bndy-brass-intelligence';
    ai_created: true;
    needs_review: boolean;
  };
  provenance: {
    identityConfidence: number;
    sourceUrls: string[];
    observationSourceIds: string[];
    generatedAt: string;
  };
  publishable: boolean;
  holdReasons: string[];
}

export interface ProductionInput {
  name: string;
  description?: string;
  isDefault?: boolean;
  productionKind?: BrassActProjection['productionKind'];
  imageUrl?: string | null;
  websiteUrl?: string | null;
}

function proposedId(name: string): string {
  return `brass_${crypto.createHash('sha1').update(name.toLowerCase()).digest('hex').slice(0, 20)}`;
}

function actId(bandName: string, productionName: string): string {
  return `act_${crypto.createHash('sha1').update(`${bandName}\n${productionName}`).digest('hex').slice(0, 16)}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function buildBrassBandProjection(
  candidate: BrassBandIdentityCandidate,
  resolved: ResolvedBrassBand,
  productions: ProductionInput[] = [],
): BrassBandProjectionPackage {
  const sourceUrls = [...new Set([
    ...resolved.evidenceUrls,
    ...candidate.observations.map((observation) => observation.sourceUrl),
    ...(resolved.officialWebsite ? [resolved.officialWebsite] : []),
    ...resolved.aliases.flatMap((alias) => alias.evidenceUrls),
  ])];

  const aliases = resolved.aliases.filter((alias) => alias.name.toLowerCase() !== resolved.officialName.toLowerCase());
  const names: BrassBandProjectionPackage['record']['names'] = [
    {
      name: resolved.officialName,
      nameType: 'current_official',
      sourceUrls: resolved.officialWebsite ? [resolved.officialWebsite, ...resolved.evidenceUrls] : resolved.evidenceUrls,
      confidence: resolved.identityConfidence,
    },
    ...aliases.map((alias) => ({
      name: alias.name,
      nameType: alias.type,
      sourceUrls: alias.evidenceUrls,
      confidence: alias.confidence,
    })),
  ];

  const nameVariants = unique([
    ...candidate.observations.map((observation) => observation.observedName),
    ...candidate.aliases,
    ...aliases.map((alias) => alias.name),
  ]).filter((name) => name.toLowerCase() !== resolved.officialName.toLowerCase());

  const holdReasons: string[] = [];
  if (resolved.identityConfidence < 0.9) holdReasons.push('identity_confidence_below_0.90');
  if (!resolved.officialWebsite) holdReasons.push('official_website_not_resolved');
  if (!resolved.town) holdReasons.push('band_location_not_resolved');
  if (sourceUrls.length < 2) holdReasons.push('insufficient_identity_evidence');

  const location = [resolved.town, resolved.county].filter(Boolean).join(', ') || undefined;
  const acts: BrassActProjection[] = productions.map((production, index) => ({
    id: actId(resolved.officialName, production.name),
    name: production.name.trim(),
    description: production.description?.trim() || null,
    isDefault: production.isDefault ?? (productions.length === 1 && index === 0),
    actKind: 'production',
    productionKind: production.productionKind ?? 'other',
    imageUrl: production.imageUrl ?? null,
    websiteUrl: production.websiteUrl ?? null,
    publicationScopes: ['brass'],
  }));

  return {
    projectionVersion: 2,
    entityType: 'artist',
    edition: 'brass',
    proposedId: proposedId(resolved.officialName),
    record: {
      name: resolved.officialName,
      artist_type: 'band',
      performerKind: 'brass_band',
      publicationScopes: ['brass'],
      discoveryScopes: ['brass'],
      location,
      websiteUrl: resolved.officialWebsite,
      name_variants: nameVariants,
      names,
      acts,
      domainProfiles: {
        brass: {
          organisationType: 'brass_band',
          town: resolved.town,
          county: resolved.county,
          country: resolved.country,
          officialWebsiteUrl: resolved.officialWebsite,
          sourceRefs: sourceUrls,
        },
      },
      source: 'bndy-brass-intelligence',
      ai_created: true,
      needs_review: holdReasons.length > 0,
    },
    provenance: {
      identityConfidence: resolved.identityConfidence,
      sourceUrls,
      observationSourceIds: [...new Set(candidate.observations.map((observation) => observation.sourceId))],
      generatedAt: new Date().toISOString(),
    },
    publishable: holdReasons.length === 0,
    holdReasons,
  };
}
