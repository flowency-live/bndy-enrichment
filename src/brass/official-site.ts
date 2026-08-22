export interface OfficialSiteLocation {
  town?: string;
  county?: string;
  postcode?: string;
  evidenceUrl?: string;
}

const UK_POSTCODE = /\b(?:GIR\s?0AA|(?:(?:[A-PR-UWYZ][0-9][0-9A-HJKSTUW]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9ABEHMNPRV-Y]?)[ ]?[0-9][ABD-HJLNP-UW-Z]{2}))\b/i;

function decode(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)));
}

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const result = decode(value).replace(/\s+/g, ' ').trim();
  return result || undefined;
}

function walkJson(node: unknown, out: Record<string, string>[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((item) => walkJson(item, out));
    return;
  }
  const record = node as Record<string, unknown>;
  if (record.address && typeof record.address === 'object') {
    const address = record.address as Record<string, unknown>;
    const found: Record<string, string> = {};
    for (const key of ['addressLocality', 'addressRegion', 'postalCode', 'streetAddress']) {
      const value = clean(address[key]);
      if (value) found[key] = value;
    }
    if (Object.keys(found).length) out.push(found);
  }
  for (const value of Object.values(record)) walkJson(value, out);
}

export function extractLocationFromHtml(html: string, evidenceUrl?: string): OfficialSiteLocation | null {
  const jsonAddresses: Record<string, string>[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walkJson(JSON.parse(match[1]), jsonAddresses);
    } catch {
      // Ignore malformed third-party JSON-LD.
    }
  }

  const best = jsonAddresses.find((item) => item.addressLocality || item.postalCode);
  if (best) {
    return {
      town: best.addressLocality,
      county: best.addressRegion,
      postcode: best.postalCode,
      evidenceUrl,
    };
  }

  const postcode = decode(html.replace(/<[^>]+>/g, ' ')).match(UK_POSTCODE)?.[0]?.toUpperCase();
  if (postcode) return { postcode, evidenceUrl };
  return null;
}

function candidateUrls(officialWebsite: string): string[] {
  const root = new URL(officialWebsite);
  const origin = root.origin;
  return [...new Set([
    officialWebsite,
    `${origin}/contact`,
    `${origin}/contact-us`,
    `${origin}/about`,
    `${origin}/about-us`,
  ])];
}

async function fetchLocation(url: string): Promise<OfficialSiteLocation | null> {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'bndy-brass-research/1.0 (+https://bndy.live)', accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;
    return extractLocationFromHtml(await response.text(), response.url || url);
  } catch {
    return null;
  }
}

export async function resolveOfficialSiteLocation(officialWebsite: string): Promise<OfficialSiteLocation | null> {
  const urls = candidateUrls(officialWebsite);

  // Homepage is both cheapest and the most authoritative place to look first.
  const home = await fetchLocation(urls[0]);
  if (home?.town) return home;

  // Old band sites can have broken route variants. Probe the remaining common
  // location pages concurrently so one dead /contact path cannot stall a whole
  // national resolution run.
  const rest = await Promise.all(urls.slice(1).map(fetchLocation));
  const withTown = rest.find((location) => location?.town);
  if (withTown) return withTown;

  // A postcode-only result is still useful evidence even if it is not enough
  // on its own for the canonical Artist location gate.
  return home ?? rest.find(Boolean) ?? null;
}
