/**
 * Hybrid discovery pipeline: SerpAPI + Claude Haiku.
 *
 * Cost breakdown (per artist):
 * - SerpAPI: 2 searches × $0.005 = $0.01
 * - Haiku: ~2 calls × $0.00025 = $0.0005
 * - Total: ~$0.01-0.015 per artist (~£0.008-0.012)
 *
 * Compare to Gemini with search grounding: ~£0.51 per artist
 */

import type { SearchEntity, DiscoveryResult, EntityEnrichment, FacebookSearch, ArtistProfile } from '../domain/schema.js';
import { searchForArtist, type SerpApiOptions, type OrganicResult } from '../serpapi/client.js';
import { validateFacebookMatch, extractEnrichment, type ScorerOptions } from './scorer.js';
import { GenreSchema, ArtistTypeSchema, ActTypeSchema } from '../domain/schema.js';

export interface HybridDiscoveryOptions {
  serpApiKey: string;
  anthropicApiKey: string;
  haikuModel?: string;
}

export interface HybridDiscoveryResult {
  entity: SearchEntity;
  retrievedAt: string;
  identityConfidence: number;
  facebook: FacebookSearch;
  officialWebsite?: string;
  bio?: string;
  genres: string[];
  artistType?: string;
  actTypes: string[];
  evidenceUrls: string[];
  metrics: {
    latencyMs: number;
    serpApiSearches: number;
    haikuCalls: number;
    estimatedCostUsd: number;
  };
}

function normalizeGenres(genres: string[] | undefined): string[] {
  if (!genres?.length) return [];
  const validGenres = GenreSchema.options;
  return genres
    .map(g => {
      // Try exact match first
      const exact = validGenres.find(v => v.toLowerCase() === g.toLowerCase());
      if (exact) return exact;
      // Try partial match
      const partial = validGenres.find(v =>
        v.toLowerCase().includes(g.toLowerCase()) ||
        g.toLowerCase().includes(v.toLowerCase())
      );
      return partial ?? null;
    })
    .filter((g): g is string => g !== null);
}

function normalizeArtistType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const validTypes = ArtistTypeSchema.options;
  const match = validTypes.find(v => v.toLowerCase() === type.toLowerCase());
  return match;
}

function normalizeActTypes(types: string[] | undefined): string[] {
  if (!types?.length) return [];
  const validTypes = ActTypeSchema.options;
  return types
    .map(t => validTypes.find(v => v.toLowerCase() === t.toLowerCase()))
    .filter((t): t is string => t !== undefined);
}

