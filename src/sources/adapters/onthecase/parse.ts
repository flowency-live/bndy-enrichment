import { createHash } from 'node:crypto';
import type {
  NormalisedSourceClaim,
  NormalisedSourceEntity,
  NormalisedSourceEvent,
  ParsedSource,
  SourceFanoutRequest,
  SourceRunContext,
} from '../../runner/types.js';
import {
  anchorsFromHtml,
  bandRef,
  gigRef,
  parseLongDate,
  parseTimePrice,
  onTheCaseLocationFromAddress,
  splitActAtVenue,
  textFromHtml,
  titleFromHtml,
  uniqueBy,
  venueRef,
} from './html.js';

// On The Case (onthecasemusic.co.uk) parser. See
// docs/ONTHECASE-NATIONAL-INGESTION.md. Load-bearing source facts:
//
// - unknown URLs return HTTP 200 with the marketing homepage, so every task
//   kind gates on its expected <title> before trusting the payload;
// - /gigs is the ONLY surface that exposes numeric gig IDs (inside
//   /venues/<vid>/<vslug>/<gigid> links), so events are built there and only
//   there. Venue and band pages list gigs WITHOUT gig IDs; those rows become
//   relationship claims, never derived-key events;
// - /venues is a filtered view. Full venue coverage needs every
//   /venues?location=<x> page plus venue IDs harvested from /gigs;
// - the band <-> venue join exists only on profile pages: venue pages link
//   /bands/<id>/<slug> per gig row, band pages link /venues/<id>/<slug>.

const HOMEPAGE_TITLE_FRAGMENT = 'On The Case Music Services';

const EXPECTED_TITLE: Record<string, RegExp> = {
  'gig-index': /^Gigs\s*:/i,
  'band-index': /^Bands\s*:/i,
  'venue-index': /^Venues/i,
  band: /^Bands\s*:/i,
  venue: /^Venues/i,
  'full-reconcile': /^Gigs\s*:|^On The Case/i,
};

