import { createHash, randomUUID } from 'node:crypto';
import {
  EventCandidateSchema,
  KnowledgeClaimSchema,
  SourceObservationSchema,
  type EventCandidate,
  type KnowledgeClaim,
  type SourceObservation,
} from '../knowledge/types.js';
import {
  canonicaliseVenue,
  detectRegion,
  isMultiActVenue,
  isSpecialistVenue,
  lookupVenueCanonical,
  slugNormalise,
} from './klma-venue-aliases.js';

export const KLMA_SOURCE_ID = 'klma-stoke-gig-list';
export const KLMA_SHEET_ID = '1atEqyN-RI1smTzSaCtMUSui7oNp2dhCpiGoAfY5ySno';
export const KLMA_GID = '831966245';
export const KLMA_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${KLMA_SHEET_ID}/export?format=csv&gid=${KLMA_GID}`;
export const KLMA_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${KLMA_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${KLMA_GID}`;

export type KlmaRawRow = {
  rowIndex: number;
  date: string;
  artist: string;
  venue: string;
  time: string;
  genre: string;
  url: string;
};

export type KlmaNormalisedEvent = {
  sourceEventKey: string;
  sourceNativeId: string;
  date: string;
  startTime: string;
  startTimeDefaulted: boolean;
  artistName: string;
  artistExternalId: string;
  artistLocation: string;
  venueName: string;
  venueExternalId: string;
  town: string;
  genre?: string;
  eventUrl?: string;
  rawRowRef: string;
  rowIndex: number;
  warnings: string[];
};

export type KlmaFetchResult = {
  body: string;
  sourceUrl: string;
  fetchMethod: 'export_csv' | 'gviz_csv';
  httpStatus: number;
};

export type KnowledgeBuildResult = {
  observation: SourceObservation;
  claims: KnowledgeClaim[];
  candidates: EventCandidate[];
};

function hash(value: string, length = 16): string {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ',' && !quoted) {
      record.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      record.push(field);
      field = '';
      if (record.some((value) => value.trim().length > 0)) records.push(record);
      record = [];
      continue;
    }

    field += char;
  }

  record.push(field);
  if (record.some((value) => value.trim().length > 0)) records.push(record);
  return records;
}

function fieldsToCsv(fields: string[]): string {
  return fields
    .map((field) => `"${field.replace(/"/g, '""')}"`)
    .join(',');
}

const KLMA_HEADER = ['Date', 'Artist', 'Venue', 'Time', 'Genre', 'URL'];

function hasHeader(records: string[][]): boolean {
  const header = (records[0] ?? []).slice(0, 6).map((value) => value.trim().toLowerCase());
  return header[0]?.includes('date') === true
    && header[1]?.includes('artist') === true
    && header[2]?.includes('venue') === true;
}

function hasLeadingHelperColumn(records: string[][]): boolean {
  const first = records[0] ?? [];
  if (first.length < 7) return false;
  if (first[0]?.trim() === '') return true;
  return hasHeader(records.map((fields) => fields.slice(1, 7)));
}

function metadataLike(fields: string[]): boolean {
  const text = fields.slice(0, 4).join(' ');
  const header = fields.slice(0, 3).map((value) => value.trim().toLowerCase());
  if (header[0] === 'date' && header[1] === 'artist' && header[2]?.startsWith('venue')) return true;
  return /you can add|add your gig|keep live music alive|@everyone|there's got to be way more gigs|this is the form/i.test(text)
    || /\/(?:0\d{2,3}|20[3-9]\d|204\d)$/.test(fields[0]?.trim() ?? '');
}

/**
 * Convert either Google Sheets export shape into the canonical six-column KLMA
 * CSV consumed by the parser. The live sheet is headerless and carries a
 * leading helper column, while stored donor fixtures already have a header.
 * Header synthesis is allowed only after multiple real event rows prove the
 * expected date/artist/venue shape, so a changed sheet still fails closed.
 */
