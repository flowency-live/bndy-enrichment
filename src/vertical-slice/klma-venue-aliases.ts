/**
 * KLMA Venue Aliases and Canonicalisation
 *
 * Ported from bndy-signals/src/source-runner/sources/klma-stoke/aliases.ts
 *
 * Handles venue name normalisation and alias lookup.
 * Uses slug-strength normalisation for lookup key - all format variants
 * (apostrophe, spacing, punctuation) collapse algorithmically. Only genuine
 * different-name variants need to be listed in clusters.
 */

// UK postcode regex (case-insensitive)
const UK_POSTCODE_REGEX = /\s*\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b\s*/gi;

// Curly apostrophe variants
const CURLY_APOSTROPHE = /[\u2018\u2019\u201A\u201B]/g;

// " in <Town>" pattern -> ", <Town>"
const IN_TOWN_PATTERN = /\s+in\s+(\w+)$/i;

/**
 * Generate a slug-strength normalised key.
 * This is THE lookup key - all format variants collapse.
 *
 * Transformations:
 * - Strips postcodes
 * - Lowercases
 * - Strips ALL apostrophes (curly and straight)
 * - Replaces ALL non-alphanumeric with dashes
 * - Trims leading/trailing dashes
 */
export function slugNormalise(raw: string): string {
  return raw
    .trim()
    .replace(UK_POSTCODE_REGEX, '')
    .toLowerCase()
    .replace(CURLY_APOSTROPHE, '')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Canonicalise a venue string according to KLMA rules:
 * 1. Trim whitespace
 * 2. Normalise curly apostrophe to straight
 * 3. Strip embedded UK postcode
 * 4. Normalise " in <Town>" to ", <Town>"
 */
export function canonicaliseVenue(raw: string): string {
  let result = raw.trim();
  result = result.replace(CURLY_APOSTROPHE, "'");
  result = result.replace(UK_POSTCODE_REGEX, '').trim();
  result = result.replace(IN_TOWN_PATTERN, ', $1');
  return result;
}

// Venue clusters - list variants that produce DIFFERENT slugs than the canonical.
// Format variants (apostrophe, punctuation within same structure) collapse automatically.
//
// What collapses automatically (same slug):
//   "Swiftys, Meir" ≈ "Swifty's, Meir" ≈ "Swiftys. Meir" (apostrophe/punctuation)
//
// What needs explicit listing (different slug):
//   "Swiftys" vs "Swiftys, Meir" (missing town)
//   "The Rigger" vs "The Rigger, Newcastle-under-Lyme" (missing town)
const VENUE_CLUSTERS: Array<{
  canonical: string;
  differentSlugVariants: string[];
  region?: string;
  flag?: string;
  bndyId?: string;
}> = [
  {
    canonical: 'The Nags Head, Macclesfield',
    differentSlugVariants: [
      'The Nags Head in Macclesfield',
    ],
    region: 'Cheshire',
  },
  {
    canonical: 'The Cosey, Haslington',
    differentSlugVariants: [
      'The Cosey Haslington',
      'The Cosey Club Near Crewe',
      'Cosey Club Haslington',
    ],
    region: 'Cheshire',
  },
  {
    canonical: 'The Rigger, Newcastle-under-Lyme',
    differentSlugVariants: [
      'The Rigger',
      'The Rigger Venue',
      'The Rigger Venue, Newcastle-under-Lyme',
    ],
    region: 'Staffordshire',
    flag: 'multi_act',
  },
  {
    canonical: 'Artisan Tap, Hartshill',
    differentSlugVariants: [
      'Artisan Tap',
      'The Artisan Tap',
    ],
    region: 'Staffordshire',
    flag: 'specialist',
  },
  {
    canonical: 'The Queens Hotel, Macclesfield',
    differentSlugVariants: [
      'The Queens Hotel Macclesfield',
    ],
    region: 'Cheshire',
  },
  {
    canonical: 'Crewe Market Hall',
    differentSlugVariants: [
      'Market Hall, Crewe',
    ],
    region: 'Cheshire',
  },
  {
    canonical: 'Alsager Civic',
    differentSlugVariants: [],
    region: 'Cheshire',
  },
  {
    canonical: 'Swiftys, Meir',
    differentSlugVariants: [
      'Swiftys',
    ],
    region: 'Staffordshire',
    bndyId: 'aayxv4IGQbBmXBpk7WZL',
  },
  {
    canonical: 'The Swan, Stone',
    differentSlugVariants: [],
    region: 'Staffordshire',
    bndyId: '74BjwiHSxHDxdUghRVB9',
  },
  {
    canonical: 'The Moorland Inn, Burslem',
    differentSlugVariants: [
      'Moorland Inn Burslem',
      'Moorland Inn Smallthorne',
    ],
    region: 'Staffordshire',
    bndyId: 'hbXt7haW5QcV06fHixD0',
  },
  {
    canonical: 'The Roebuck, Forsbrook',
    differentSlugVariants: [
      'Roebuck Forsbrook',
    ],
    region: 'Staffordshire',
    bndyId: 'I7RcAfPu0g4DP7kXdlaL',
  },
];

// Build lookup maps: slug -> canonical and slug -> bndyId
const SLUG_TO_CANONICAL: Map<string, string> = new Map();
const SLUG_TO_BNDY_ID: Map<string, string> = new Map();

for (const cluster of VENUE_CLUSTERS) {
  const canonicalSlug = slugNormalise(cluster.canonical);
  SLUG_TO_CANONICAL.set(canonicalSlug, cluster.canonical);
  if (cluster.bndyId) {
    SLUG_TO_BNDY_ID.set(canonicalSlug, cluster.bndyId);
  }
  for (const variant of cluster.differentSlugVariants) {
    const variantSlug = slugNormalise(variant);
    SLUG_TO_CANONICAL.set(variantSlug, cluster.canonical);
    if (cluster.bndyId) {
      SLUG_TO_BNDY_ID.set(variantSlug, cluster.bndyId);
    }
  }
}

// Specialist venue slug prefixes
const SPECIALIST_VENUE_PREFIXES = ['artisan-tap', 'eleven'];

// Multi-act venue slug prefixes
const MULTI_ACT_VENUE_PREFIXES = ['the-rigger'];

// Cheshire towns for region detection
const CHESHIRE_TOWNS = [
  'Crewe',
  'Macclesfield',
  'Haslington',
  'Sandbach',
  'Congleton',
  'Nantwich',
  'Alsager',
  'Wilmslow',
  'Knutsford',
  'Audlem',
];

// Staffordshire towns for region detection
const STAFFORDSHIRE_TOWNS = [
  'Stoke-on-Trent',
  'Stone',
  'Leek',
  'Newcastle-under-Lyme',
  'Newcastle',
  'Stafford',
  'Uttoxeter',
  'Cheadle',
  'Biddulph',
  'Kidsgrove',
  'Ipstones',
  'Wyrley',
  'Burslem',
  'Hartshill',
  'Meir',
  'Forsbrook',
  'Sandyford',
  'Smallthorne',
];

/**
 * Lookup canonical name for a venue variant.
 * Uses slug-strength key - all format variants match algorithmically.
 * Returns null if not found in known clusters.
 */
export function lookupVenueCanonical(raw: string): string | null {
  const slug = slugNormalise(raw);
  return SLUG_TO_CANONICAL.get(slug) ?? null;
}

/**
 * Lookup trusted BNDY venue ID for a venue name.
 * Returns the known BNDY venue ID if this venue has been previously
 * verified and mapped. Returns null if unknown or ambiguous.
 *
 * IMPORTANT: Only returns bndyId for venues that have been explicitly
 * verified. Unknown venues MUST go through the canonical API for review.
 */
export function lookupTrustedBndyId(raw: string): string | null {
  const slug = slugNormalise(raw);
  return SLUG_TO_BNDY_ID.get(slug) ?? null;
}

/**
 * Check if a venue slug indicates a specialist venue.
 * Specialist venues need special handling (ticketed, curated events).
 */
export function isSpecialistVenue(slug: string): boolean {
  return SPECIALIST_VENUE_PREFIXES.some((prefix) => slug.startsWith(prefix));
}

/**
 * Check if a venue slug indicates a multi-act venue.
 * Multi-act venues need lineup resolution.
 */
export function isMultiActVenue(slug: string): boolean {
  return MULTI_ACT_VENUE_PREFIXES.some((prefix) => slug.startsWith(prefix));
}

export interface RegionResult {
  region: string;
  city: string;
}

function extractTownCandidate(venueString: string): string | null {
  const commaMatch = venueString.match(/,\s*([^,]+)$/);
  if (commaMatch?.[1]) {
    return commaMatch[1].trim();
  }
  return null;
}

function findTownInList(text: string, towns: readonly string[]): string | null {
  const normalised = text.toLowerCase();
  for (const town of towns) {
    if (normalised.includes(town.toLowerCase())) {
      return town;
    }
  }
  return null;
}

/**
 * Detect region from venue string.
 * 1. Check for Cheshire towns -> Cheshire region
 * 2. Check for Staffordshire towns -> Staffordshire region
 * 3. Try to extract town from trailing comma segment
 * 4. If no town derivable -> empty city, Staffordshire default
 */
export function detectRegion(venueString: string): RegionResult {
  const cheshireTown = findTownInList(venueString, CHESHIRE_TOWNS);
  if (cheshireTown) {
    return { region: 'Cheshire', city: cheshireTown };
  }

  const staffsTown = findTownInList(venueString, STAFFORDSHIRE_TOWNS);
  if (staffsTown) {
    return { region: 'Staffordshire', city: staffsTown };
  }

  const townCandidate = extractTownCandidate(venueString);
  if (townCandidate) {
    return { region: 'Staffordshire', city: townCandidate };
  }

  return { region: 'Staffordshire', city: '' };
}
