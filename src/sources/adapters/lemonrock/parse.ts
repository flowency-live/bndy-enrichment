import { createHash } from 'node:crypto';
import type { NormalisedSourceClaim, NormalisedSourceEntity, NormalisedSourceEvent, ParsedSource, SourceFanoutRequest, SourceRunContext } from '../../runner/types.js';
import { anchorsFromHtml, decodeHtml, gigId, lemonrockSlug, textFromHtml, titleFromHtml, uniqueBy } from './html.js';

const BASE = 'https://www.lemonrock.com/';
const RESERVED_SLUGS = new Set([
  'about', 'install', 'join', 'login', 'help', 'faq', 'faqs', 'guide', 'contact', 'terms', 'privacy',
  'bands', 'venues', 'gigs', 'festivals', 'reviews', 'songs', 'blog', 'news', 'search', 'home', 'index',
]);

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function taskKind(run: SourceRunContext): string {
  const kind = run.task?.kind;
  if (typeof kind === 'string') return kind;
  if (run.sourceId.includes('artist-index')) return 'artist-index';
  if (run.sourceId.includes('venue-index')) return 'venue-index';
  if (run.sourceId.includes('artist-hydration')) return 'artist';
  if (run.sourceId.includes('venue-hydration')) return 'venue';
  if (run.sourceId.includes('gig-hydration')) return 'gig';
  if (run.sourceId.includes('full-reconcile')) return 'full-reconcile';
  if (run.sourceId.includes('future-reconcile')) return 'future-index';
  if (run.sourceId.includes('cancellations')) return 'cancellations';
  return 'new-gigs';
}

function request(
  sourceId: string,
  kind: string,
  url: string,
  nativeId?: string,
  name?: string,
  taskFields?: Record<string, unknown>,
): SourceFanoutRequest {
  const identity = nativeId ?? url;
  return {
    sourceId,
    taskKey: `${kind}:${identity}`,
    task: { kind, url, ...(nativeId ? { nativeId } : {}), ...(name ? { name } : {}), ...taskFields },
  };
}

function safeProfileLinks(html: string, sourceUrl: string) {
  return anchorsFromHtml(html, sourceUrl).filter((anchor) => {
    const slug = lemonrockSlug(anchor.href);
    return Boolean(slug && !RESERVED_SLUGS.has(slug) && anchor.text.length > 0 && anchor.text.length < 180);
  });
}

function gigRequests(html: string, sourceUrl: string): SourceFanoutRequest[] {
  return uniqueBy(
    anchorsFromHtml(html, sourceUrl)
      .map((anchor) => ({ anchor, id: gigId(anchor.href) }))
      .filter((item): item is { anchor: { href: string; text: string }; id: string } => Boolean(item.id))
      .map(({ anchor, id }) => request('lemonrock-gig-hydration', 'gig', anchor.href, `lemonrock:gig:${id}`, anchor.text)),
    (item) => item.taskKey,
  );
}

function pageRequests(html: string, sourceUrl: string, pathFragment: string, kind: string, sourceId: string): SourceFanoutRequest[] {
  return uniqueBy(
    anchorsFromHtml(html, sourceUrl)
      .filter((anchor) => anchor.href.includes(pathFragment))
      .map((anchor) => request(sourceId, kind, anchor.href)),
    (item) => item.taskKey,
  );
}

function directoryPageRequests(
  html: string,
  sourceUrl: string,
  pathFragment: 'allbands.php' | 'allvenues.php',
  kind: 'artist-index-page' | 'venue-index-page',
  sourceId: 'lemonrock-artist-index' | 'lemonrock-venue-index',
): SourceFanoutRequest[] {
  return uniqueBy(
    anchorsFromHtml(html, sourceUrl)
      .filter((anchor) => anchor.href.includes(pathFragment))
      .map((anchor) => {
        const url = new URL(anchor.href);
        // The directory defaults to profiles with current gigs. Backline's
        // national inventory includes every discoverable profile, including
        // artists and venues that do not currently advertise a gig.
        url.searchParams.set('all', '1');
        return request(sourceId, kind, url.toString());
      }),
    (item) => item.taskKey,
  );
}

