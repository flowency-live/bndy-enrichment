import type { GigSource } from '../../../knowledge/types.js';
import { registerSourceAdapter, type SourceAdapter } from '../../runner/adapter.js';
import type { FetchedSource, ParsedSource, SourceRunContext } from '../../runner/types.js';
import type { AcquisitionRouter } from '../../runner/acquisition.js';
import { normaliseGigsNewsGig } from './normalise.js';
import { parseGigsNewsPage } from './parse.js';

export const GIGS_NEWS_ADAPTER_ID = 'gigs-news';

export const gigsNewsAdapter: SourceAdapter = {
  async fetch(config: GigSource, _run: SourceRunContext, acquisition: AcquisitionRouter): Promise<FetchedSource> {
    if (!config.url) throw new Error('GigsNews source URL is required');
    if (config.runtimeClass !== 'browser') throw new Error('GigsNews must run in the browser runtime');

    // Donor invariant: parser is built against rendered body.innerText, not
    // page.content(). Serialised HTML previously produced zero valid events.
    return await acquisition.acquire({
      url: config.url,
      kind: 'text',
      bodyMode: 'innerText',
      settleMs: 2_000,
      timeoutMs: 30_000,
      maxBytes: 2 * 1024 * 1024,
      complete: true,
      fetchMethod: 'chromium-innerText',
    });
  },

  async parse(_config: GigSource, run: SourceRunContext, raw: FetchedSource): Promise<ParsedSource> {
    const year = Number.parseInt(run.runDate.slice(0, 4), 10);
    const parsed = parseGigsNewsPage(raw.body, year);

    // Structural safety gate. A rendered page with no parseable or deliberately
    // parked rows must not become a destructive "complete empty snapshot".
    if (parsed.gigs.length === 0 && parsed.parked.length === 0) {
      throw new Error('GigsNews structural gate failed: rendered page produced zero recognised rows');
    }

    const events = parsed.gigs.map(normaliseGigsNewsGig);
    const defaulted = parsed.gigs.filter((gig) => gig.timeDefaulted).length;
    return {
      events,
      parked: parsed.parked.map((item) => ({ reason: item.reason, raw: { date: item.date, line: item.rawLine } })),
      warnings: defaulted ? [`${defaulted} gig time(s) defaulted to 20:00`] : [],
    };
  },
};

registerSourceAdapter(GIGS_NEWS_ADAPTER_ID, gigsNewsAdapter);
