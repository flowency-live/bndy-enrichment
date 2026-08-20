import { createHash, randomUUID } from 'node:crypto';
import {
  EventCandidateSchema,
  KnowledgeClaimSchema,
  SourceObservationSchema,
  type EventCandidate,
  type KnowledgeClaim,
  type SourceObservation,
} from '../knowledge/types.js';

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

const KNOWN_TOWNS = [
  'Stoke-on-Trent',
  'Newcastle-under-Lyme',
  'Hanley',
  'Burslem',
  'Longton',
  'Tunstall',
  'Fenton',
  'Kidsgrove',
  'Leek',
  'Stone',
  'Stafford',
  'Uttoxeter',
  'Cheadle',
  'Crewe',
  'Macclesfield',
  'Haslington',
  'Sandbach',
  'Congleton',
  'Nantwich',
  'Alsager',
  'Wilmslow',
  'Knutsford',
] as const;

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

export function realignGvizCsv(csv: string): string {
  return parseCsvRecords(csv)
    .map((fields) => fieldsToCsv(fields.slice(1, 7)))
    .join('\n');
}

export async function fetchKlmaCsv(): Promise<KlmaFetchResult> {
  const preferred = await fetch(KLMA_EXPORT_URL);
  if (preferred.ok) {
    return {
      body: await preferred.text(),
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
    body: realignGvizCsv(await fallback.text()),
    sourceUrl: KLMA_GVIZ_URL,
    fetchMethod: 'gviz_csv',
    httpStatus: fallback.status,
  };
}

export function parseKlmaCsv(csv: string): KlmaRawRow[] {
  const records = parseCsvRecords(csv);
  return records.slice(1).map((fields, index) => ({
    rowIndex: index + 2,
    date: fields[0]?.trim() ?? '',
    artist: fields[1]?.trim() ?? '',
    venue: fields[2]?.trim() ?? '',
    time: fields[3]?.trim() ?? '',
    genre: fields[4]?.trim() ?? '',
    url: fields[5]?.trim() ?? '',
  }));
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

  if (/[A-Za-z]/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return isoDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
    }
  }

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
  if (!value || /^tbc$/i.test(value) || /^[£$€]/.test(value)) {
    return { time: '21:00', defaulted: true, warning: value ? `No stage time in '${value}'` : 'Missing stage time' };
  }

  if (/^0?7:12(?::00)?(?:\s*(?:am|pm))?$/i.test(value)) {
    return { time: '21:00', defaulted: true, warning: 'Known KLMA spreadsheet 07:12 corruption' };
  }

  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b.*\d{4}/i.test(value)) {
    return { time: '21:00', defaulted: true, warning: 'Date leaked into time column' };
  }

  const cleaned = value
    .replace(/^\(|\)$/g, '')
    .replace(/\s*[£$€][\d.,]+.*$/i, '')
    .replace(/,?\s*(free\s*entry|all\s*welcome|tickets?).*$/i, '')
    .trim();

  const matinee = cleaned.match(/matinee\s*(\d{1,2})(?::(\d{2}))?\s*[-–—]/i);
  if (matinee) {
    let hour = Number(matinee[1]);
    const minute = Number(matinee[2] ?? '00');
    if (hour < 12) hour += 12;
    return { time: to24Hour(hour, minute) ?? '15:00', defaulted: false };
  }

  const firstPart = cleaned.split(/\s+(?:to|[-–—])\s+/i)[0]?.trim() ?? cleaned;
  const match = firstPart.match(/^(\d{1,2})(?::|\.)(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (match) {
    const parsed = to24Hour(Number(match[1]), Number(match[2]), match[3]);
    if (parsed) return { time: parsed, defaulted: false };
  }

  const hourOnly = firstPart.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (hourOnly) {
    const parsed = to24Hour(Number(hourOnly[1]), 0, hourOnly[2]);
    if (parsed) return { time: parsed, defaulted: false };
  }

  const bare = firstPart.match(/^(\d{1,2})$/);
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
  const lower = venue.toLowerCase();
  const match = KNOWN_TOWNS.find((town) => lower.includes(town.toLowerCase()));
  if (match) {
    if (match === 'Hanley' || match === 'Burslem' || match === 'Longton' || match === 'Tunstall' || match === 'Fenton') {
      return { town: 'Stoke-on-Trent', defaulted: false };
    }
    return { town: match, defaulted: false };
  }
  return { town: 'Stoke-on-Trent', defaulted: true };
}

export function normaliseKlmaRows(rows: KlmaRawRow[], today: string): KlmaNormalisedEvent[] {
  const result: KlmaNormalisedEvent[] = [];

  for (const row of rows) {
    if (!row.artist || !row.venue) continue;
    const date = parseKlmaDate(row.date);
    if (!date || date < today) continue;

    const artistName = canonicalText(row.artist);
    const venueName = canonicalText(row.venue);
    if (/you can add|keep live music alive|@everyone/i.test(`${artistName} ${venueName}`)) continue;

    const town = inferTown(venueName);
    const time = parseKlmaTime(row.time);
    const eventUrl = /^https?:\/\//i.test(row.url) ? row.url : undefined;
    const sourceEventKey = `klma-${hash(`${date}|${venueName.toLowerCase()}|${artistName.toLowerCase()}`, 12)}`;
    const warnings = [time.warning, town.defaulted ? `Town defaulted to Stoke-on-Trent for '${venueName}'` : undefined]
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
      rawRowRef: `row:${row.rowIndex}`,
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