function gigListingRequests(html: string, sourceUrl: string): SourceFanoutRequest[] {
  return uniqueBy(
    anchorsFromHtml(html, sourceUrl)
      .filter((anchor) => {
        const url = new URL(anchor.href);
        const pathname = url.pathname.toLowerCase();
        if (pathname.startsWith('/gigs-in-')) return true;

        // Town pages link to day/month listing views at the site root. Those
        // views are required to move beyond the default current-week window.
        return pathname === '/'
          && url.searchParams.has('cityId')
          && url.searchParams.has('gigfromdate')
          && url.searchParams.has('listingPeriod');
      })
      .map((anchor) => request('lemonrock-future-reconcile', 'gig-index', anchor.href)),
    (item) => item.taskKey,
  );
}

function artistIndex(html: string, sourceUrl: string): ParsedSource {
  const profiles = safeProfileLinks(html, sourceUrl).map((anchor) => {
    const slug = lemonrockSlug(anchor.href)!;
    return request('lemonrock-artist-hydration', 'artist', anchor.href, `lemonrock:artist:${slug}`, anchor.text);
  });
  const pages = uniqueBy([
    ...directoryPageRequests(html, sourceUrl, 'allbands.php', 'artist-index-page', 'lemonrock-artist-index'),
    // Retain compatibility with previously captured advanced-search evidence.
    ...pageRequests(html, sourceUrl, 'advancedsearchbands.php', 'artist-index-page', 'lemonrock-artist-index'),
  ], (item) => item.taskKey);
  const text = textFromHtml(html);
  const total = Number(text.match(/Found\s+([\d,]+)\s+band\/artists?/i)?.[1]?.replace(/,/g, '') ?? '0');
  const generated: SourceFanoutRequest[] = [];
  if (total > 0 && new URL(sourceUrl).searchParams.get('_start') === '0') {
    for (let start = 50; start < total; start += 50) {
      const url = new URL(sourceUrl);
      url.searchParams.set('_start', String(start));
      generated.push(request('lemonrock-artist-index', 'artist-index-page', url.toString()));
    }
  }
  return { events: [], nextRequests: uniqueBy([...profiles, ...pages, ...generated], (item) => item.taskKey), parked: [], warnings: [] };
}

function venueIndex(html: string, sourceUrl: string): ParsedSource {
  const profiles = safeProfileLinks(html, sourceUrl).map((anchor) => {
    const slug = lemonrockSlug(anchor.href)!;
    return request('lemonrock-venue-hydration', 'venue', anchor.href, `lemonrock:venue:${slug}`, anchor.text);
  });
  const pages = directoryPageRequests(html, sourceUrl, 'allvenues.php', 'venue-index-page', 'lemonrock-venue-index');
  return { events: [], nextRequests: uniqueBy([...profiles, ...pages], (item) => item.taskKey), parked: [], warnings: [] };
}

function futureIndex(html: string, sourceUrl: string): ParsedSource {
  const counties = uniqueBy(
    anchorsFromHtml(html, sourceUrl)
      .filter((anchor) => {
        const url = new URL(anchor.href);
        const pathname = url.pathname.toLowerCase();
        return pathname.startsWith('/gigs-in-')
          || (pathname === '/gigsincounty.php' && url.searchParams.has('county'));
      })
      .map((anchor) => {
        const advertised = Number(anchor.text.match(/([\d,]+)\s+gigs?/i)?.[1]?.replace(/,/g, '') ?? '0');
        return request(
          'lemonrock-future-reconcile',
          'gig-index',
          anchor.href,
          undefined,
          undefined,
          advertised > 0 ? { expectedCount: advertised, inventoryLevel: 'county' } : undefined,
        );
      }),
    (item) => item.taskKey,
  );
  const gigs = gigRequests(html, sourceUrl);
  return { events: [], nextRequests: uniqueBy([...counties, ...gigs], (item) => item.taskKey), parked: [], warnings: [] };
}

function fullReconcile(_html: string, _sourceUrl: string): ParsedSource {
  const roots = [
    request(
      'lemonrock-artist-index',
      'artist-index',
      'https://www.lemonrock.com/allbands.php',
    ),
    request(
      'lemonrock-venue-index',
      'venue-index',
      'https://www.lemonrock.com/allvenues.php',
    ),
    request(
      'lemonrock-future-reconcile',
      'future-index',
      'https://www.lemonrock.com/gigsbycounty.php',
    ),
    request(
      'lemonrock-new-gigs',
      'new-gigs',
      'https://www.lemonrock.com/newestgigs.php',
    ),
    request(
      'lemonrock-cancellations',
      'cancellations',
      'https://www.lemonrock.com/cancellations.php',
    ),
  ];
  return {
    events: [],
    nextRequests: roots,
    parked: [],
    warnings: [],
  };
}

