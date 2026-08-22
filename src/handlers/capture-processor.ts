import type { SQSBatchResponse, SQSHandler } from 'aws-lambda';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { addCaptureNote, getCapture, updateCaptureStatus } from '../capture/client.js';
import { discoverCapture, inspectPublicPage } from '../capture/discover.js';
import { prepareCaptureForDiscovery } from '../capture/prepare-discovery.js';
import { findOrCreateArtist, findOrCreateVenue, createEvent, getArtist, patchMissingArtistFields } from '../bndy/client.js';
import type { CaptureArtist, CaptureEvent, CaptureRecord } from '../capture/schema.js';

const secrets = new SecretsManagerClient({});
let cachedGeminiKey: string | undefined;

async function geminiKey(): Promise<string> {
  if (cachedGeminiKey) return cachedGeminiKey;
  const out = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.GEMINI_SECRET_ARN! }));
  if (!out.SecretString) throw new Error('Gemini secret has no SecretString');
  const parsed = JSON.parse(out.SecretString);
  cachedGeminiKey = parsed.apiKey ?? parsed.GEMINI_API_KEY;
  if (!cachedGeminiKey) throw new Error('Gemini secret must contain apiKey');
  return cachedGeminiKey;
}

function validateArtistForCreation(artist?: CaptureArtist): string[] {
  const missing: string[] = [];
  if (!artist) return ['artist'];
  if (!artist.name?.trim()) missing.push('name');
  if (!artist.facebookUrl?.trim()) missing.push('facebookUrl');
  if (!artist.location?.trim()) missing.push('location');
  if (!artist.artistType) missing.push('artistType');
  if (!artist.actTypes?.length) missing.push('actType');
  return missing;
}

// A direct Capture submission is an explicit assertion that the event belongs in BNDY.
// Admission is metadata, not an eligibility gate. Unknown admission therefore defaults to
// a normal non-ticketed event unless stronger evidence says it is paid/ticketed. Explicitly
// cancelled events remain the only events held from projection here.
export function eventShouldPublish(event: CaptureEvent): boolean {
  return !event.cancelled;
}

function compact(value: unknown, max = 800): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function processableClassification(value: string): value is 'artist' | 'event' {
  return value === 'artist' || value === 'event';
}

async function prepareDiscoveryCapture(capture: CaptureRecord): Promise<CaptureRecord> {
  // Modern Facebook Android shares are frequently opaque /share/<token>/ transport URLs.
  // Resolve that public redirect first so discoverCapture sees /events/<id>/ and therefore
  // uses its exact-event prompt instead of the generic artist/profile discovery path.
  const inspection = await inspectPublicPage(capture.sharedUrl);
  return prepareCaptureForDiscovery(capture, inspection?.finalUrl);
}

