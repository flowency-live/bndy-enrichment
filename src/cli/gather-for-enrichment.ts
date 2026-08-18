#!/usr/bin/env npx tsx
/**
 * Gather artists and venues with upcoming gigs that need enrichment.
 * Queries events by geohash within a radius of a center point,
 * then checks each entity's enrichment status.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBDocumentClient(
  new DynamoDBClient({ region: 'eu-west-2' })
);

// Geohash4 cells for ~25 mile radius around Stoke-on-Trent
const STOKE_25_MILE_CELLS = [
  'gcq5', 'gcq7', 'gcqe', 'gcqg', 'gcqh', 'gcqk', 'gcqs', 'gcqu',
  'gcqj', 'gcqm', 'gcqt', 'gcqv', 'gcqn', 'gcqq', 'gcqw', 'gcqy',
  'gcqp', 'gcqr', 'gcqx', 'gcqz',
];

// Expanded cells for ~50 mile radius (add surrounding cells)
const STOKE_50_MILE_CELLS = [
  ...STOKE_25_MILE_CELLS,
  // North (Manchester, Sheffield area)
  'gcr0', 'gcr1', 'gcr2', 'gcr3', 'gcr4', 'gcr5', 'gcr6', 'gcr7',
  'gcrb', 'gcrc', 'gcrd', 'gcre', 'gcrf', 'gcrg',
  // South (Birmingham area)
  'gcm5', 'gcm7', 'gcme', 'gcmg', 'gcmh', 'gcmk', 'gcms', 'gcmu',
  'gcmj', 'gcmm', 'gcmt', 'gcmv',
  // West (Wales border)
  'gcq0', 'gcq1', 'gcq2', 'gcq3', 'gcq4', 'gcq6', 'gcq8', 'gcq9',
  // East
  'gct0', 'gct1', 'gct2', 'gct3', 'gct4', 'gct5', 'gct6', 'gct7',
];

// 100 mile cells (full coverage)
const STOKE_100_MILE_CELLS = [
  ...STOKE_50_MILE_CELLS,
  // Additional cells for wider coverage
  'gcrh', 'gcrj', 'gcrk', 'gcrm', 'gcrn', 'gcrp', 'gcrq', 'gcrr',
  'gcrs', 'gcrt', 'gcru', 'gcrv', 'gcrw', 'gcrx', 'gcry', 'gcrz',
  'gcsu', 'gcsv', 'gcth', 'gctj', 'gctk', 'gctm', 'gctn', 'gctp',
  'gctq', 'gctr', 'gcts', 'gctt', 'gctu', 'gctv', 'gctw', 'gctx',
  'gcwh', 'gcwj', 'gcwk', 'gcwm', 'gcwn', 'gcwp', 'gcwq', 'gcwr',
  'gcws', 'gcwt', 'gcwu', 'gcwv', 'gcww', 'gcwx',
];

interface Event {
  id: string;
  artistId: string;
  venueId: string;
  date: string;
  startTime?: string;
  geoLat?: number;
  geoLng?: number;
  isPublic?: boolean;
}

// Artist entity (actual DynamoDB field names)
interface Artist {
  id: string;
  name: string;
  location?: string;
  facebookUrl?: string;
  websiteUrl?: string;
  enrichment_status?: string;
  enrichment_date?: string;
  enrichment_data?: Record<string, unknown>;
  genres?: string[];
  artist_type?: string;
  actType?: string[];
  bio?: string;
  needs_review?: boolean;
  source?: string;
}

// Venue entity (actual DynamoDB field names)
interface Venue {
  id: string;
  name: string;
  city?: string;
  postcode?: string;
  website?: string;
  social_media_urls?: string[];
  enrichment_status?: string;
  enrichment_date?: string;
  validated?: boolean;
}

interface GatherOptions {
  radius: 25 | 50 | 100;
  daysAhead: number;
  onlyNeedsEnrichment: boolean;
  verbose: boolean;
  outputFile?: string;
  jsonOnly: boolean;
}

function getCellsForRadius(radius: 25 | 50 | 100): string[] {
  switch (radius) {
    case 25: return STOKE_25_MILE_CELLS;
    case 50: return STOKE_50_MILE_CELLS;
    case 100: return STOKE_100_MILE_CELLS;
  }
}

async function queryEventsForCell(
  cell: string,
  startDate: string,
  endDate: string
): Promise<Event[]> {
  const events: Event[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await client.send(
      new QueryCommand({
        TableName: 'bndy-events',
        IndexName: 'geohash4-date-index',
        KeyConditionExpression: 'geohash4 = :gh AND #d BETWEEN :start AND :end',
        ExpressionAttributeNames: { '#d': 'date' },
        ExpressionAttributeValues: {
          ':gh': cell,
          ':start': startDate,
          ':end': endDate,
        },
        ExclusiveStartKey: lastKey,
      })
    );

    if (result.Items) {
      events.push(...(result.Items as Event[]));
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return events;
}

async function batchGetArtists(ids: string[]): Promise<Map<string, Artist>> {
  const entities = new Map<string, Artist>();
  const uniqueIds = [...new Set(ids)];

  for (let i = 0; i < uniqueIds.length; i += 100) {
    const batch = uniqueIds.slice(i, i + 100);
    const keys = batch.map((id) => ({ id }));

    const result = await client.send(
      new BatchGetCommand({
        RequestItems: { 'bndy-artists': { Keys: keys } },
      })
    );

    const items = result.Responses?.['bndy-artists'] as Artist[] | undefined;
    if (items) {
      for (const item of items) {
        entities.set(item.id, item);
      }
    }
  }

  return entities;
}

async function batchGetVenues(ids: string[]): Promise<Map<string, Venue>> {
  const entities = new Map<string, Venue>();
  const uniqueIds = [...new Set(ids)];

  for (let i = 0; i < uniqueIds.length; i += 100) {
    const batch = uniqueIds.slice(i, i + 100);
    const keys = batch.map((id) => ({ id }));

    const result = await client.send(
      new BatchGetCommand({
        RequestItems: { 'bndy-venues': { Keys: keys } },
      })
    );

    const items = result.Responses?.['bndy-venues'] as Venue[] | undefined;
    if (items) {
      for (const item of items) {
        entities.set(item.id, item);
      }
    }
  }

  return entities;
}

interface ArtistEnrichmentGaps {
  missingGenres: boolean;
  missingArtistType: boolean;
  missingActType: boolean;
  missingBio: boolean;
  missingFacebook: boolean;
  missingWebsite: boolean;
}

interface VenueEnrichmentGaps {
  missingFacebook: boolean;
  missingWebsite: boolean;
}

function getArtistGaps(artist: Artist): ArtistEnrichmentGaps {
  return {
    missingGenres: !artist.genres || artist.genres.length === 0,
    missingArtistType: !artist.artist_type,
    missingActType: !artist.actType || artist.actType.length === 0,
    missingBio: !artist.bio || artist.bio.trim() === '',
    missingFacebook: !artist.facebookUrl || artist.facebookUrl.trim() === '',
    missingWebsite: !artist.websiteUrl || artist.websiteUrl.trim() === '',
  };
}

function getVenueGaps(venue: Venue): VenueEnrichmentGaps {
  // Handle social_media_urls which might be array of strings or undefined
  const urls = venue.social_media_urls ?? [];
  const hasFacebook = urls.some((url) => {
    if (typeof url !== 'string') return false;
    return url.toLowerCase().includes('facebook');
  });
  return {
    missingFacebook: !hasFacebook,
    missingWebsite: !venue.website || venue.website.trim() === '',
  };
}

function artistNeedsEnrichment(artist: Artist): boolean {
  // Already enriched with high confidence
  if (artist.enrichment_status === 'high_confidence') {
    return false;
  }

  const gaps = getArtistGaps(artist);
  // Needs enrichment if missing ANY critical field
  return gaps.missingGenres || gaps.missingArtistType || gaps.missingActType;
}

function venueNeedsEnrichment(venue: Venue): boolean {
  // Already enriched with high confidence
  if (venue.enrichment_status === 'high_confidence') {
    return false;
  }
  // Validated venues with website are OK
  if (venue.validated && venue.website) {
    return false;
  }

  const gaps = getVenueGaps(venue);
  // Needs enrichment if missing both Facebook and website
  return gaps.missingFacebook && gaps.missingWebsite;
}

function formatDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

async function gather(options: GatherOptions): Promise<void> {
  const cells = getCellsForRadius(options.radius);
  const startDate = formatDate(0);
  const endDate = formatDate(options.daysAhead);

  const log = options.jsonOnly ? () => {} : console.log.bind(console);

  log(`\n📍 Gathering entities within ${options.radius} miles of Stoke-on-Trent`);
  log(`📅 Date range: ${startDate} to ${endDate}`);
  log(`🔍 Querying ${cells.length} geohash4 cells...\n`);

  // Collect all events
  const allEvents: Event[] = [];
  for (const cell of cells) {
    const events = await queryEventsForCell(cell, startDate, endDate);
    if (options.verbose && events.length > 0) {
      log(`  ${cell}: ${events.length} events`);
    }
    allEvents.push(...events);
  }

  log(`\n✅ Found ${allEvents.length} total events`);

  // Extract unique artist and venue IDs
  const artistIds = [...new Set(allEvents.map((e) => e.artistId).filter(Boolean))];
  const venueIds = [...new Set(allEvents.map((e) => e.venueId).filter(Boolean))];

  log(`👤 Unique artists: ${artistIds.length}`);
  log(`🏠 Unique venues: ${venueIds.length}`);

  // Fetch entities
  log(`\n⏳ Fetching entity details...`);
  const artists = await batchGetArtists(artistIds);
  const venues = await batchGetVenues(venueIds);

  log(`  Retrieved ${artists.size} artists, ${venues.size} venues`);

  // Analyze artist gaps
  const artistGapStats = {
    total: artists.size,
    missingGenres: 0,
    missingArtistType: 0,
    missingActType: 0,
    missingBio: 0,
    missingFacebook: 0,
    missingWebsite: 0,
    highConfidence: 0,
  };

  const artistsNeedingEnrichment: Artist[] = [];
  for (const artist of artists.values()) {
    const gaps = getArtistGaps(artist);
    if (gaps.missingGenres) artistGapStats.missingGenres++;
    if (gaps.missingArtistType) artistGapStats.missingArtistType++;
    if (gaps.missingActType) artistGapStats.missingActType++;
    if (gaps.missingBio) artistGapStats.missingBio++;
    if (gaps.missingFacebook) artistGapStats.missingFacebook++;
    if (gaps.missingWebsite) artistGapStats.missingWebsite++;
    if (artist.enrichment_status === 'high_confidence') artistGapStats.highConfidence++;

    if (!options.onlyNeedsEnrichment || artistNeedsEnrichment(artist)) {
      artistsNeedingEnrichment.push(artist);
    }
  }

  // Analyze venue gaps
  const venueGapStats = {
    total: venues.size,
    missingFacebook: 0,
    missingWebsite: 0,
    validated: 0,
    highConfidence: 0,
  };

  const venuesNeedingEnrichment: Venue[] = [];
  for (const venue of venues.values()) {
    const gaps = getVenueGaps(venue);
    if (gaps.missingFacebook) venueGapStats.missingFacebook++;
    if (gaps.missingWebsite) venueGapStats.missingWebsite++;
    if (venue.validated) venueGapStats.validated++;
    if (venue.enrichment_status === 'high_confidence') venueGapStats.highConfidence++;

    if (!options.onlyNeedsEnrichment || venueNeedsEnrichment(venue)) {
      venuesNeedingEnrichment.push(venue);
    }
  }

  // Print gap analysis
  log(`\n📊 ARTIST GAP ANALYSIS (${artistGapStats.total} total):`);
  log(`  High confidence (skip): ${artistGapStats.highConfidence}`);
  log(`  Missing genres: ${artistGapStats.missingGenres}`);
  log(`  Missing artist_type: ${artistGapStats.missingArtistType}`);
  log(`  Missing actType: ${artistGapStats.missingActType}`);
  log(`  Missing bio: ${artistGapStats.missingBio}`);
  log(`  Missing Facebook: ${artistGapStats.missingFacebook}`);
  log(`  Missing website: ${artistGapStats.missingWebsite}`);

  log(`\n📊 VENUE GAP ANALYSIS (${venueGapStats.total} total):`);
  log(`  High confidence (skip): ${venueGapStats.highConfidence}`);
  log(`  Validated: ${venueGapStats.validated}`);
  log(`  Missing Facebook: ${venueGapStats.missingFacebook}`);
  log(`  Missing website: ${venueGapStats.missingWebsite}`);

  log(`\n📋 Entities needing enrichment:`);
  log(`  Artists: ${artistsNeedingEnrichment.length}`);
  log(`  Venues: ${venuesNeedingEnrichment.length}`);

  // Output as SearchEntity format for enrichment pipeline
  const searchEntities = [
    ...artistsNeedingEnrichment.map((a) => ({
      type: 'artist' as const,
      bndyId: a.id,
      name: a.name,
      town: a.location,
      facebookUrl: a.facebookUrl || undefined,
      officialWebsite: a.websiteUrl || undefined,
    })),
    ...venuesNeedingEnrichment.map((v) => {
      const urls = v.social_media_urls ?? [];
      const fbUrl = urls.find((url) =>
        typeof url === 'string' && url.toLowerCase().includes('facebook')
      );
      return {
        type: 'venue' as const,
        bndyId: v.id,
        name: v.name,
        town: v.city || undefined,  // Convert null/empty to undefined
        facebookUrl: fbUrl,
        officialWebsite: v.website || undefined,
      };
    }),
  ];

  // Output JSON
  const jsonOutput = JSON.stringify(searchEntities, null, 2);

  if (options.outputFile) {
    const fs = await import('fs/promises');
    await fs.writeFile(options.outputFile, jsonOutput);
    if (!options.jsonOnly) {
      console.log(`\n✅ Wrote ${searchEntities.length} entities to ${options.outputFile}`);
    }
  } else if (options.jsonOnly) {
    console.log(jsonOutput);
  } else {
    console.log(`\n--- ENRICHMENT INTAKE (${searchEntities.length} entities) ---\n`);
    console.log(jsonOutput);
  }
}

// Parse CLI args
const args = process.argv.slice(2);
const options: GatherOptions = {
  radius: 25,
  daysAhead: 28,
  onlyNeedsEnrichment: true,
  verbose: false,
  jsonOnly: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--radius' && args[i + 1]) {
    const r = parseInt(args[++i], 10);
    if (r === 25 || r === 50 || r === 100) options.radius = r;
  } else if (arg === '--days' && args[i + 1]) {
    options.daysAhead = parseInt(args[++i], 10);
  } else if (arg === '--out' && args[i + 1]) {
    options.outputFile = args[++i];
  } else if (arg === '--all') {
    options.onlyNeedsEnrichment = false;
  } else if (arg === '--json') {
    options.jsonOnly = true;
  } else if (arg === '--verbose' || arg === '-v') {
    options.verbose = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: npx tsx src/cli/gather-for-enrichment.ts [options]

Options:
  --radius <25|50|100>  Miles from Stoke-on-Trent (default: 25)
  --days <n>            Days ahead to query (default: 28)
  --out <file>          Write JSON output to file
  --json                Output only JSON (no stats)
  --all                 Include all entities, not just those needing enrichment
  --verbose, -v         Show per-cell event counts
  --help, -h            Show this help

Examples:
  npx tsx src/cli/gather-for-enrichment.ts --radius 50 --days 14 --out intake.json
  npx tsx src/cli/gather-for-enrichment.ts --radius 100 --json > intake.json
`);
    process.exit(0);
  }
}

gather(options).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
