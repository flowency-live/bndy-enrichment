import { createHash } from 'node:crypto';
import type { Handler } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { addCaptureNote, listUnprocessedCaptures, updateCaptureStatus } from '../capture/client.js';
import type { CaptureRecord } from '../capture/schema.js';

const sqs = new SQSClient({});

function canonicalUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const removable = ['rdid', 'mibextid', 'ref', 'refsrc', 'sfnsn', '__tn__', 'eid'];
    removable.forEach(key => parsed.searchParams.delete(key));
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith('utm_')) parsed.searchParams.delete(key);
    }
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

/**
 * Return the immutable object identity for an image Capture.
 *
 * Current Capture records store uploaded images in the first-class `media` field.
 * Older Android captures used rawPayload.imageBucket/imageKey, so keep that as a
 * backwards-compatible fallback while all clients converge on the same schema.
 */
export function storedImageKey(capture: CaptureRecord): string | undefined {
  if (!capture.mimeType?.startsWith('image/')) return undefined;

  if (
    capture.media?.type === 'image' &&
    capture.media.bucket?.trim() &&
    capture.media.key?.trim()
  ) {
    return `s3://${capture.media.bucket}/${capture.media.key}`;
  }

  const raw = capture.rawPayload as Record<string, unknown> | undefined;
  const bucket = typeof raw?.imageBucket === 'string' ? raw.imageBucket : undefined;
  const key = typeof raw?.imageKey === 'string' ? raw.imageKey : undefined;
  return bucket && key ? `s3://${bucket}/${key}` : undefined;
}

export function usableSharedText(capture: CaptureRecord): string | undefined {
  const text = capture.sharedText?.trim();
  return text && text.length >= 8 ? text : undefined;
}

export function captureBatchIdentity(capture: CaptureRecord): string | undefined {
  const url = canonicalUrl(capture.sharedUrl);
  if (url) return `url:${url}`;
  const imageKey = storedImageKey(capture);
  if (imageKey) return `image:${imageKey}`;
  const text = usableSharedText(capture);
  if (!text) return undefined;
  const normalised = text.toLocaleLowerCase('en-GB').replace(/\s+/g, ' ');
  return `text:${createHash('sha256').update(normalised).digest('hex')}`;
}

function sortNewestFirst(captures: CaptureRecord[]): CaptureRecord[] {
  return [...captures].sort((a, b) =>
    String(b.receivedAt ?? b.capturedAt ?? '').localeCompare(String(a.receivedAt ?? a.capturedAt ?? ''))
  );
}

export const handler: Handler = async () => {
  const queueUrl = process.env.CAPTURE_QUEUE_URL;
  if (!queueUrl) throw new Error('CAPTURE_QUEUE_URL is required');

  const captures = sortNewestFirst(await listUnprocessedCaptures(Number(process.env.CAPTURE_SCAN_LIMIT ?? 25)));
  const seen = new Map<string, string>();
  let queued = 0;
  let ignored = 0;
  let failed = 0;
  let duplicates = 0;

  for (const capture of captures) {
    if (capture.sourceApp === 'manual-test') {
      await addCaptureNote(capture.id, 'AWS processor: ignored manual-test capture.');
      await updateCaptureStatus(capture.id, 'ignored');
      ignored++;
      continue;
    }

    const url = canonicalUrl(capture.sharedUrl);
    const imageKey = storedImageKey(capture);
    const sharedText = usableSharedText(capture);

    if (!url && !imageKey && !sharedText) {
      await addCaptureNote(
        capture.id,
        capture.mimeType?.startsWith('image/')
          ? 'AWS processor: failed because this image capture has no uploaded image object.'
          : 'AWS processor: failed because the capture contains no usable public URL, stored image or event text.'
      );
      await updateCaptureStatus(capture.id, 'failed', {
        state: 'could_not_resolve',
        message: 'There was not enough event information to check this submission.',
      });
      failed++;
      continue;
    }

    // Dedupe only within this scanner batch. URLs use their canonical public identity,
    // images use the immutable S3 object identity and text uses a normalised hash.
    const identity = captureBatchIdentity(capture)!;
    const firstId = seen.get(identity);
    if (firstId) {
      await addCaptureNote(capture.id, `AWS processor: duplicate of capture ${firstId}.`);
      await updateCaptureStatus(capture.id, 'processed');
      duplicates++;
      continue;
    }
    seen.set(identity, capture.id);

    // The processor owns the atomic claim. This scanner is only a recovery
    // dispatcher, so duplicate queue messages remain safe.
    await sqs.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ captureId: capture.id }),
    }));
    queued++;
  }

  const summary = { discovered: captures.length, queued, ignored, failed, duplicates };
  console.log('Capture scan complete', summary);
  return summary;
};
