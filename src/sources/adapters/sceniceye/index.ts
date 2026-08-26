import type { GigSource } from '../../../knowledge/types.js';
import type { AcquisitionRouter } from '../../runner/acquisition.js';
import { registerSourceAdapter, type SourceAdapter } from '../../runner/adapter.js';
import type { FetchedSource, ParsedSource, SourceRunContext } from '../../runner/types.js';
import { isScenicEyeHost, parseLongDate, textFromHtml } from './html.js';
import { parseScenicEye } from './parse.js';

export const SCENICEYE_ADAPTER_ID = 'sceniceye';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function editionIsFresh(body: string, runDate: string): boolean {
  const dates = [...body.matchAll(/<h2[^>]*class="notion-heading[^"]*"[^>]*>([^<]+)<\/h2>/gi)]
    .map((match) => parseLongDate(textFromHtml(match[1])))
    .filter((date): date is string => Boolean(date));
  return dates.length > 0 && dates.some((date) => date >= runDate);
}

async function fetchWithRetry(url: string, acquisition: AcquisitionRouter): Promise<FetchedSource> {
  let lastError: unknown;
  await sleep(300 + Math.floor(Math.random() * 500));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await acquisition.acquire({
        url, kind: 'html', timeoutMs: 25_000, maxBytes: 4 * 1024 * 1024, complete: true,
        fetchMethod: 'http-sceniceye', followRedirects: true, maxRedirects: 5,
        headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'BNDY-Backline/1.0 (+https://bndy.live; source-reconciliation)' },
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /HTTP (403|408|425|429|5\d\d)|fetch failed|timed? ?out|abort/i.test(message);
      if (attempt === 7 || !retryable) throw error;
      await sleep(Math.min(12_000, 750 * (2 ** attempt)) + Math.floor(Math.random() * 1_000));
    }
  }
  throw lastError;
}

export const scenicEyeAdapter: SourceAdapter = {
  async fetch(config: GigSource, run: SourceRunContext, acquisition: AcquisitionRouter): Promise<FetchedSource> {
    if (config.runtimeClass !== 'standard') throw new Error('Scenic Eye must use the standard HTTP runtime');
    const url = typeof run.task?.url === 'string' ? run.task.url : config.url;
    if (!url) throw new Error(`Scenic Eye source ${config.id} requires a URL`);
    const parsed = new URL(url);
    if (!isScenicEyeHost(parsed.hostname)) throw new Error(`Scenic Eye adapter refused non-Scenic Eye URL: ${parsed.hostname}`);
    const fetched = await fetchWithRetry(parsed.toString(), acquisition);
    const fresh = editionIsFresh(fetched.body, run.runDate);
    return { ...fetched, complete: fetched.complete && fresh, captureStable: fresh };
  },
  async parse(_config: GigSource, run: SourceRunContext, raw: FetchedSource): Promise<ParsedSource> {
    if (!raw.sourceUrl) throw new Error('Scenic Eye acquisition returned no source URL');
    if (!/<(?:html|body|head|h2)\b/i.test(raw.body)) throw new Error('Scenic Eye structural gate failed: response is not recognisable HTML');
    return parseScenicEye(raw.body, raw.sourceUrl, run);
  },
};

registerSourceAdapter(SCENICEYE_ADAPTER_ID, scenicEyeAdapter);
