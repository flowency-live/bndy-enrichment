/**
 * SerpAPI client for Google Search results.
 * Cost: ~$0.005 per search (100 searches = $0.50)
 *
 * Alternative: Tavily API (~$0.01 per search but includes AI extraction)
 */

export interface SerpApiOptions {
  apiKey: string;
  location?: string;
  gl?: string; // country code
  hl?: string; // language
}

export interface OrganicResult {
  position: number;
  title: string;
  link: string;
  displayedLink: string;
  snippet?: string;
  source?: string;
}

export interface SerpApiResponse {
  searchParameters: {
    q: string;
    engine: string;
  };
  organicResults: OrganicResult[];
  error?: string;
}

export async function searchGoogle(
  query: string,
  options: SerpApiOptions
): Promise<SerpApiResponse> {
  const params = new URLSearchParams({
    api_key: options.apiKey,
    q: query,
    engine: 'google',
    location: options.location ?? 'United Kingdom',
    gl: options.gl ?? 'uk',
    hl: options.hl ?? 'en',
    num: '10',
  });

  const res = await fetch(`https://serpapi.com/search?${params}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SerpAPI ${res.status}: ${text}`);
  }

  const data = await res.json();

  return {
    searchParameters: {
      q: query,
      engine: 'google',
    },
    organicResults: (data.organic_results ?? []).map((r: any) => ({
      position: r.position,
      title: r.title,
      link: r.link,
      displayedLink: r.displayed_link,
      snippet: r.snippet,
      source: r.source,
    })),
    error: data.error,
  };
}

export function extractFacebookUrls(results: OrganicResult[]): string[] {
  const fbUrls: string[] = [];

  for (const result of results) {
    const url = result.link.toLowerCase();
    if (url.includes('facebook.com/') && !url.includes('facebook.com/search')) {
      // Normalize the URL
      let cleanUrl = result.link;
      // Remove tracking params
      try {
        const parsed = new URL(cleanUrl);
        parsed.search = '';
        cleanUrl = parsed.toString().replace(/\/$/, '');
      } catch {
        // Keep original if URL parsing fails
      }
      if (!fbUrls.includes(cleanUrl)) {
        fbUrls.push(cleanUrl);
      }
    }
  }

  return fbUrls;
}

export function extractOfficialWebsites(
  results: OrganicResult[],
  artistName: string
): string[] {
  const websites: string[] = [];
  const nameLower = artistName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Domains to exclude (social media, aggregators)
  const excludeDomains = [
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'youtube.com', 'spotify.com', 'soundcloud.com', 'bandcamp.com',
    'songkick.com', 'bandsintown.com', 'setlist.fm', 'last.fm',
    'wikipedia.org', 'discogs.com', 'allmusic.com',
    'bndy.live', 'gigantic.com', 'ticketmaster.', 'eventbrite.',
  ];

  for (const result of results) {
    try {
      const parsed = new URL(result.link);
      const domain = parsed.hostname.toLowerCase();

      // Skip excluded domains
      if (excludeDomains.some(ex => domain.includes(ex))) {
        continue;
      }

      // Look for domain containing artist name
      const domainClean = domain.replace(/[^a-z0-9]/g, '');
      if (domainClean.includes(nameLower) || nameLower.includes(domainClean.replace('www', ''))) {
        const cleanUrl = `${parsed.protocol}//${parsed.hostname}`;
        if (!websites.includes(cleanUrl)) {
          websites.push(cleanUrl);
        }
      }
    } catch {
      // Skip invalid URLs
    }
  }

  return websites;
}

export interface SearchCandidate {
  facebookUrls: string[];
  websiteUrls: string[];
  allResults: OrganicResult[];
  query: string;
}

export async function searchForArtist(
  name: string,
  town: string | undefined,
  options: SerpApiOptions
): Promise<SearchCandidate> {
  // Primary search: artist name + location + site:facebook.com
  const locationPart = town ? ` "${town}"` : '';
  const fbQuery = `"${name}"${locationPart} site:facebook.com`;

  const fbResults = await searchGoogle(fbQuery, options);
  const facebookUrls = extractFacebookUrls(fbResults.organicResults);

  // Secondary search: general search for official website
  const generalQuery = `"${name}"${locationPart} band`;
  const generalResults = await searchGoogle(generalQuery, options);
  const websiteUrls = extractOfficialWebsites(generalResults.organicResults, name);

  return {
    facebookUrls,
    websiteUrls,
    allResults: [...fbResults.organicResults, ...generalResults.organicResults],
    query: fbQuery,
  };
}
