import { createHash } from 'node:crypto';
import type { NormalisedSourceClaim, NormalisedSourceEvent, ParsedSource, SourceRunContext } from '../../runner/types.js';
import { parseLongDate, parseTimeRange, parseVenueCell, slug, textFromHtml, titleFromHtml } from './html.js';

export type ScenicEyeParse = ParsedSource & { editionFresh: boolean };

function daySections(html: string): Array<{ date: string; html: string }> {
  const sections: Array<{ date: string; html: string }> = [];
  const headings = [...html.matchAll(/<h2[^>]*class="notion-heading[^"]*"[^>]*>([^<]+)<\/h2>/gi)];
  for (let index = 0; index < headings.length; index += 1) {
    const date = parseLongDate(textFromHtml(headings[index][1]));
    if (!date) continue;
    const start = headings[index].index! + headings[index][0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index! : html.length;
    sections.push({ date, html: html.slice(start, end) });
  }
  return sections;
}

function tableRows(sectionHtml: string): string[][] {
  const rows: string[][] = [];
  for (const row of sectionHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => textFromHtml(cell[1]).replace(/\s+/g, ' ').trim());
    if (cells.length) rows.push(cells);
  }
  return rows;
}

export function parseScenicEye(html: string, sourceUrl: string, run: SourceRunContext): ScenicEyeParse {
  const title = titleFromHtml(html) ?? '';
  if (!/Scenic Eye/i.test(title)) throw new Error(`Scenic Eye structural gate failed: unexpected title "${title}"`);
  const warnings: string[] = [];
  const parked: Array<{ reason: string; raw?: unknown }> = [];
  const events: NormalisedSourceEvent[] = [];
  const sections = daySections(html);
  if (!sections.length) throw new Error('Scenic Eye structural gate failed: no dated day headings found in the edition');

  for (const section of sections) {
    for (const cells of tableRows(section.html)) {
      if (/^act$/i.test(cells[0] ?? '') && /^venue$/i.test(cells[1] ?? '')) continue;
      const [actCell, venueCell, timeCell] = cells;
      if (!actCell || !venueCell) { parked.push({ reason: 'row missing act or venue cell', raw: cells }); continue; }
      const { venueName, address, postcode } = parseVenueCell(venueCell);
      const { startTime, endTime } = parseTimeRange(timeCell ?? '');
      if (!venueName) { parked.push({ reason: 'venue cell had no name segment', raw: cells }); continue; }
      if (timeCell && !startTime) warnings.push(`unparseable time "${timeCell}" for ${actCell} on ${section.date}`);
      const sourceEventKey = `sceniceye:gig:${section.date}:${slug(actCell)}:${slug(venueName)}`;
      const claims: NormalisedSourceClaim[] = [{ predicate: 'derivedFrom', value: { kind: 'venue-cell', text: venueCell }, evidenceText: venueCell }];
      if (postcode) claims.push({ predicate: 'derivedFrom', value: { kind: 'venue-postcode', postcode }, evidenceText: venueCell });
      const event: NormalisedSourceEvent = {
        sourceEventKey,
        artistName: actCell,
        venueName,
        venueAddress: address,
        venueExternalId: `sceniceye:venue:${slug(venueName)}${postcode ? `-${slug(postcode)}` : ''}`,
        artistExternalId: `sceniceye:act:${slug(actCell)}`,
        date: section.date,
        startTime,
        endTime,
        title: `${actCell} at ${venueName}`,
        eventUrl: sourceUrl,
        claims,
      };
      event.contentHash = createHash('sha256').update(JSON.stringify({ key: sourceEventKey, date: section.date, startTime, endTime, address })).digest('hex');
      events.push(event);
    }
  }
  if (!events.length) throw new Error('Scenic Eye structural gate failed: a dated edition parsed to zero gig rows');
  const editionFresh = sections.some((section) => section.date >= run.runDate);
  if (!editionFresh) warnings.push(`stale edition: latest day ${sections[sections.length - 1].date} is before run date ${run.runDate}; withdrawal inference disabled`);
  return { events, parked, warnings, editionFresh };
}
