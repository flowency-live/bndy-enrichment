import { classifyCaptureTarget } from '../capture/classify-target.js';
import { discoverCapture, inspectPublicPage } from '../capture/discover.js';
import type { CaptureRecord } from '../capture/schema.js';
import { BrowserAcquisitionRouter } from '../sources/runner/browser-acquisition.js';

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function redactWhitespace(value: string, max = 1600): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function extractFacebookEventUrls(value: string): string[] {
  const matches = value.match(/https?:\/\/(?:www\.|m\.)?facebook\.com\/events\/[^\s"'<>]+/gi) ?? [];
  return [...new Set(matches)].slice(0, 20);
}

function readiness(discovery: Awaited<ReturnType<typeof discoverCapture>>) {
  const artist = discovery.artist;
  const event = discovery.events[0];
  const missingArtistFields = [
    !artist?.name && 'artist.name',
    !artist?.facebookUrl && 'artist.facebookUrl',
    !artist?.location && 'artist.location',
    !artist?.artistType && 'artist.artistType',
    !artist?.actTypes?.length && 'artist.actTypes',
  ].filter(Boolean);
  const missingEventFields = [
    !event?.artistName && 'event.artistName',
    !event?.venueName && 'event.venueName',
    !event?.town && 'event.town',
    !event?.date && 'event.date',
  ].filter(Boolean);

  const exactSingleEvent = discovery.classification === 'event' && discovery.events.length === 1;
  const admissionPublishable = Boolean(event && event.admission !== 'UNKNOWN' && !event.cancelled);
  const identityReady = missingArtistFields.length === 0 && missingEventFields.length === 0;

  return {
    exactSingleEvent,
    identityReady,
    admissionPublishable,
    wouldProjectTactically: exactSingleEvent && identityReady && admissionPublishable,
    missingArtistFields,
    missingEventFields,
    reason: !exactSingleEvent
      ? `expected classification=event with exactly one event; got ${discovery.classification}/${discovery.events.length}`
      : !identityReady
        ? 'event/artist identity is incomplete'
        : !admissionPublishable
          ? event?.cancelled ? 'event is cancelled' : 'admission is UNKNOWN and current tactical policy holds it'
          : 'ready for the current tactical canonical projection path',
  };
}

const url = arg('url') ?? process.argv.find((value, index) => index > 1 && !value.startsWith('--'));
if (!url) {
  throw new Error('Usage: npm run capture:probe -- --url https://fb.me/e/... [--no-browser] [--no-gemini]');
}

const target = classifyCaptureTarget({ sharedUrl: url, mimeType: 'text/plain' });
const anonymous = await inspectPublicPage(url);

let browser: Record<string, unknown> | undefined;
if (!hasFlag('no-browser')) {
  try {
    const acquired = await new BrowserAcquisitionRouter().acquire({
      url,
      bodyMode: 'innerText',
      kind: 'text',
      fetchMethod: 'capture-facebook-event-probe',
      settleMs: 1500,
      timeoutMs: 45_000,
      maxBytes: 2 * 1024 * 1024,
    });
    browser = {
      ok: true,
      status: acquired.httpStatus,
      contentType: acquired.contentType,
      bytes: Buffer.byteLength(acquired.body, 'utf8'),
      containsLoginLanguage: /log in|login|sign up|create new account/i.test(acquired.body),
      eventUrls: extractFacebookEventUrls(acquired.body),
      bodyPreview: redactWhitespace(acquired.body),
    };
  } catch (error) {
    browser = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

let gemini: Record<string, unknown> | undefined;
if (!hasFlag('no-gemini')) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    gemini = { ok: false, error: 'GEMINI_API_KEY is not set' };
  } else {
    const capture: CaptureRecord = {
      id: `probe-${Date.now()}`,
      sharedUrl: url,
      sharedText: url,
      mimeType: 'text/plain',
      sourceApp: 'capture-probe',
      suggestedEntityType: target.platformObjectType === 'event' ? 'event' : 'unknown',
      status: 'unprocessed',
    };
    try {
      const discovery = await discoverCapture(capture, {
        apiKey,
        model: process.env.GEMINI_MODEL,
        horizonDays: Number(process.env.SEARCH_HORIZON_DAYS ?? 90),
      });
      gemini = {
        ok: true,
        discovery,
        readiness: readiness(discovery),
      };
    } catch (error) {
      gemini = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

console.log(JSON.stringify({
  probeVersion: 1,
  executedAt: new Date().toISOString(),
  writeMode: 'READ_ONLY',
  input: { url },
  target,
  anonymous,
  browser,
  gemini,
}, null, 2));