function listPage(html: string, sourceUrl: string): ParsedSource {
  const gigs = gigRequests(html, sourceUrl);
  const pages = uniqueBy([
    ...gigListingRequests(html, sourceUrl),
    ...anchorsFromHtml(html, sourceUrl)
      .filter((anchor) => {
        const url = new URL(anchor.href);
        return url.pathname === new URL(sourceUrl).pathname && url.search !== new URL(sourceUrl).search && /(?:start|page|offset|date|period)/i.test(url.search);
      })
      .map((anchor) => request('lemonrock-future-reconcile', 'gig-index', anchor.href)),
  ], (item) => item.taskKey);
  return { events: [], nextRequests: uniqueBy([...gigs, ...pages], (item) => item.taskKey), parked: [], warnings: gigs.length ? [] : ['No gig detail links discovered on Lemonrock listing page'] };
}

function isoDate(dayText: string, monthText: string, yearText: string): string | undefined {
  const day = Number(dayText);
  const month = MONTHS[monthText.toLowerCase()];
  const year = Number(yearText);
  if (!day || !month || year < 2000) return undefined;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function time24(value: string): string | undefined {
  const clean = value.trim().toLowerCase().replace(/\s+/g, '');
  if (clean === 'midnight') return '00:00';
  if (clean === 'noon') return '12:00';
  const match = clean.match(/^(\d{1,2})(?:[.:](\d{2}))?(am|pm)$/);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  if (hour === 12) hour = 0;
  if (match[3] === 'pm') hour += 12;
  if (hour > 23 || minute > 59) return undefined;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function extractDate(text: string): string | undefined {
  const match = text.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i);
  return match ? isoDate(match[1], match[2], match[3]) : undefined;
}

function externalLinks(html: string): Array<{ url: string; host: string }> {
  const out: Array<{ url: string; host: string }> = [];
  const regex = /<a\b[^>]*?href\s*=\s*(["'])(.*?)\1/gi;
  for (const match of html.matchAll(regex)) {
    try {
      const url = new URL(decodeHtml(match[2]), BASE);
      if (url.hostname.endsWith('lemonrock.com')) continue;
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      out.push({ url: url.toString(), host: url.hostname.toLowerCase().replace(/^www\./, '') });
    } catch { /* ignored */ }
  }
  return uniqueBy(out, (item) => item.url);
}

function fieldClaim(field: string, value: unknown): NormalisedSourceClaim {
  return { predicate: 'derivedFrom', value: { field, value } };
}

function profileEntity(kind: 'artist' | 'venue', html: string, sourceUrl: string, run: SourceRunContext): NormalisedSourceEntity {
  const text = textFromHtml(html);
  const taskNative = typeof run.task?.nativeId === 'string' ? run.task.nativeId : undefined;
  const slug = lemonrockSlug(sourceUrl) ?? taskNative?.split(':').pop() ?? createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16);
  const sourceEntityKey = taskNative ?? `lemonrock:${kind}:${slug}`;
  const suppliedName = typeof run.task?.name === 'string' ? run.task.name.trim() : undefined;
  const rawTitle = titleFromHtml(html)?.replace(/\s*-\s*Lemonrock Gig Guide.*$/i, '').trim();
  const titleName = rawTitle?.split(/\s+:\s+/)[0]?.trim();
  const displayName = suppliedName || titleName || slug;
  const claims: NormalisedSourceClaim[] = [];

  const based = text.match(/(?:^|\n)Based:\s*([^\n]+)/i)?.[1]?.trim();
  if (based) claims.push({ predicate: 'hasLocation', value: based });
  const address = text.match(/(?:^|\n)Address:\s*([^\n]+)/i)?.[1]?.trim();
  if (address) claims.push({ predicate: 'hasAddress', value: address });
  const formats = text.match(/(?:^|\n)Band formats?:\s*([^\n]+)/i)?.[1]?.trim();
  if (formats) for (const format of formats.split(',').map((v) => v.trim()).filter(Boolean)) claims.push({ predicate: 'hasActType', value: format });
  const genres = text.match(/(?:^|\n)Genre tags?:\s*([^\n]+)/i)?.[1]?.trim();
  if (genres) for (const genre of genres.split(',').map((v) => v.trim()).filter(Boolean)) claims.push({ predicate: 'hasGenre', value: genre });
  const phone = text.match(/(?:^|\n)(?:Tel|Telephone):\s*([^\n]+)/i)?.[1]?.trim();
  if (phone) claims.push(fieldClaim('phone', phone));
  const email = text.match(/(?:^|\n)Email:\s*([^\s\n]+@[^\s\n]+)/i)?.[1]?.trim();
  if (email) claims.push(fieldClaim('email', email));
  const updated = text.match(/Last updated\s+([^\n.]+)/i)?.[1]?.trim();
  if (updated) claims.push(fieldClaim('sourceLastUpdatedAt', updated));
  const maintained = text.match(/Page maintained[^\n.]*/i)?.[0]?.trim();
  if (maintained) claims.push(fieldClaim('lemonrockMaintained', maintained));
  const postcode = text.match(/\b(?:GIR 0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)?.[0]?.toUpperCase();
  if (postcode) claims.push(fieldClaim('postcode', postcode));

  const titleParts = rawTitle?.split(/\s+:\s+/).map((v) => v.trim()).filter(Boolean) ?? [];
  if (kind === 'venue' && titleParts[1]) claims.push(fieldClaim('venueType', titleParts[1]));
  if (kind === 'artist' && titleParts[1]) claims.push({ predicate: 'hasArtistType', value: titleParts[1] });

  for (const link of externalLinks(html)) {
    if (link.host === 'facebook.com' || link.host.endsWith('.facebook.com')) claims.push({ predicate: 'hasFacebookUrl', value: link.url });
    else if (link.host === 'instagram.com' || link.host.endsWith('.instagram.com')) claims.push({ predicate: 'hasInstagramUrl', value: link.url });
    else if (link.host === 'youtube.com' || link.host === 'youtu.be' || link.host.endsWith('.youtube.com')) claims.push(fieldClaim('youtubeUrl', link.url));
    else if (link.host.endsWith('bandcamp.com')) claims.push(fieldClaim('bandcampUrl', link.url));
    else claims.push({ predicate: 'hasWebsiteUrl', value: link.url });
  }

  const meaningful = text.split('\n').filter((line) => line.trim().length > 30 && !/Lemonrock Gig Guide|Gig Guide|More Gig Sections/i.test(line));
  if (meaningful.length) claims.push({ predicate: 'hasBio', value: meaningful.slice(0, 20).join('\n').slice(0, 8000), confidence: 0.8 });
  claims.push(fieldClaim('sourceUrl', sourceUrl));

  return { entityType: kind, sourceEntityKey, sourceNativeId: sourceEntityKey, displayName, sourceUrl, confidence: 1, claims };
}

function parseGig(html: string, sourceUrl: string): ParsedSource {
  const id = gigId(sourceUrl);
  if (!id) throw new Error(`Lemonrock gig URL has no numeric id: ${sourceUrl}`);
  const text = textFromHtml(html);
  const title = titleFromHtml(html) ?? '';
  const titleCore = title.replace(/\s*-\s*Lemonrock Gig Guide.*$/i, '').trim();
  const titleMatch = titleCore.match(/^(.*?)\s+gig at\s+(.*?)\s+on\s+(.+)$/i);
  const date = extractDate(titleCore) ?? extractDate(text);
  const anchors = anchorsFromHtml(html, sourceUrl);
  const artistName = titleMatch?.[1]?.trim();
  const venueName = titleMatch?.[2]?.replace(/\s+on\s+.*$/i, '').trim();
  const artistAnchor = artistName ? anchors.find((anchor) => anchor.text.trim().toLowerCase() === artistName.toLowerCase() && lemonrockSlug(anchor.href)) : undefined;
  const venueAnchor = venueName ? anchors.find((anchor) => anchor.text.trim().toLowerCase() === venueName.toLowerCase() && lemonrockSlug(anchor.href)) : undefined;
  const artistSlug = artistAnchor ? lemonrockSlug(artistAnchor.href) : undefined;
  const venueSlug = venueAnchor ? lemonrockSlug(venueAnchor.href) : undefined;
  const timeMatch = text.match(/\b(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm)|noon|midnight)\s*(?:-|–|to)\s*(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm)|noon|midnight)/i);
  const singleTime = text.match(/\b(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm)|noon|midnight)\b/i)?.[1];
  const cancelledMatch = text.match(/Cancelled\s+([^\n.]+)(?:\.\s*([^\n]+))?/i);
  const status = /\bCANCELLED\b/i.test(text) ? 'cancelled' : /\bSOLD OUT\b/i.test(text) ? 'sold-out' : undefined;
  const price = text.match(/\|\s*(FREE!|£\s*\d+(?:\.\d{1,2})?[^\n|]*)/i)?.[1]?.trim();
  const posted = text.match(/Posted by\s+([^\n]+?)\s+at\s+([^\n]+?\s+on\s+\d{1,2}\s+\w+)/i);
  const claims: NormalisedSourceClaim[] = [fieldClaim('sourceGigId', id), fieldClaim('sourceUrl', sourceUrl)];
  if (cancelledMatch) {
    claims.push(fieldClaim('cancellationText', cancelledMatch[0].trim()));
    const cancelledAt = extractDate(cancelledMatch[0]);
    if (cancelledAt) claims.push(fieldClaim('cancelledAt', cancelledAt));
  }
  if (posted) {
    claims.push(fieldClaim('postedBy', posted[1].trim()));
    claims.push(fieldClaim('postedAt', posted[2].trim()));
  }
  const event: NormalisedSourceEvent = {
    sourceEventKey: `lemonrock:gig:${id}`,
    sourceNativeId: `lemonrock:gig:${id}`,
    artistName,
    artistExternalId: artistSlug ? `lemonrock:artist:${artistSlug}` : undefined,
    venueName,
    venueExternalId: venueSlug ? `lemonrock:venue:${venueSlug}` : undefined,
    date,
    startTime: time24(timeMatch?.[1] ?? singleTime ?? ''),
    endTime: time24(timeMatch?.[2] ?? ''),
    title: titleCore || `${artistName ?? 'Gig'} at ${venueName ?? 'venue'}`,
    eventUrl: sourceUrl,
    status,
    admissionStatus: price?.toUpperCase().startsWith('FREE') ? 'free' : price ? 'paid' : undefined,
    price,
    contentHash: createHash('sha256').update(html).digest('hex'),
    claims,
  };
  const nextRequests: SourceFanoutRequest[] = [];
  if (artistAnchor && artistSlug) nextRequests.push(request('lemonrock-artist-hydration', 'artist', artistAnchor.href, `lemonrock:artist:${artistSlug}`, artistName));
  if (venueAnchor && venueSlug) nextRequests.push(request('lemonrock-venue-hydration', 'venue', venueAnchor.href, `lemonrock:venue:${venueSlug}`, venueName));
  const warnings: string[] = [];
  if (!date) warnings.push(`Gig ${id} has no parseable date`);
  if (!artistName) warnings.push(`Gig ${id} has no parseable artist name`);
  if (!venueName) warnings.push(`Gig ${id} has no parseable venue name`);
  return { events: [event], nextRequests, parked: [], warnings };
}

