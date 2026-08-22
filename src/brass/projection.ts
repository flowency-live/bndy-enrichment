import crypto from 'node:crypto';
import type { BrassBandIdentityCandidate } from './types';
import type { ResolvedBrassBand } from './resolve-band';

export interface BrassBandProjectionPackage {
  projectionVersion: 1;
  entityType: 'artist';
  edition: 'brass';
  proposedId: string;
  record: {
    name: string;
    artist_type: 'band';
    performerKind: 'brass_band';
    publicationScopes: ['brass'];
    discoveryScopes?: never;
    location?: string;
    names: Array<{
      name: string;
      nameType: 'current_official' | 'former_official' | 'common' | 'sponsored' | 'alternate';
      sourceUrls: string[];
      confidence: number;
    }>;
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

function proposedId(name: string): string {
  return `brass_${crypto.createHash('sha1').update(name.toLowerCase()).digest('hex').slice(0, 20)}`;
}

export function buildBrassBandProjection(candidate: BrassBandIdentityCandidate, resolved: ResolvedBrassBand): BrassBandProjectionPackage {
  const sourceUrls = [...new Set([...resolved.evidenceUrls, ...candidate.observations.map((observation) => observation.sourceUrl)])];
  const aliases = resolved.aliases.filter((alias) => alias.name.toLowerCase() !== resolved.officialName.toLowerCase());
  const names: BrassBandProjectionPackage['record']['names'] = [
    {
      name: resolved.officialName,
      nameType: 'current_official',
      sourceUrls: resolved.evidenceUrls,
      confidence: resolved.identityConfidence,
    },
    ...aliases.map((alias) => ({
      name: alias.name,
      nameType: alias.type,
      sourceUrls: alias.evidenceUrls,
      confidence: alias.confidence,
    })),
  ];

  const holdReasons: string[] = [];
  if (resolved.identityConfidence < 0.85) holdReasons.push('identity_confidence_below_0.85');
  if (!resolved.officialWebsite) holdReasons.push('official_website_not_resolved');
  if (!resolved.town) holdReasons.push('band_location_not_resolved');
  if (!resolved.evidenceUrls.length) holdReasons.push('no_identity_evidence_urls');

  const location = [resolved.town, resolved.county].filter(Boolean).join(', ') || undefined;
  return {
    projectionVersion: 1,
    entityType: 'artist',
    edition: 'brass',
    proposedId: proposedId(resolved.officialName),
    record: {
      name: resolved.officialName,
      artist_type: 'band',
      performerKind: 'brass_band',
      publicationScopes: ['brass'],
      location,
      names,
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
