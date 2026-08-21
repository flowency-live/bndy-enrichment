import { createHash } from 'node:crypto';
import type { NormalisedSourceEvent } from '../../runner/types.js';
import type { GigsNewsRawGig } from './parse.js';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripActSuffix(name: string): string {
  const suffixes = [' band', ' duo', ' trio', ' live', ' acoustic', ' show', ' music'];
  const lower = name.toLowerCase();
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix)) return name.slice(0, -suffix.length).trim();
  }
  return name;
}

export function gigsNewsEventExternalId(gig: GigsNewsRawGig): string {
  return `${gig.date}_${slugify(stripActSuffix(gig.artist))}_${slugify(gig.venueCanonical)}`;
}

export function gigsNewsVenueExternalId(gig: GigsNewsRawGig): string {
  return `venue_${slugify(gig.venueCanonical)}`;
}

export function gigsNewsArtistExternalId(gig: GigsNewsRawGig): string {
  return `artist_${slugify(stripActSuffix(gig.artist))}`;
}

/**
 * Ported donor rule: gigs-news venue display names carry locality as their final
 * token (e.g. White Hart Woodley). This is deliberately retained for parity.
 */
export function gigsNewsVenueLocality(gig: GigsNewsRawGig): string {
  const words = gig.venue.trim().split(/\s+/);
  return words.length > 1 ? words[words.length - 1]! : 'Stockport';
}

export function normaliseGigsNewsGig(gig: GigsNewsRawGig): NormalisedSourceEvent {
  const sourceEventKey = gigsNewsEventExternalId(gig);
  const contentHash = createHash('sha256').update(JSON.stringify({
    date: gig.date,
    artist: gig.artist,
    venue: gig.venue,
    venueCanonical: gig.venueCanonical,
    time: gig.time,
    timeDefaulted: gig.timeDefaulted,
  })).digest('hex');

  return {
    sourceEventKey,
    sourceNativeId: sourceEventKey,
    artistName: gig.artist,
    artistExternalId: gigsNewsArtistExternalId(gig),
    artistLocation: 'Greater Manchester UK',
    venueName: gig.venueCanonical,
    venueExternalId: gigsNewsVenueExternalId(gig),
    venueLocation: gigsNewsVenueLocality(gig),
    date: gig.date,
    startTime: gig.time,
    status: 'confirmed',
    contentHash,
    data: {
      rawRowRef: `${gig.date}:${gig.artist}@${gig.venue}`,
      sourceVenueName: gig.venue,
      venueCanonical: gig.venueCanonical,
      timeProvenance: gig.timeDefaulted ? 'defaulted_from_missing' : 'parsed',
      parseWarnings: gig.timeDefaulted ? ['Time defaulted to 20:00'] : [],
      region: 'Greater Manchester / East Cheshire',
    },
  };
}