export function prepareKlmaCsv(csv: string): string {
  let records = parseCsvRecords(csv);
  if (!records.length) throw new Error('KLMA structural gate failed: empty CSV');

  if (!hasHeader(records) && hasLeadingHelperColumn(records)) {
    records = records.map((fields) => fields.slice(1, 7));
  }

  if (hasHeader(records)) {
    return records.map((fields) => fieldsToCsv(fields.slice(0, 6))).join('\n');
  }

  const sample = records.slice(0, 50);
  const eventRows = sample.filter((fields) => (
    fields.length >= 3
    && parseKlmaDate(fields[0] ?? '') !== null
    && Boolean(fields[1]?.trim())
    && Boolean(fields[2]?.trim())
  ));
  const recognisableRows = eventRows.length + sample.filter(metadataLike).length;
  if (eventRows.length < 2 || recognisableRows < 3) {
    throw new Error('KLMA structural gate failed: expected Date, Artist and Venue columns');
  }

  return [KLMA_HEADER, ...records]
    .map((fields) => fieldsToCsv(fields.slice(0, 6)))
    .join('\n');
}

export function realignGvizCsv(csv: string): string {
  return parseCsvRecords(csv)
    .map((fields) => fieldsToCsv(fields.slice(1, 7)))
    .join('\n');
}

export async function fetchKlmaCsv(): Promise<KlmaFetchResult> {
  const preferred = await fetch(KLMA_EXPORT_URL);
  if (preferred.ok) {
    return {
      body: prepareKlmaCsv(await preferred.text()),
      sourceUrl: KLMA_EXPORT_URL,
      fetchMethod: 'export_csv',
      httpStatus: preferred.status,
    };
  }

  const fallback = await fetch(KLMA_GVIZ_URL);
  if (!fallback.ok) {
    throw new Error(`KLMA fetch failed: export=${preferred.status}, gviz=${fallback.status}`);
  }

  return {
    body: prepareKlmaCsv(await fallback.text()),
    sourceUrl: KLMA_GVIZ_URL,
    fetchMethod: 'gviz_csv',
    httpStatus: fallback.status,
  };
}

export function parseKlmaCsv(csv: string): KlmaRawRow[] {
  const records = parseCsvRecords(prepareKlmaCsv(csv));
  return records.slice(1).map((fields, index) => ({
    rowIndex: index + 1,
    date: fields[0]?.trim() ?? '',
    artist: fields[1]?.trim() ?? '',
    venue: fields[2]?.trim() ?? '',
    time: fields[3]?.trim() ?? '',
    genre: fields[4]?.trim() ?? '',
    url: fields[5]?.trim() ?? '',
  }));
}

export function hasKlmaCsvShape(csv: string): boolean {
  try {
    prepareKlmaCsv(csv);
    return true;
  } catch {
    return false;
  }
}