function taskKind(run: SourceRunContext): string {
  const kind = run.task?.kind;
  if (typeof kind === 'string') return kind;
  if (run.sourceId.includes('band-index')) return 'band-index';
  if (run.sourceId.includes('venue-index')) return 'venue-index';
  if (run.sourceId.includes('band-hydration')) return 'band';
  if (run.sourceId.includes('venue-hydration')) return 'venue';
  if (run.sourceId.includes('full-reconcile')) return 'full-reconcile';
  return 'gig-index';
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

function assertExpectedPage(kind: string, html: string): string {
  const title = titleFromHtml(html) ?? '';
  if (title.includes(HOMEPAGE_TITLE_FRAGMENT)) {
    throw new Error(`On The Case structural gate failed: server returned the homepage for a ${kind} task (unknown or removed URL)`);
  }
  const expected = EXPECTED_TITLE[kind];
  if (expected && !expected.test(title)) {
    throw new Error(`On The Case structural gate failed: unexpected title "${title}" for a ${kind} task`);
  }
  return title;
}

const UK_PHONE = /^0\d[\d ]{7,}$/;

function splitAddressPhone(text: string): { address?: string; location?: string; phone?: string } {
  const parts = text.replace(/\s+/g, ' ').trim().split('/').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return {};
  const last = parts[parts.length - 1];
  const addressParts = UK_PHONE.test(last) ? parts.slice(0, -1) : parts;
  const address = addressParts.join(', ') || undefined;
  return {
    address,
    location: address ? onTheCaseLocationFromAddress(address) : undefined,
    ...(UK_PHONE.test(last) ? { phone: last } : {}),
  };
}

function bandHydrationRequest(id: string, slug: string, name?: string): SourceFanoutRequest {
  return request(
    'onthecase-band-hydration',
    'band',
    `https://onthecasemusic.co.uk/bands/${id}/${slug}`,
    `onthecase:band:${id}`,
    name,
  );
}

function venueHydrationRequest(id: string, slug: string, name?: string): SourceFanoutRequest {
  return request(
    'onthecase-venue-hydration',
    'venue',
    `https://onthecasemusic.co.uk/venues/${id}/${slug}`,
    `onthecase:venue:${id}`,
    name,
  );
}

function isNonArtistPerformerLabel(value: string): boolean {
  return /\b(open\s*mic|buskers?(?:\s+night)?|jam\s+night|open\s+stage|music\s+club)\b/i.test(value.trim());
}

function parseGigIndex(html: string, sourceUrl: string, suppressFanout = false): ParsedSource {
  const warnings: string[] = [];
  const events: NormalisedSourceEvent[] = [];
  const blocks = html.split(/<div class="list-item">/i).slice(1);

  for (const block of blocks) {
    const dateMatch = block.match(/<div class="list-item-left">([\s\S]*?)<\/div>/i);
    const date = dateMatch ? parseLongDate(textFromHtml(dateMatch[1])) : undefined;
    for (const row of block.matchAll(/<div class="name">\s*<a href="([^"]+)">([\s\S]*?)<\/a>(?:\s*<br\s*\/?>\s*<span>([\s\S]*?)<\/span>)?[\s\S]*?<div class="price">([\s\S]*?)<\/div>/gi)) {
      const gig = gigRef(new URL(row[1], sourceUrl).toString());
      if (!gig) {
        warnings.push(`gig row link did not carry a gig ID: ${row[1]}`);
        continue;
      }
      const title = textFromHtml(row[2]);
      const { actName, venueName } = splitActAtVenue(title);
      const { address, location, phone } = splitAddressPhone(row[3] ? textFromHtml(row[3]) : '');
      const priceText = textFromHtml(row[4]).split('\n')[0] ?? '';
      const { startTime, admissionStatus, price } = parseTimePrice(priceText);
      if (!date) warnings.push(`gig ${gig.gigId} row had no parseable date`);

      const claims: NormalisedSourceClaim[] = [];
      if (phone) {
        claims.push({ predicate: 'derivedFrom', value: { kind: 'venue-phone', venue: `onthecase:venue:${gig.venueId}`, phone }, evidenceText: row[3] ? textFromHtml(row[3]) : undefined });
      }

      const eventUrl = `https://onthecasemusic.co.uk/venues/${gig.venueId}/${gig.venueSlug}/${gig.gigId}`;
      const event: NormalisedSourceEvent = {
        sourceEventKey: `onthecase:gig:${gig.gigId}`,
        sourceNativeId: gig.gigId,
        artistName: actName && !isNonArtistPerformerLabel(actName) ? actName : undefined,
        venueName: venueName ?? undefined,
        venueExternalId: `onthecase:venue:${gig.venueId}`,
        venueLocation: location,
        venueAddress: address,
        date,
        startTime,
        title,
        eventUrl,
        admissionStatus,
        price,
        claims: claims.length ? claims : undefined,
        data: { venueSlug: gig.venueSlug, ...(actName && isNonArtistPerformerLabel(actName) ? { unresolvedPerformerLabel: actName } : {}) },
      };
      event.contentHash = createHash('sha256').update(JSON.stringify({
        key: event.sourceEventKey, date, startTime, title, admissionStatus, price, address,
      })).digest('hex');
      events.push(event);
    }
  }

  const dedupedEvents = uniqueBy(events, (event) => event.sourceEventKey);
  const venueTasks = uniqueBy(
    dedupedEvents.map((event) => {
      const slug = String((event.data as Record<string, unknown>)?.venueSlug ?? '');
      const id = event.venueExternalId!.split(':')[2];
      return venueHydrationRequest(id, slug, event.venueName);
    }),
    (item) => item.taskKey,
  );

  const isRootListing = !new URL(sourceUrl).search;
  const control: SourceFanoutRequest[] = isRootListing
    ? [request(
        'onthecase-gig-index',
        'gig-inventory-control',
        sourceUrl,
        'onthecase:gig-inventory:root',
        undefined,
        { expectedCount: dedupedEvents.length, inventoryLevel: 'gig-index-root', inventoryCountSource: 'parsed-gig-links' },
      )]
    : [];

  if (isRootListing && dedupedEvents.length === 0) {
    throw new Error('On The Case structural gate failed: the root gig listing parsed to zero gigs on a historically non-empty surface');
  }

  if (suppressFanout) {
    warnings.push('Manual root-only acquisition: venue, band and inventory-control fanout suppressed');
  }

  return {
    events: dedupedEvents,
    nextRequests: suppressFanout ? [] : [...venueTasks, ...control],
    parked: [],
    warnings,
  };
}

function parseBandIndex(html: string, sourceUrl: string): ParsedSource {
  const tasks = uniqueBy(
    anchorsFromHtml(html, sourceUrl)
      .map((anchor) => ({ anchor, ref: bandRef(anchor.href) }))
      .filter((item): item is { anchor: { href: string; text: string }; ref: { id: string; slug: string } } => Boolean(item.ref))
      .map(({ anchor, ref }) => bandHydrationRequest(ref.id, ref.slug, anchor.text || undefined)),
    (item) => item.taskKey,
  );
  const control = request(
    'onthecase-band-index', 'band-inventory-control', sourceUrl,
    'onthecase:band-inventory:root', undefined,
    { expectedCount: tasks.length, inventoryLevel: 'band-directory', inventoryCountSource: 'parsed-profile-links' },
  );
  return { events: [], nextRequests: [...tasks, control], parked: [], warnings: [] };
}

