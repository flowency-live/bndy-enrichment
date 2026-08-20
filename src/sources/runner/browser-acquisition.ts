import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { DnsHostResolver, assertSafeUrl, isPrivateAddress, type AcquisitionRequest, type AcquisitionRouter } from './acquisition.js';
import type { FetchedSource } from './types.js';

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * Browser acquisition lives in its own module so Chromium never enters the
 * standard SourceWorker bundle.
 */
export class BrowserAcquisitionRouter implements AcquisitionRouter {
  private readonly resolver = new DnsHostResolver();

  async acquire(request: AcquisitionRequest): Promise<FetchedSource> {
    const url = assertSafeUrl(request.url);
    const addresses = await this.resolver.resolve(url.hostname);
    const unsafe = addresses.find(isPrivateAddress);
    if (unsafe) throw new Error(`Source hostname resolves to blocked address: ${unsafe}`);

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', (intercepted) => {
        const target = intercepted.url();
        try {
          const parsed = new URL(target);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            void intercepted.abort();
            return;
          }
        } catch {
          void intercepted.abort();
          return;
        }
        void intercepted.continue();
      });

      const response = await page.goto(url.toString(), {
        waitUntil: 'networkidle2',
        timeout: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });
      if (!response) throw new Error('Browser navigation returned no response');
      if (!response.ok()) throw new Error(`Browser source fetch returned HTTP ${response.status()}`);

      const body = await page.content();
      const bytes = Buffer.byteLength(body, 'utf8');
      const maxBytes = request.maxBytes ?? DEFAULT_MAX_BYTES;
      if (bytes > maxBytes) throw new Error(`Browser source response exceeds ${maxBytes} byte cap`);

      return {
        kind: request.kind ?? 'html',
        body,
        sourceUrl: url.toString(),
        fetchMethod: request.fetchMethod ?? 'chromium',
        fetchedAt: new Date().toISOString(),
        complete: request.complete ?? true,
        httpStatus: response.status(),
        contentType: response.headers()['content-type'],
      };
    } finally {
      await browser.close();
    }
  }
}
