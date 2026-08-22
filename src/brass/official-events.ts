import crypto from 'node:crypto';
import { EventCandidateSchema, type EventCandidate } from '../domain/schema.js';
import { partitionEventsForEdition } from '../editions/event-processing.js';

export interface OfficialSiteEventDiscovery {
  sourcePages: string[];
  events: EventCandidate[];
  heldEvents: EventCandidate[];
  expansionEligibleEvents: EventCandidate[];
  errors: Array<{ url: string; error: string }>;
}

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const decoded = value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return decoded || undefined;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return clean(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  return undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function flattenJsonLd(node: unknown, out: Record<string, unknown>[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) flattenJsonLd(item, out);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const graph = obj['@graph'];
  if (graph) flattenJsonLd(graph, out);
  out.push(obj);
}

function isEvent(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  if (typeof type === 'string') return type.toLowerCase() === 'event' || type.toLowerCase().endsWith('event');
  if (Array.isArray(type)) return type.some((value) => typeof value === 'string' && (value.toLowerCase() === 'event' || value.toLowerCase().endsWith('event')));
  return false;
}

function normaliseDateTime(value: string): { date: string; time?: string } | null {
  const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return null;
  const timeMatch = value.match(/T(\d{2}):(\d{2})/);
  return { date: dateMatch[1], time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : undefined };
}

function eventLocation(node: Record<string, unknown>): { venueName?: string; town?: string } {
  const location = record(node.location);
  const venueName = firstString(location.name) ?? firstString(node.location);
  const address = record(location.address);
  const town = firstString(address.addressLocality) ?? firstString(address.addressRegion);
  return { venueName, town };
}

function offers(node: Record<string, unknown>): Record<string, unknown>[] {
  const raw = node.offers;
  if (Array.isArray(raw)) return raw.map(record).filter((item) => Object.keys(item).length > 0);
  const one = record(raw);
  return Object.keys(one).length ? [one] : [];
}

function admission(node: Record<string, unknown>, offerRows: Record<string, unknown>[]) {
  if (node.isAccessibleForFree === true) {
    return { status: 'FREE_CONFIRMED' as const, confidence: 0.99, evidenceUrls: [] as string[], reason: 'Official schema.org Event marks isAccessibleForFree=true' };
  }

  const price = offerRows.map((offer) => offer.price).find((value) => typeof value === 'number' || (typeof value === 'string' && value.trim()));
  if (price !== undefined) {
    const numeric = Number(price);
    if (Number.isFinite(numeric) && numeric === 0) {
      return { status: 'FREE_CONFIRMED' as const, confidence: 0.98, priceText: String(price), evidenceUrls: [] as string[], reason: 'Official event offer price is zero' };
    }
    return { status: 'PAID_CONFIRMED' as const, confidence: 0.98, priceText: String(price), evidenceUrls: [] as string[], reason: 'Official event offer contains a ticket price' };
  }

  if (offerRows.length > 0) {
    return { status: 'PAID_CONFIRMED' as const, confidence: 0.9, evidenceUrls: [] as string[], reason: 'Official event includes ticket offer metadata' };
  }

  return { status: 'UNKNOWN' as const, confidence: 0.65, evidenceUrls: [] as string[], reason: 'Official event found but admission not explicitly stated' };
}

function absoluteUrl(value: string | undefined, pageUrl: string): string | undefined {
  if (!value) return undefined;
  try { return new URL(value, pageUrl).toString(); } catch { return undefined; }
}

export function extractOfficialEventsFromHtml(html: string, pageUrl: string, bandName: string): EventCandidate[] {
  const nodes: Record<string, unknown>[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { flattenJsonLd(JSON.parse(match[1]), nodes); } catch { /* malformed plugin JSON-LD */ }
  }

  const result: EventCandidate[] = [];
  for (const node of nodes.filter(isEvent)) {
    const start = firstString(node.startDate);
    if (!start) continue;
    const dateTime = normaliseDateTime(start);
    if (!dateTime) continue;
    const { venueName, town } = eventLocation(node);
    if (!venueName) continue;

    const offerRows = offers(node);
    const eventUrl = absoluteUrl(firstString(node.url), pageUrl) ?? pageUrl;
    const ticketUrl = offerRows.map((offer) => absoluteUrl(firstString(offer.url), pageUrl)).find(Boolean);
    const admissionInfo = admission(node, offerRows);
    admissionInfo.evidenceUrls = [pageUrl];
    const priceText = admissionInfo.priceText;

    const title = firstString(node.name);
    const cancelled = String(node.eventStatus ?? '').toLowerCase().includes('cancelled');
    const ticketing = admissionInfo.status === 'FREE_CONFIRMED'
      ? { expected: false, status: 'not_applicable' as const, evidenceUrls: [pageUrl] }
      : ticketUrl
        ? { expected: true, status: 'found' as const, ticketUrl, priceText, evidenceUrls: [pageUrl] }
        : admissionInfo.status === 'PAID_CONFIRMED'
          ? { expected: true, status: 'not_found' as const, priceText, evidenceUrls: [pageUrl] }
          : { expected: true, status: 'unknown' as const, evidenceUrls: [pageUrl] };

    const candidate = EventCandidateSchema.parse({
      artistName: bandName,
      venueName,
      town,
      eventDate: dateTime.date,
      startTime: dateTime.time,
      timezone: 'Europe/London',
      cancelled,
      confidence: 0.96,
      sourceUrls: [pageUrl],
      eventUrl,
      ticketing,
      admission: admissionInfo,
      supportActs: [],
      notes: title && title.toLowerCase() !== bandName.toLowerCase() ? title : undefined,
    });
    result.push(candidate);
  }

  const dedupe = new Map<string, EventCandidate>();
  for (const candidate of result) {
    const key = crypto.createHash('sha1').update([
      candidate.artistName.toLowerCase(),
      candidate.venueName.toLowerCase(),
      candidate.eventDate,
      candidate.startTime ?? '',
    ].join('\u001f')).digest('hex');
    if (!dedupe.has(key)) dedupe.set(key, candidate);
  }
  return [...dedupe.values()];
}

function discoverPageUrls(html: string, officialWebsite: string): string[] {
  const root = new URL(officialWebsite);
  const candidates = new Set<string>([
    officialWebsite,
    `${root.origin}/events`,
    `${root.origin}/concerts`,
    `${root.origin}/diary`,
    `${root.origin}/calendar`,
    `${root.origin}/whats-on`,
    `${root.origin}/whatson`,
  ]);

  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1];
    const label = clean(match[2]) ?? '';
    if (!/(event|concert|diary|calendar|what.?s.?on|performance)/i.test(`${href} ${label}`)) continue;
    try {
      const url = new URL(href, officialWebsite);
      if (url.origin === root.origin) candidates.add(url.toString());
    } catch { /* ignore invalid href */ }
  }
  return [...candidates].slice(0, 12);
}