function parseVenueIndex(html: string, sourceUrl: string): ParsedSource {
  const url = new URL(sourceUrl);
  const location = url.searchParams.get('location');
  const venueTasks = uniqueBy(
    anchorsFromHtml(html, sourceUrl)
      .map((anchor) => ({ anchor, ref: venueRef(anchor.href) }))
      .filter((item): item is { anchor: { href: string; text: string }; ref: { id: string; slug: string } } => Boolean(item.ref))
      .map(({ anchor, ref }) => venueHydrationRequest(ref.id, ref.slug, anchor.text || undefined)),
    (item) => item.taskKey,
  );
  const locationTasks = location
    ? []
    : uniqueBy(
        anchorsFromHtml(html, sourceUrl)
          .filter((anchor) => /\/venues\?location=/.test(anchor.href))
          .map((anchor) => {
            const slug = new URL(anchor.href).searchParams.get('location') ?? anchor.text.toLowerCase();
            return request('onthecase-venue-index', 'venue-index', anchor.href, `onthecase:venue-location:${slug}`, anchor.text);
          }),
        (item) => item.taskKey,
      );
  const control = request(
    'onthecase-venue-index', 'venue-inventory-control', sourceUrl,
    `onthecase:venue-inventory:${location ?? 'default'}`, undefined,
    { expectedCount: venueTasks.length, inventoryLevel: 'venue-directory-page', inventoryCountSource: 'parsed-profile-links', location: location ?? 'default' },
  );
  return { events: [], nextRequests: [...venueTasks, ...locationTasks, control], parked: [], warnings: [] };
}

type ProfileRow = { linkId: string; linkSlug: string; linkName: string; date?: string; startTime?: string; admissionStatus?: string; price?: string };

function profileGigRows(html: string, sourceUrl: string, linkKind: 'band' | 'venue'): ProfileRow[] {
  const rows: ProfileRow[] = [];
  const refFor = linkKind === 'band' ? bandRef : venueRef;
  const sections = html.split(/<h2 style="font-size:19px;">/i).slice(1);
  for (const section of sections) {
    const date = parseLongDate(textFromHtml(section.slice(0, section.indexOf('</h2>'))));
    for (const row of section.matchAll(/<div class="name">\s*<a href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<div class="price">([\s\S]*?)<\/div>/gi)) {
      const ref = refFor(new URL(row[1], sourceUrl).toString());
      if (!ref) continue;
      const priceText = textFromHtml(row[3]).split('\n')[0] ?? '';
      const { startTime, admissionStatus, price } = parseTimePrice(priceText);
      rows.push({ linkId: ref.id, linkSlug: ref.slug, linkName: textFromHtml(row[2]).trim(), date, startTime, admissionStatus, price });
    }
  }
  return rows;
}

function parseBandProfile(html: string, sourceUrl: string, warnOn: string[]): ParsedSource {
  const ref = bandRef(sourceUrl);
  if (!ref) throw new Error(`On The Case band task URL is not a band profile: ${sourceUrl}`);
  const heading = html.match(/<div class="gigs-item">\s*<h2>([\s\S]*?)<\/h2>/i);
  const headingLines = heading ? textFromHtml(heading[1]).split('\n').map((line) => line.trim()).filter(Boolean) : [];
  const name = headingLines[0];
  const genreLine = headingLines[1];
  if (!name) warnOn.push(`band ${ref.id} profile had no parseable name heading`);
  const bio = html.match(/<\/h2>\s*<\/div>\s*<div style="clear:both;"><\/div>\s*<p>([\s\S]*?)<\/p>/i);
  const bioText = bio ? textFromHtml(bio[1]).trim() : undefined;
  const claims: NormalisedSourceClaim[] = [];
  if (name) claims.push({ predicate: 'hasName', value: name });
  for (const genre of (genreLine ?? '').split('/').map((genre) => genre.trim()).filter(Boolean)) {
    claims.push({ predicate: 'hasGenre', value: genre, evidenceText: genreLine });
  }
  if (bioText) claims.push({ predicate: 'hasBio', value: bioText });
  const rows = profileGigRows(html, sourceUrl, 'venue');
  for (const row of rows) {
    claims.push({ predicate: 'derivedFrom', value: {
      kind: 'performsAt', venue: `onthecase:venue:${row.linkId}`, venueName: row.linkName || undefined,
      date: row.date, startTime: row.startTime, admissionStatus: row.admissionStatus, price: row.price,
    }});
  }
  const entity: NormalisedSourceEntity = {
    entityType: 'artist', sourceEntityKey: `onthecase:band:${ref.id}`, sourceNativeId: ref.id,
    displayName: name, sourceUrl, claims,
  };
  // Bounded fanout: gig -> venue -> band. Band hydration never recursively expands back to venues.
  return { events: [], entities: [entity], nextRequests: [], parked: [], warnings: warnOn };
}

