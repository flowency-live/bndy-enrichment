import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { DiscoveryResult, EntityEnrichment } from './schema.js';

type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

interface ArtistEnrichmentData {
  suggested_facebookUrl?: string;
  suggested_websiteUrl?: string;
  suggested_bio?: string;
  suggested_genres?: string[];
  suggested_artistType?: string;
  suggested_actTypes?: string[];
  confidence: Confidence;
  notes: string;
  evidenceUrls: string[];
  date: string;
}

interface VenueEnrichmentData {
  suggested_website: string | null;
  suggested_facebook: string | null;
  confidence: Confidence;
  notes: string;
  date: string;
}

export function mapConfidence(identityConfidence: number): Confidence {
  if (identityConfidence >= 0.85) return 'HIGH';
  if (identityConfidence >= 0.6) return 'MEDIUM';
  return 'LOW';
}

export function hasEnrichmentData(enrichment: EntityEnrichment): boolean {
  if (enrichment.facebook.status === 'matched' && enrichment.facebook.url) {
    return true;
  }
  if (enrichment.bio.text && enrichment.bio.text.length > 0) {
    return true;
  }
  if (enrichment.officialWebsite) {
    return true;
  }
  if (enrichment.artistProfile) {
    if (enrichment.artistProfile.genres.length > 0) {
      return true;
    }
    if (enrichment.artistProfile.artistType) {
      return true;
    }
    if (enrichment.artistProfile.actTypes.length > 0) {
      return true;
    }
  }
  return false;
}

function buildNotes(enrichment: EntityEnrichment): string {
  const parts: string[] = [];

  if (enrichment.facebook.status === 'matched') {
    parts.push(`Facebook: matched with ${(enrichment.facebook.confidence * 100).toFixed(0)}% confidence`);
  }
  if (enrichment.bio.text) {
    parts.push('Bio: found');
  }
  if (enrichment.artistProfile?.genres.length) {
    parts.push(`Genres: ${enrichment.artistProfile.genres.join(', ')}`);
  }
  if (enrichment.artistProfile?.artistType) {
    parts.push(`Artist type: ${enrichment.artistProfile.artistType}`);
  }
  if (enrichment.artistProfile?.actTypes.length) {
    parts.push(`Act types: ${enrichment.artistProfile.actTypes.join(', ')}`);
  }

  return parts.length > 0 ? parts.join('; ') : 'Enrichment data found via Google Search';
}

export function mapToArtistEnrichmentData(result: DiscoveryResult): ArtistEnrichmentData {
  const enrichment = result.entityEnrichment;
  const profile = enrichment.artistProfile;

  return {
    suggested_facebookUrl: enrichment.facebook.status === 'matched' ? enrichment.facebook.url : undefined,
    suggested_websiteUrl: enrichment.officialWebsite,
    suggested_bio: enrichment.bio.text,
    suggested_genres: profile?.genres.length ? profile.genres : undefined,
    suggested_artistType: profile?.artistType,
    suggested_actTypes: profile?.actTypes.length ? profile.actTypes : undefined,
    confidence: mapConfidence(result.identityConfidence),
    notes: buildNotes(enrichment),
    evidenceUrls: enrichment.evidenceUrls,
    date: result.retrievedAt,
  };
}

export function mapToVenueEnrichmentData(result: DiscoveryResult): VenueEnrichmentData {
  const enrichment = result.entityEnrichment;

  return {
    suggested_website: enrichment.officialWebsite ?? null,
    suggested_facebook: enrichment.facebook.status === 'matched' ? (enrichment.facebook.url ?? null) : null,
    confidence: mapConfidence(result.identityConfidence),
    notes: buildNotes(enrichment),
    date: result.retrievedAt,
  };
}

export async function writeEnrichmentToEntity(
  ddb: DynamoDBDocumentClient,
  result: DiscoveryResult,
  artistsTable: string,
  venuesTable: string,
): Promise<void> {
  if (result.eligibility.suppressed) {
    return;
  }

  if (!hasEnrichmentData(result.entityEnrichment)) {
    return;
  }

  const isArtist = result.entity.type === 'artist';
  const tableName = isArtist ? artistsTable : venuesTable;
  const enrichmentData = isArtist
    ? mapToArtistEnrichmentData(result)
    : mapToVenueEnrichmentData(result);

  // Both artists and venues use snake_case in DynamoDB
  // (The API handler converts to camelCase for artist responses)

  await ddb.send(new UpdateCommand({
    TableName: tableName,
    Key: { id: result.entity.bndyId },
    UpdateExpression: 'SET enrichment_status = :status, enrichment_date = :date, enrichment_data = :data',
    ExpressionAttributeValues: {
      ':status': 'needs_review',
      ':date': result.retrievedAt,
      ':data': enrichmentData,
    },
  }));
}
