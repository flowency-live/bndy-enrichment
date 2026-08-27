import type { GigSource } from '../../../knowledge/types.js';
import {
  hasKlmaCsvShape,
  klmaRowParkingReason,
  KLMA_EXPORT_URL,
  KLMA_GVIZ_URL,
  normaliseKlmaRows,
  parseKlmaCsv,
  prepareKlmaCsv,
  type KlmaNormalisedEvent,
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

function fetched(source: FetchedSource, sourceUrl: string, fetchMethod: string): FetchedSource {
  if (!hasKlmaCsvShape(source.body)) throw new Error(`KLMA structural gate failed for ${fetchMethod}: expected Date, Artist and Venue columns`);
  return {
    ...source,
    kind: 'csv',
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
    return fetched(primary, KLMA_EXPORT_URL, 'google-sheets-export-csv');
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
      return fetched(fallback, KLMA_GVIZ_URL, 'google-sheets-gviz-csv');
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

function eventSignature(event: KlmaNormalisedEvent): string {
  return JSON.stringify({
    artistName: event.artistName,
    venueName: event.venueName,
    date: event.date,
    startTime: event.startTime,
    genre: event.genre,
    eventUrl: event.eventUrl,
  });
}

function deduplicateEvents(events: KlmaNormalisedEvent[]): {
  accepted: KlmaNormalisedEvent[];
  parkedByRowRef: Map<string, string>;
} {
  const groups = new Map<string, KlmaNormalisedEvent[]>();
  for (const event of events) {
    const group = groups.get(event.sourceEventKey) ?? [];
    group.push(event);
    groups.set(event.sourceEventKey, group);
  }

  const accepted: KlmaNormalisedEvent[] = [];
  const parkedByRowRef = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      accepted.push(group[0]!);
      continue;
    }
    const signatures = new Set(group.map(eventSignature));
    if (signatures.size === 1) {
      accepted.push(group[0]!);
      for (const duplicate of group.slice(1)) parkedByRowRef.set(duplicate.rawRowRef, 'duplicate_source_row');
      continue;
    }
    for (const collision of group) parkedByRowRef.set(collision.rawRowRef, 'source_identity_collision');
  }
  return { accepted, parkedByRowRef };
}

export const klmaAdapter: SourceAdapter = {
  async fetch(_config: GigSource, _run: SourceRunContext, acquisition: AcquisitionRouter): Promise<FetchedSource> {
    return acquireCsv(acquisition);
  },

  async parse(_config: GigSource, run: SourceRunContext, raw: FetchedSource): Promise<ParsedSource> {
    const prepared = prepareKlmaCsv(raw.body);
    const rows = parseKlmaCsv(prepared);
    const normalised = normaliseKlmaRows(rows, run.runDate);
    const { accepted: events, parkedByRowRef } = deduplicateEvents(normalised);
    const acceptedRows = new Set(events.map((event) => event.rawRowRef));
    const parked = rows
      .filter((row) => !acceptedRows.has(`row:${row.rowIndex}`))
      .map((row) => ({
        reason: parkedByRowRef.get(`row:${row.rowIndex}`)
          ?? klmaRowParkingReason(row, run.runDate)
          ?? 'unparsed_row',
        raw: row,
      }));
    return {
      events: events.map(eventRow),
      entities: entityRows(events),
      parked,
      warnings: events.flatMap((event) => event.warnings),
    };
  },
};

registerSourceAdapter(KLMA_ADAPTER_ID, klmaAdapter);