function parseVenueProfile(html: string, sourceUrl: string, warnOn: string[]): ParsedSource {
  const ref = venueRef(sourceUrl);
  if (!ref) throw new Error(`On The Case venue task URL is not a venue profile: ${sourceUrl}`);
  const heading = html.match(/<div class="gigs-item">\s*<h2>([\s\S]*?)<\/h2>/i);
  const headingLines = heading ? textFromHtml(heading[1]).split('\n').map((line) => line.trim()).filter(Boolean) : [];
  const name = headingLines[0];
  const addressLine = headingLines[1];
  if (!name) warnOn.push(`venue ${ref.id} profile had no parseable name heading`);
  const paragraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)]
    .map((match) => textFromHtml(match[1]).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const factsText = paragraphs.find((text) => /Capacity:|Accessible:|Food:/i.test(text));
  const bioText = paragraphs.filter((text) => text !== factsText && text.length > 20).join('\n\n') || undefined;
  const { address, location, phone } = splitAddressPhone(addressLine ?? '');
  const claims: NormalisedSourceClaim[] = [];
  if (name) claims.push({ predicate: 'hasName', value: name });
  if (location) claims.push({ predicate: 'hasLocation', value: location, evidenceText: addressLine });
  if (address) claims.push({ predicate: 'hasAddress', value: address, evidenceText: addressLine });
  if (bioText) claims.push({ predicate: 'hasBio', value: bioText });
  if (phone) claims.push({ predicate: 'derivedFrom', value: { kind: 'venue-phone', phone } });
  if (factsText) {
    const facts: Record<string, string> = {};
    const capacity = factsText.match(/Capacity:\s*([\d,]+)/i);
    const accessible = factsText.match(/Accessible:\s*(\w+)/i);
    const food = factsText.match(/Food:\s*(\w+)/i);
    if (capacity) facts.capacity = capacity[1];
    if (accessible) facts.accessible = accessible[1];
    if (food) facts.food = food[1];
    claims.push({ predicate: 'derivedFrom', value: { kind: 'venue-facts', ...facts }, evidenceText: factsText });
  }
  const rows = profileGigRows(html, sourceUrl, 'band');
  for (const row of rows) {
    claims.push({ predicate: 'derivedFrom', value: {
      kind: 'performedBy', band: `onthecase:band:${row.linkId}`, bandName: row.linkName || undefined,
      date: row.date, startTime: row.startTime, admissionStatus: row.admissionStatus, price: row.price,
    }});
  }
  const entity: NormalisedSourceEntity = {
    entityType: 'venue', sourceEntityKey: `onthecase:venue:${ref.id}`, sourceNativeId: ref.id,
    displayName: name, sourceUrl, claims,
  };
  const bandTasks = uniqueBy(
    rows.map((row) => bandHydrationRequest(row.linkId, row.linkSlug, row.linkName || undefined)),
    (item) => item.taskKey,
  );
  return { events: [], entities: [entity], nextRequests: bandTasks, parked: [], warnings: warnOn };
}

function parseFullReconcile(): ParsedSource {
  return {
    events: [],
    nextRequests: [request('onthecase-gig-index', 'gig-index', 'https://onthecasemusic.co.uk/gigs')],
    parked: [],
    warnings: [],
  };
}

export function parseOnTheCase(html: string, sourceUrl: string, run: SourceRunContext): ParsedSource {
  const kind = taskKind(run);
  const fanoutMode = run.task?.fanoutMode;
  if (fanoutMode !== undefined && fanoutMode !== 'none') {
    throw new Error(`On The Case parser does not understand fanout mode "${String(fanoutMode)}"`);
  }
  if (fanoutMode === 'none'
    && (run.reason !== 'manual' || kind !== 'gig-index' || Boolean(new URL(sourceUrl).search))) {
    throw new Error('On The Case fanoutMode=none is allowed only for a manual root gig-index acquisition');
  }
  if (kind === 'full-reconcile') return parseFullReconcile();
  if (kind.endsWith('-inventory-control')) return { events: [], parked: [], warnings: [], snapshot: false };
  assertExpectedPage(kind, html);
  const warnings: string[] = [];
  switch (kind) {
    case 'gig-index': return parseGigIndex(html, sourceUrl, fanoutMode === 'none');
    case 'band-index': return parseBandIndex(html, sourceUrl);
    case 'venue-index': return parseVenueIndex(html, sourceUrl);
    case 'band': return parseBandProfile(html, sourceUrl, warnings);
    case 'venue': return parseVenueProfile(html, sourceUrl, warnings);
    default: throw new Error(`On The Case parser does not understand task kind "${kind}"`);
  }
}
