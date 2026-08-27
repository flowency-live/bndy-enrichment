import type { GigSource } from '../../../knowledge/types.js';
import {
  hasKlmaCsvShape,
  KLMA_EXPORT_URL,
  KLMA_GVIZ_URL,
  normaliseKlmaRows,
  parseKlmaCsv,
  parseKlmaDate,
  realignGvizCsv,
  type KlmaNormalisedEvent,
  type KlmaRawRow,
} from '../../../vertical-slice/klma-source.js';
import type { AcquisitionRouter } from '../../runner/acquisition.js';
import { registerSourceAdapter, type SourceAdapter } from '../../runner/adapter.js';
import type {
  FetchedSource,
  NormalisedSourceEntity,
  NormalisedSourceEvent,
  ParsedSource,
  SourceRunContext,
} from '../../runner/types.js';

export const KLMA_ADAPTER_ID = 'klma-stoke';

function requiresGvizRealignment(body: string): boolean {
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.startsWith(',') || firstLine.startsWith('"",');
}

function fetched(body: string, source: FetchedSource, sourceUrl: string, fetchMethod: string): FetchedSource {
  if (!hasKlmaCsvShape(body)) throw new Error(`KLMA structural gate failed for ${fetchMethod}: expected Date, Artist and Venue columns`);
  return {
    ...source,
    kind: 'csv',
    body,
    sourceUrl,
    fetchMethod,
    complete: true,
    paginationComplete: true,
    captureStable: true,
  };
}

async function acquireCsv(acquisition: AcquisitionRouter): Promise<FetchedSource> {
  try {
    const primary = await acquisition.acquire({
      url: KLMA_EXPORT_URL,
      kind: 'csv',
      timeoutMs: 20_000,
      maxBytes: 2 * 1024 * 1024,
      complete: true,
      fetchMethod: 'google-sheets-export-csv',
      followRedirects: true,
    });
    const body = requiresGvizRealignment(primary.body) ? realignGvizCsv(primary.body) : primary.body;
    return fetched(body, primary, KLMA_EXPORT_URL, 'google-sheets-export-csv');
  } catch (primaryError) {
    const fallback = await acquisition.acquire({
      url: KLMA_GVIZ_URL,
      kind: 'csv',
      timeoutMs: 20_000,
      maxBytes: 2 * 1024 * 1024,
      complete: true,
      fetchMethod: 'google-sheets-gviz-csv',
      followRedirects: true,
    });
    try {
      return fetched(realignGvizCsv(fallback.body), fallback, KLMA_GVIZ_URL, 'google-sheets-gviz-csv');
    } catch (fallbackError) {
      const first = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const second = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`KLMA acquisition failed: export=${first}; gviz=${second}`);
    }
  }
}

function eventRow(event: KlmaNormalisedEvent): NormalisedSourceEvent {
  return {
    sourceEventKey: event.sourceEventKey,
    sourceNativeId: event.sourceNativeId,
    artistName: event.artistName,
    artistExternalId: event.artistExternalId,
    artistLocation: event.artistLocation,
    venueName: event.venueName,
    venueExternalId: event.venueExternalId,
    venueLocation: event.town,
    date: event.date,
    startTime: event.startTime,
    eventUrl: event.eventUrl,
    claims: [{
      predicate: 'derivedFrom',
      value: {
        rawRowRef: event.rawRowRef,
        startTimeDefaulted: event.startTimeDefaulted,
        ...(event.genre ? { genre: event.genre } : {}),
      },
    }],
    data: {
      rawRowRef: event.rawRowRef,
      startTimeDefaulted: event.startTimeDefaulted,
      ...(event.genre ? { genre: event.genre } : {}),
    },
  };
}

function entityRows(events: KlmaNormalisedEvent[]): NormalisedSourceEntity[] {
  const artists = new Map<string, NormalisedSourceEntity>();
  const venues = new Map<string, NormalisedSourceEntity>();
  for (const event of events) {
    const artist = artists.get(event.artistExternalId) ?? {
      entityType: 'artist' as const,
      sourceEntityKey: event.artistExternalId,
      sourceNativeId: event.artistExternalId,
      displayName: event.artistName,
      claims: [{ predicate: 'hasLocation' as const, value: event.artistLocation }],
    };
    if (event.genre && !artist.claims.some((claim) => claim.predicate === 'hasGenre' && claim.value === event.genre)) {
      artist.claims.push({ predicate: 'hasGenre', value: event.genre });
    }
    artists.set(event.artistExternalId, artist);

    if (!venues.has(event.venueExternalId)) {
      venues.set(event.venueExternalId, {
        entityType: 'venue',
        sourceEntityKey: event.venueExternalId,
        sourceNativeId: event.venueExternalId,
        displayName: event.venueName,
        claims: [{ predicate: 'locatedIn', value: event.town }],
      });
    }
  }
  return [...artists.values(), ...venues.values()];
}

function parkedReason(row: KlmaRawRow, runDate: string): string {
  if (!row.artist || !row.venue) return 'missing_artist_or_venue';
  const date = parseKlmaDate(row.date);
  if (!date) return 'invalid_date';
  if (date < runDate) return 'past_event';
  if (/you can add|keep live music alive|@everyone/i.test(`${row.artist} ${row.venue}`)) return 'non_gig_notice';
  return 'unparsed_row';
}

export const klmaAdapter: SourceAdapter = {
  async fetch(_config: GigSource, _run: SourceRunContext, acquisition: AcquisitionRouter): Promise<FetchedSource> {
    return acquireCsv(acquisition);
  },

  async parse(_config: GigSource, run: SourceRunContext, raw: FetchedSource): Promise<ParsedSource> {
    if (!hasKlmaCsvShape(raw.body)) throw new Error('KLMA structural gate failed: expected Date, Artist and Venue columns');
    const rows = parseKlmaCsv(raw.body);
    const events = normaliseKlmaRows(rows, run.runDate);
    const acceptedRows = new Set(events.map((event) => event.rawRowRef));
    const parked = rows
      .filter((row) => !acceptedRows.has(`row:${row.rowIndex}`))
      .map((row) => ({ reason: parkedReason(row, run.runDate), raw: { rowIndex: row.rowIndex } }));
    return {
      events: events.map(eventRow),
      entities: entityRows(events),
      parked,
      warnings: events.flatMap((event) => event.warnings),
    };
  },
};

registerSourceAdapter(KLMA_ADAPTER_ID, klmaAdapter);