async function fetchHtml(url: string): Promise<{ url: string; html: string } | null> {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'bndy-brass-research/1.0 (+https://bndy.live)', accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('text/html')) return null;
    return { url: response.url || url, html: await response.text() };
  } catch {
    return null;
  }
}

export async function discoverOfficialSiteEvents(officialWebsite: string, bandName: string): Promise<OfficialSiteEventDiscovery> {
  const errors: Array<{ url: string; error: string }> = [];
  const homepage = await fetchHtml(officialWebsite);
  if (!homepage) return { sourcePages: [], events: [], heldEvents: [], expansionEligibleEvents: [], errors: [{ url: officialWebsite, error: 'homepage_unavailable' }] };

  const urls = discoverPageUrls(homepage.html, homepage.url);
  const pages: Array<{ url: string; html: string }> = [homepage];
  for (const url of urls) {
    if (url === homepage.url || url === officialWebsite) continue;
    const page = await fetchHtml(url);
    if (page) pages.push(page);
  }

  const candidates = pages.flatMap((page) => extractOfficialEventsFromHtml(page.html, page.url, bandName));
  const dedupe = new Map<string, EventCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.artistName.toLowerCase()}|${candidate.venueName.toLowerCase()}|${candidate.eventDate}|${candidate.startTime ?? ''}`;
    const existing = dedupe.get(key);
    if (!existing || candidate.confidence > existing.confidence) dedupe.set(key, candidate);
  }

  const partitioned = partitionEventsForEdition([...dedupe.values()], 'brass');
  return {
    sourcePages: [...new Set(pages.map((page) => page.url))],
    events: partitioned.publishable,
    heldEvents: partitioned.held,
    expansionEligibleEvents: partitioned.expansionEligible,
    errors,
  };
}