function validDateParts(year: number, month: number, day: number): boolean {
  if (year < 2020 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (!validDateParts(year, month, day)) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseKlmaDate(raw: string): string | null {
  const value = raw.trim();
  if (!value || /1899/.test(value)) return null;

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const rawYear = Number(numeric[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    // KLMA is a UK source: ambiguous numeric dates are day/month/year.
    return isoDate(year, second, first);
  }

  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const monthFirst = value.match(/^(?:[A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})$/i);
  if (monthFirst) return isoDate(Number(monthFirst[3]), months[monthFirst[1]!.toLowerCase()] ?? 0, Number(monthFirst[2]));
  const dayFirst = value.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)[,]?\s+(\d{4})$/i);
  if (dayFirst) return isoDate(Number(dayFirst[3]), months[dayFirst[2]!.toLowerCase()] ?? 0, Number(dayFirst[1]));

  return null;
}

function to24Hour(hour: number, minute: number, meridiem?: string): string | null {
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;
  let h = hour;
  if (meridiem) {
    const lower = meridiem.toLowerCase();
    if (h > 12) return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (lower === 'pm' && h < 12) h += 12;
    if (lower === 'am' && h === 12) h = 0;
  } else if (h >= 1 && h <= 11) {
    // KLMA gigs are overwhelmingly evening unless explicitly marked otherwise.
    h += 12;
  }
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseKlmaTime(raw: string): { time: string; defaulted: boolean; warning?: string } {
  const value = raw.trim();
  if (!value || /^tbc$/i.test(value) || /^[£$€]\s*\d+(?:[.,]\d{1,2})?\s*(?:adv(?:ance)?|door|otd|on\s+the\s+door)?$/i.test(value)) {
    return { time: '21:00', defaulted: true, warning: value ? `No stage time in '${value}'` : 'Missing stage time' };
  }

  if (/^0?7:12(?::00)?(?:\s*(?:am|pm))?$/i.test(value)) {
    return { time: '21:00', defaulted: true, warning: 'Known KLMA spreadsheet 07:12 corruption' };
  }

  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b.*\d{4}/i.test(value)) {
    return { time: '21:00', defaulted: true, warning: 'Date leaked into time column' };
  }

  const matinee = value.match(/matinee(?:\s+show)?\s*(\d{1,2})(?::(\d{2}))?\s*[-–—]/i);
  if (matinee) {
    let hour = Number(matinee[1]);
    const minute = Number(matinee[2] ?? '00');
    if (hour < 12) hour += 12;
    return { time: to24Hour(hour, minute) ?? '15:00', defaulted: false };
  }

  const cleaned = value
    .replace(/^\(|\)$/g, '')
    .replace(/[£$€]\s*\d+(?:[.,]\d{1,2})?\s*(?:adv(?:ance)?|door|otd|on\s+the\s+door)?/gi, ' ')
    .replace(/\b(tickets?|free\s*entry|all\s*welcome)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/\b12\s*noon\b/i.test(cleaned)) return { time: '12:00', defaulted: false };

  // KLMA often uses a hyphen as the minute separator: 4-30, 7-30pm.
  // A one-digit right side remains a range (for example 3-7pm).
  const hyphenTime = cleaned.match(/(?:^|\s)(\d{1,2})[-–—](\d{2})\s*(am|pm)?\b/i);
  if (hyphenTime) {
    let hour = Number(hyphenTime[1]);
    const minute = Number(hyphenTime[2]);
    if (!hyphenTime[3] && hour >= 1 && hour <= 6) hour += 12;
    const parsed = to24Hour(hour, minute, hyphenTime[3]);
    if (parsed) return { time: parsed, defaulted: false };
  }

  const match = cleaned.match(/(?:^|\s)(\d{1,2})(?::|\.)(\d{2})(?::\d{2})?\s*(am|pm)?\b/i);
  if (match) {
    const parsed = to24Hour(Number(match[1]), Number(match[2]), match[3]);
    if (parsed) return { time: parsed, defaulted: false };
  }

  const spaced = cleaned.match(/(?:^|\s)(\d{1,2})\s+(\d{2})\s*(am|pm)\b/i);
  if (spaced) {
    const parsed = to24Hour(Number(spaced[1]), Number(spaced[2]), spaced[3]);
    if (parsed) return { time: parsed, defaulted: false };
  }

  const compact = cleaned.match(/(?:^|\s)(\d{1,2})(\d{2})\s*(am|pm)\b/i);
  if (compact) {
    const parsed = to24Hour(Number(compact[1]), Number(compact[2]), compact[3]);
    if (parsed) return { time: parsed, defaulted: false };
  }

  // A one-digit right side is a range. Use the start and inherit its meridiem.
  const range = cleaned.match(/(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*[-–—]\s*\d{1,2}(?::\d{2})?\s*(am|pm)\b/i);
  if (range) {
    const parsed = to24Hour(Number(range[1]), Number(range[2] ?? '00'), range[3]);
    if (parsed) return { time: parsed, defaulted: false };
  }

  const hourOnly = cleaned.match(/(?:^|\s)(\d{1,2})\s*(am|pm)\b/i);
  if (hourOnly) {
    const parsed = to24Hour(Number(hourOnly[1]), 0, hourOnly[2]);
    if (parsed) return { time: parsed, defaulted: false };
  }

  const bare = cleaned.match(/^(\d{1,2})$/);
  if (bare) {
    const parsed = to24Hour(Number(bare[1]), 0);
    if (parsed) return { time: parsed, defaulted: false };
  }

  return { time: '21:00', defaulted: true, warning: `Could not parse stage time '${value}'` };
}

function canonicalText(value: string): string {
  return value
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ');
}

export function inferTown(venue: string): { town: string; defaulted: boolean } {
  const detected = detectRegion(venue);
  return { town: detected.city, defaulted: detected.city === '' };
}

export type KlmaParkedReason =
  | 'date_sentinel'
  | 'form_metadata'
  | 'non_artist_event'
  | 'unparseable'
  | 'past_event'
  | 'specialist_venue'
  | 'multi_act'
  | 'ambiguous_venue_location';

function isMetadataRow(row: KlmaRawRow): boolean {
  return metadataLike([row.date, row.artist, row.venue, row.time]);
}

export function klmaRowParkingReason(row: KlmaRawRow, today: string): KlmaParkedReason | null {
  if (/\b1899\b/.test(row.date)) return 'date_sentinel';
  if (isMetadataRow(row)) return 'form_metadata';
  if (!row.artist.trim() || !row.venue.trim()) return 'non_artist_event';

  const date = parseKlmaDate(row.date);
  if (!date) return 'unparseable';
  if (date < today) return 'past_event';

  const rawVenue = canonicalText(row.venue);
  const venueName = lookupVenueCanonical(rawVenue) ?? canonicaliseVenue(rawVenue);
  const venueSlug = slugNormalise(venueName);
  if (isSpecialistVenue(venueSlug)) return 'specialist_venue';
  if (isMultiActVenue(venueSlug)) return 'multi_act';
  if (!detectRegion(venueName).city) return 'ambiguous_venue_location';
  return null;
}

export function normaliseKlmaRows(rows: KlmaRawRow[], today: string): KlmaNormalisedEvent[] {
  const result: KlmaNormalisedEvent[] = [];

  for (const row of rows) {
    if (klmaRowParkingReason(row, today)) continue;
    const date = parseKlmaDate(row.date);
    if (!date) continue;

    const artistName = canonicalText(row.artist);
    const rawVenue = canonicalText(row.venue);
    const venueName = lookupVenueCanonical(rawVenue) ?? canonicaliseVenue(rawVenue);

    const town = inferTown(venueName);
    const time = parseKlmaTime(row.time);
    const eventUrl = /^https?:\/\//i.test(row.url)
      ? row.url
      : /^www\./i.test(row.url) ? `https://${row.url}` : undefined;
    const sourceEventKey = `klma-${hash(`${date}|${venueName.toLowerCase()}|${artistName.toLowerCase()}`, 12)}`;
    const warnings = [time.warning, town.defaulted ? `Venue location is ambiguous for '${venueName}'` : undefined]
      .filter((value): value is string => Boolean(value));

    result.push({
      sourceEventKey,
      sourceNativeId: sourceEventKey,
      date,
      startTime: time.time,
      startTimeDefaulted: time.defaulted,
      artistName,
      artistExternalId: `klma-artist-${hash(artistName.toLowerCase(), 12)}`,
      artistLocation: 'Staffordshire UK',
      venueName,
      venueExternalId: `klma-venue-${hash(venueName.toLowerCase(), 12)}`,
      town: town.town,
      genre: row.genre || undefined,
      eventUrl,
      // Content-addressed: a row's position in a shared sheet is not a fact about the gig.
      rawRowRef: `${date}:${artistName}@${venueName}`,
      rowIndex: row.rowIndex,
      warnings,
    });
  }

  return result;
}

function claimId(observationId: string, subjectKey: string, predicate: string, value: unknown): string {
  return `claim-${hash(`${observationId}|${subjectKey}|${predicate}|${JSON.stringify(value)}`, 24)}`;
}

export function buildKlmaKnowledge(
  events: KlmaNormalisedEvent[],
  fetched: KlmaFetchResult,
  observedAt = new Date().toISOString(),
): KnowledgeBuildResult {
  const observation = SourceObservationSchema.parse({
    id: `obs-${randomUUID()}`,
    sourceId: KLMA_SOURCE_ID,
    observedAt,
    sourceUrl: fetched.sourceUrl,
    captureHash: hash(fetched.body, 64),
    enumerationMethod: fetched.fetchMethod,
    complete: true,
    paginationComplete: true,
    captureStable: true,
    itemCount: events.length,
    futureItemCount: events.length,
    httpStatus: fetched.httpStatus,
    contentType: 'text/csv',
  });

  const claims: KnowledgeClaim[] = [];
  const candidates: EventCandidate[] = [];

  const addClaim = (
    subject: { type: 'artist-candidate' | 'venue-candidate' | 'event-candidate'; key: string },
    predicate: Parameters<typeof KnowledgeClaimSchema.parse>[0] extends never ? never : string,
    value: unknown,
    evidenceText?: string,
  ): string => {
    const id = claimId(observation.id, subject.key, predicate, value);
    const claim = KnowledgeClaimSchema.parse({
      id,
      observationId: observation.id,
      sourceId: KLMA_SOURCE_ID,
      subject,
      predicate,
      value,
      confidence: 0.9,
      evidence: {
        sourceUrl: fetched.sourceUrl,
        text: evidenceText,
        contentHash: observation.captureHash,
      },
      assertedAt: observedAt,
      observedAt,
      status: 'active',
    });
    claims.push(claim);
    return id;
  };

  for (const event of events) {
    const artistKey = `artist:${event.artistExternalId}`;
    const venueKey = `venue:${event.venueExternalId}`;
    const eventKey = `event:${event.sourceEventKey}`;
    const supporting: string[] = [];

    supporting.push(addClaim({ type: 'artist-candidate', key: artistKey }, 'hasName', event.artistName, event.rawRowRef));
    if (event.genre) supporting.push(addClaim({ type: 'artist-candidate', key: artistKey }, 'hasGenre', event.genre, event.rawRowRef));
    supporting.push(addClaim({ type: 'venue-candidate', key: venueKey }, 'hasName', event.venueName, event.rawRowRef));
    supporting.push(addClaim({ type: 'venue-candidate', key: venueKey }, 'locatedIn', event.town, event.rawRowRef));
    supporting.push(addClaim({ type: 'event-candidate', key: eventKey }, 'hasPerformer', { type: 'artist-candidate', key: artistKey }, event.rawRowRef));
    supporting.push(addClaim({ type: 'event-candidate', key: eventKey }, 'hasPerformerName', event.artistName, event.rawRowRef));
    supporting.push(addClaim({ type: 'event-candidate', key: eventKey }, 'occursAt', { type: 'venue-candidate', key: venueKey }, event.rawRowRef));
    supporting.push(addClaim({ type: 'event-candidate', key: eventKey }, 'hasVenueName', event.venueName, event.rawRowRef));
    supporting.push(addClaim({ type: 'event-candidate', key: eventKey }, 'occursOn', event.date, event.rawRowRef));
    supporting.push(addClaim({ type: 'event-candidate', key: eventKey }, 'startsAt', event.startTime, event.rawRowRef));
    supporting.push(addClaim({ type: 'event-candidate', key: eventKey }, 'hasStatus', 'scheduled', event.rawRowRef));
    supporting.push(addClaim({ type: 'event-candidate', key: eventKey }, 'reportedBy', KLMA_SOURCE_ID, event.rawRowRef));
    supporting.push(addClaim({ type: 'event-candidate', key: eventKey }, 'derivedFrom', observation.id, event.rawRowRef));
    if (event.eventUrl) supporting.push(addClaim({ type: 'event-candidate', key: eventKey }, 'hasEventUrl', event.eventUrl, event.rawRowRef));

    candidates.push(EventCandidateSchema.parse({
      candidateKey: eventKey,
      sourceId: KLMA_SOURCE_ID,
      sourceEventKey: event.sourceEventKey,
      sourceNativeId: event.sourceNativeId,
      artistName: event.artistName,
      venueName: event.venueName,
      date: event.date,
      startTime: event.startTime,
      eventUrl: event.eventUrl,
      supportingClaimIds: supporting,
      confidence: 0.9,
      observedAt,
    }));
  }

  return { observation, claims, candidates };
}