export async function discoverWithHybrid(
  entity: SearchEntity,
  options: HybridDiscoveryOptions
): Promise<HybridDiscoveryResult> {
  const startTime = Date.now();
  let serpApiSearches = 0;
  let haikuCalls = 0;

  const serpOptions: SerpApiOptions = { apiKey: options.serpApiKey };
  const scorerOptions: ScorerOptions = {
    apiKey: options.anthropicApiKey,
    model: options.haikuModel,
  };

  // Step 1: Search for artist
  const searchResults = await searchForArtist(entity.name, entity.town, serpOptions);
  serpApiSearches = 2; // FB search + general search

  const evidenceUrls: string[] = [];
  let facebook: FacebookSearch = {
    searched: true,
    status: 'not_found',
    confidence: 0,
    evidenceUrls: [],
  };
  let officialWebsite: string | undefined;
  let bio: string | undefined;
  let genres: string[] = [];
  let artistType: string | undefined;
  let actTypes: string[] = [];
  let identityConfidence = 0;

  // Step 2: Validate Facebook candidates
  if (searchResults.facebookUrls.length > 0) {
    const topCandidate = searchResults.facebookUrls[0];

    const validation = await validateFacebookMatch(
      entity.name,
      entity.town,
      topCandidate,
      searchResults.allResults,
      scorerOptions
    );
    haikuCalls++;

    if (validation.isMatch && validation.confidence >= 0.6) {
      facebook = {
        searched: true,
        status: 'matched',
        url: topCandidate,
        confidence: validation.confidence,
        evidenceUrls: [topCandidate],
        notes: validation.reason,
      };
      evidenceUrls.push(topCandidate);
      identityConfidence = Math.max(identityConfidence, validation.confidence);

      // Extract any data from validation
      if (validation.extractedBio) bio = validation.extractedBio;
      if (validation.genres) genres = normalizeGenres(validation.genres);
      if (validation.artistType) artistType = normalizeArtistType(validation.artistType);
      if (validation.actTypes) actTypes = normalizeActTypes(validation.actTypes);
    } else if (searchResults.facebookUrls.length > 1) {
      // Try second candidate
      const secondCandidate = searchResults.facebookUrls[1];
      const secondValidation = await validateFacebookMatch(
        entity.name,
        entity.town,
        secondCandidate,
        searchResults.allResults,
        scorerOptions
      );
      haikuCalls++;

      if (secondValidation.isMatch && secondValidation.confidence >= 0.6) {
        facebook = {
          searched: true,
          status: 'matched',
          url: secondCandidate,
          confidence: secondValidation.confidence,
          evidenceUrls: [secondCandidate],
          notes: secondValidation.reason,
        };
        evidenceUrls.push(secondCandidate);
        identityConfidence = Math.max(identityConfidence, secondValidation.confidence);
      } else {
        facebook.status = 'ambiguous';
        facebook.notes = `${searchResults.facebookUrls.length} candidates found, none matched confidently`;
      }
    }
  }

  // Step 3: Set official website if found
  if (searchResults.websiteUrls.length > 0) {
    officialWebsite = searchResults.websiteUrls[0];
    evidenceUrls.push(officialWebsite);
  }

  // Step 4: Extract additional enrichment from search results
  const enrichment = await extractEnrichment(
    entity.name,
    entity.town,
    searchResults.allResults,
    scorerOptions
  );
  haikuCalls++;

  // Merge enrichment data (prefer existing if already set)
  if (!bio && enrichment.bio) bio = enrichment.bio;
  if (genres.length === 0 && enrichment.genres) genres = normalizeGenres(enrichment.genres);
  if (!artistType && enrichment.artistType) artistType = normalizeArtistType(enrichment.artistType);
  if (actTypes.length === 0 && enrichment.actTypes) actTypes = normalizeActTypes(enrichment.actTypes);

  // Update identity confidence from enrichment
  if (enrichment.confidence > identityConfidence) {
    identityConfidence = enrichment.confidence;
  }

  // Add evidence URLs from search results
  for (const result of searchResults.allResults.slice(0, 5)) {
    if (!evidenceUrls.includes(result.link)) {
      evidenceUrls.push(result.link);
    }
  }

  const latencyMs = Date.now() - startTime;

  // Cost calculation:
  // SerpAPI: $0.005 per search
  // Haiku: ~$0.00025 per call (assuming ~500 input + 200 output tokens)
  const estimatedCostUsd = (serpApiSearches * 0.005) + (haikuCalls * 0.00025);

  return {
    entity,
    retrievedAt: new Date().toISOString(),
    identityConfidence,
    facebook,
    officialWebsite,
    bio,
    genres,
    artistType,
    actTypes,
    evidenceUrls,
    metrics: {
      latencyMs,
      serpApiSearches,
      haikuCalls,
      estimatedCostUsd,
    },
  };
}

/**
 * Convert HybridDiscoveryResult to DiscoveryResult format for comparison.
 */
export function toDiscoveryResult(hybrid: HybridDiscoveryResult): DiscoveryResult {
  const artistProfile: ArtistProfile | undefined =
    hybrid.entity.type === 'artist' && (hybrid.genres.length > 0 || hybrid.artistType || hybrid.actTypes.length > 0)
      ? {
          genres: hybrid.genres as any[],
          genreEvidence: [],
          artistType: hybrid.artistType as any,
          artistTypeEvidence: undefined,
          actTypes: hybrid.actTypes as any[],
          actTypeEvidence: [],
          acousticPerformances: undefined,
          acousticEvidence: undefined,
        }
      : undefined;

  const entityEnrichment: EntityEnrichment = {
    entityType: hybrid.entity.type,
    name: hybrid.entity.name,
    town: hybrid.entity.town,
    officialWebsite: hybrid.officialWebsite,
    facebook: hybrid.facebook,
    bio: {
      text: hybrid.bio,
      evidenceUrls: [],
    },
    artistProfile,
    evidenceUrls: hybrid.evidenceUrls,
  };

  return {
    runId: `hybrid-${Date.now()}`,
    entity: hybrid.entity,
    retrievedAt: hybrid.retrievedAt,
    identityConfidence: hybrid.identityConfidence,
    entityEnrichment,
    discoveredEntities: [],
    events: [],
    heldEvents: [],
    expansionEligibleEvents: [],
    commercialEntities: [],
    eligibility: {
      classification: 'UNKNOWN',
      autoEnrich: true,
      suppressed: false,
      suppressionDays: 0,
      freeEventsSeen: 0,
      paidEventsSeen: 0,
      unknownEventsSeen: 0,
      ticketedVenue: false,
      reason: 'Hybrid pipeline - no eligibility processing',
    },
    evidence: hybrid.evidenceUrls.map((url, i) => ({
      id: `ev-${i}`,
      sourceUrl: url,
      sourceDomain: new URL(url).hostname,
      supports: [],
    })),
    metrics: {
      latencyMs: hybrid.metrics.latencyMs,
      searchQueries: hybrid.metrics.serpApiSearches,
      followUpSearches: 0,
      admissionFollowUps: 0,
      richEnrichmentFollowUps: 0,
    },
  };
}