async function processCapture(captureId: string): Promise<void> {
  const capture = await getCapture(captureId);
  if (capture.status !== 'processing' && capture.status !== 'unprocessed') {
    console.log('Skipping capture with terminal/non-processable status', { captureId, status: capture.status });
    return;
  }

  const discoveryCapture = await prepareDiscoveryCapture(capture);
  const discovery = await discoverCapture(discoveryCapture, {
    apiKey: await geminiKey(),
    model: process.env.GEMINI_MODEL,
    horizonDays: Number(process.env.SEARCH_HORIZON_DAYS ?? 90),
  });

  if (discovery.classification === 'non_music') {
    await addCaptureNote(captureId, `AWS processor: ignored non-music capture. ${discovery.reason}`);
    await updateCaptureStatus(captureId, 'ignored');
    return;
  }

  if (!processableClassification(discovery.classification) || !discovery.artist) {
    await addCaptureNote(captureId, `AWS processor: REVIEW_REQUIRED. Capture classified as ${discovery.classification}. ${discovery.reason}`);
    await updateCaptureStatus(captureId, 'failed');
    return;
  }

  if (discovery.classification === 'event' && discovery.events.length !== 1) {
    await addCaptureNote(captureId,
      `AWS processor: REVIEW_REQUIRED. Direct event capture must resolve to exactly one event, got ${discovery.events.length}. ${discovery.reason}`
    );
    await updateCaptureStatus(captureId, 'failed');
    return;
  }

  if (discovery.classification === 'event') {
    const event = discovery.events[0];
    if (!event.cancelled && !event.startTime) {
      // The canonical community event API currently requires startTime. Do not silently
      // mark a direct user submission processed when the model missed it: retry the whole
      // exact-event extraction instead. Artist/profile multi-event discovery remains best-effort.
      throw new Error(`Direct event capture ${captureId} resolved without a start time; retry exact-event extraction`);
    }

    // When the transport URL was deterministically resolved to a canonical Facebook Event,
    // keep that object identity even if search grounding returns a noisier URL variant.
    if (discoveryCapture.sharedUrl?.includes('facebook.com/events/')) {
      discovery.canonicalUrl = discoveryCapture.sharedUrl;
      event.eventUrl = discoveryCapture.sharedUrl;
      if (!event.sourceUrls.includes(discoveryCapture.sharedUrl)) event.sourceUrls.unshift(discoveryCapture.sharedUrl);
      if (!discovery.evidenceUrls.includes(discoveryCapture.sharedUrl)) discovery.evidenceUrls.unshift(discoveryCapture.sharedUrl);
    }
  }

  const missing = validateArtistForCreation(discovery.artist);
  if (missing.length) {
    await addCaptureNote(captureId,
      `AWS processor: REVIEW_REQUIRED. Artist creation blocked because required fields are missing: ${missing.join(', ')}. ` +
      `Identified artist: ${discovery.artist.name ?? '(unknown)'}. Evidence: ${discovery.evidenceUrls.join(', ') || 'none'}`
    );
    await updateCaptureStatus(captureId, 'failed');
    return;
  }

  const artistResult = await findOrCreateArtist(discovery.artist, captureId);
  if (artistResult.action === 'review') {
    await addCaptureNote(captureId,
      `AWS processor: REVIEW_REQUIRED. Artist resolver returned ambiguous candidates for ${discovery.artist.name}: ` +
      compact(artistResult.candidates ?? artistResult.raw)
    );
    await updateCaptureStatus(captureId, 'failed');
    return;
  }

  const artistId = artistResult.artistId;
  if (!artistId) {
    await addCaptureNote(captureId, `AWS processor: failed to obtain artist ID. Resolver response: ${compact(artistResult.raw)}`);
    await updateCaptureStatus(captureId, 'failed');
    return;
  }

  // For an existing artist, add only fields that are genuinely absent. This ensures
  // the captured Facebook profile is attached without overwriting curated data.
  if (artistResult.action === 'matched' || artistResult.action === 'duplicate') {
    try {
      const existing = await getArtist(artistId);
      await patchMissingArtistFields(artistId, existing, discovery.artist);
    } catch (error) {
      console.warn('Existing artist enrichment patch failed non-fatally', { captureId, artistId, error });
    }
  }

  const eventLines: string[] = [];
  const venueLines: string[] = [];
  let createdEvents = 0;
  let duplicateEvents = 0;
  let heldEvents = 0;

  for (const event of discovery.events) {
    if (!eventShouldPublish(event)) {
      heldEvents++;
      eventLines.push(`${event.date} ${event.venueName}: held (cancelled)`);
      continue;
    }

    try {
      const venue = await findOrCreateVenue(event, captureId);
      if (venue.isNew) venueLines.push(`${venue.name}${venue.city ? `, ${venue.city}` : ''} (new)`);

      const result = await createEvent(artistId, venue.id, event, captureId);
      if (result.created) createdEvents++;
      if (result.duplicate) duplicateEvents++;
      eventLines.push(
        `${event.date}${event.startTime ? ` ${event.startTime}` : ''} | ${venue.name}${venue.city ? `, ${venue.city}` : ''} | ` +
        `${result.created ? 'created' : 'existing duplicate'} ${result.id}${venue.isNew ? ' | venue newly created' : ' | venue matched'}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (discovery.classification === 'event') {
        // A direct share represents one user-requested event. Never swallow a projection
        // failure and mark it processed: let SQS retry and eventually surface a failed capture.
        throw new Error(`Direct event projection failed for ${event.date} ${event.venueName}: ${message}`);
      }
      eventLines.push(`${event.date} | ${event.venueName}: skipped - ${message}`);
    }
  }

  const note = [
    'AWS processor: completed.',
    `Capture classification: ${discovery.classification}`,
    `Artist: ${discovery.artist.name} | ${artistResult.action} | ${artistId}`,
    `Facebook: ${discovery.artist.facebookUrl}`,
    `Location: ${discovery.artist.location}${discovery.artist.locationType ? ` (${discovery.artist.locationType})` : ''}`,
    `Artist type: ${discovery.artist.artistType}; act type: ${discovery.artist.actTypes.join(', ')}`,
    discovery.canonicalUrl ? `Canonical capture URL: ${discovery.canonicalUrl}` : 'Canonical capture URL: not resolved',
    discovery.artist.bio ? `Bio: ${discovery.artist.bio}` : 'Bio: not found',
    `Events: ${createdEvents} created, ${duplicateEvents} existing duplicates, ${heldEvents} held.`,
    ...(eventLines.length ? ['Event detail:', ...eventLines.map(line => `- ${line}`)] : ['No upcoming events found.']),
    ...(venueLines.length ? ['New venues:', ...venueLines.map(line => `- ${line}`)] : ['No new venues.']),
  ].join('\n');

  await addCaptureNote(captureId, note);
  await updateCaptureStatus(captureId, 'processed');
}

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const failures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    const receiveCount = Number(record.attributes.ApproximateReceiveCount ?? '1');
    let captureId: string | undefined;
    try {
      const parsed = JSON.parse(record.body);
      captureId = parsed.captureId;
      if (!captureId) throw new Error('captureId is required');
      await processCapture(captureId);
    } catch (error) {
      console.error('Capture processing failed', { captureId, receiveCount, error });
      if (captureId && receiveCount >= 3) {
        try {
          await addCaptureNote(captureId, `AWS processor: failed after ${receiveCount} attempts. ${error instanceof Error ? error.message : String(error)}`);
          await updateCaptureStatus(captureId, 'failed');
          continue;
        } catch (finaliseError) {
          console.error('Could not finalise failed capture', { captureId, finaliseError });
        }
      }
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures: failures };
};