function parseProfile(kind: 'artist' | 'venue', html: string, sourceUrl: string, run: SourceRunContext): ParsedSource {
  const entity = profileEntity(kind, html, sourceUrl, run);
  const gigs = gigRequests(html, sourceUrl);
  return { events: [], entities: [entity], nextRequests: gigs, parked: [], warnings: [] };
}

export function parseLemonrock(html: string, sourceUrl: string, run: SourceRunContext): ParsedSource {
  const kind = taskKind(run);
  if (kind === 'artist-index' || kind === 'artist-index-page') return artistIndex(html, sourceUrl);
  if (kind === 'venue-index' || kind === 'venue-index-page') return venueIndex(html, sourceUrl);
  if (kind === 'full-reconcile') return fullReconcile(html, sourceUrl);
  if (kind === 'future-index') return futureIndex(html, sourceUrl);
  if (kind === 'gig-index' || kind === 'new-gigs' || kind === 'cancellations') return listPage(html, sourceUrl);
  if (kind === 'gig') return parseGig(html, sourceUrl);
  if (kind === 'artist') return parseProfile('artist', html, sourceUrl, run);
  if (kind === 'venue') return parseProfile('venue', html, sourceUrl, run);
  return { events: [], parked: [{ reason: `Unsupported Lemonrock task kind: ${kind}` }], warnings: [] };
}
