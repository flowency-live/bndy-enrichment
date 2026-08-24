import type { GigSource } from '../../../knowledge/types.js';
import type { AcquisitionRouter } from '../../runner/acquisition.js';
import { registerSourceAdapter, type SourceAdapter } from '../../runner/adapter.js';
import type { FetchedSource, ParsedSource, SourceRunContext } from '../../runner/types.js';
import { parseLemonrock } from './parse.js';

export const LEMONROCK_ADAPTER_ID = 'lemonrock';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  acquisition: AcquisitionRouter,
): Promise<FetchedSource> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await acquisition.acquire({
        url,
        kind: 'html',
        timeoutMs: 25_000,
        maxBytes: 4 * 1024 * 1024,
        complete: false,
        fetchMethod: 'http-lemonrock',
        followRedirects: true,
        maxRedirects: 5,
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'BNDY-Backline/1.0 (+https://bndy.live; source-reconciliation)',
        },
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /HTTP (403|408|425|429|5\d\d)|fetch failed|timed? ?out|abort/i.test(message);
      if (attempt === 3 || !retryable) throw error;
      await sleep(500 * (2 ** attempt));
    }
  }
  throw lastError;
}

export const lemonrockAdapter: SourceAdapter = {
  async fetch(config: GigSource, run: SourceRunContext, acquisition: AcquisitionRouter): Promise<FetchedSource> {
    if (config.runtimeClass !== 'standard') throw new Error('Lemonrock must use the standard HTTP runtime unless a specific page proves otherwise');
    const taskUrl = typeof run.task?.url === 'string' ? run.task.url : undefined;
    const url = taskUrl ?? config.url;
    if (!url) throw new Error(`Lemonrock source ${config.id} requires a URL`);
    const parsed = new URL(url);
    if (parsed.hostname !== 'www.lemonrock.com' && parsed.hostname !== 'lemonrock.com') {
      throw new Error(`Lemonrock adapter refused non-Lemonrock URL: ${parsed.hostname}`);
    }
    return await fetchWithRetry(parsed.toString(), acquisition);
  },

  async parse(_config: GigSource, run: SourceRunContext, raw: FetchedSource): Promise<ParsedSource> {
    const sourceUrl = raw.sourceUrl;
    if (!sourceUrl) throw new Error('Lemonrock acquisition returned no source URL');
    if (!/<(?:html|body|head|a)\b/i.test(raw.body)) throw new Error('Lemonrock structural gate failed: response is not recognisable HTML');
    return parseLemonrock(raw.body, sourceUrl, run);
  },
};

registerSourceAdapter(LEMONROCK_ADAPTER_ID, lemonrockAdapter);
