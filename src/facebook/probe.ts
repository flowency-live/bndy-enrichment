import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) throw new Error('Usage: npm run facebook:probe -- https://www.facebook.com/.../events');

const maxScrolls = Number(process.env.MAX_FB_SCROLLS ?? 40);
const noGrowthLimit = Number(process.env.FB_NO_GROWTH_LIMIT ?? 3);
const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
const context = await browser.newContext({
  storageState: process.env.FB_STORAGE_STATE || undefined,
});
const page = await context.newPage();
const network = new Map<string, { url: string; status: number; contentType?: string }>();

page.on('response', async response => {
  const type = response.request().resourceType();
  if (type === 'xhr' || type === 'fetch') {
    network.set(response.url(), {
      url: response.url(),
      status: response.status(),
      contentType: response.headers()['content-type'],
    });
  }
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
const events = new Set<string>();
let noGrowth = 0;

for (let i = 0; i < maxScrolls; i++) {
  const before = events.size;
  const hrefs = await page.locator('a[href*="/events/"]').evaluateAll((els: HTMLAnchorElement[]) =>
    els.map(e => e.href).filter(Boolean),
  );
  hrefs.forEach(href => events.add(href));

  await page.mouse.wheel(0, Math.max(900, await page.evaluate(() => window.innerHeight * 0.9)));
  await page.waitForTimeout(1200);

  if (events.size === before) noGrowth++;
  else noGrowth = 0;

  console.error(JSON.stringify({
    scroll: i + 1,
    totalEventUrls: events.size,
    xhrFetchResponses: network.size,
    noGrowth,
  }));

  if (noGrowth >= noGrowthLimit) break;
}

console.log(JSON.stringify({
  url,
  eventUrls: [...events],
  network: [...network.values()],
}, null, 2));

await browser.close();
