import type { Handler } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { addCaptureNote, claimCapture, listUnprocessedCaptures, updateCaptureStatus } from '../capture/client.js';
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

function storedImageKey(capture: CaptureRecord): string | undefined {
  if (!capture.mimeType?.startsWith('image/')) return undefined;
  const raw = capture.rawPayload as Record<string, unknown> | undefined;
  const bucket = typeof raw?.imageBucket === 'string' ? raw.imageBucket : undefined;
  const key = typeof raw?.imageKey === 'string' ? raw.imageKey : undefined;
  return bucket && key ? `s3://${bucket}/${key}` : undefined;
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

    if (!url && !imageKey) {
      await addCaptureNote(
        capture.id,
        capture.mimeType?.startsWith('image/')
          ? 'AWS processor: failed because this image capture has no uploaded image object. Update the Android Capture app and resend.'
          : 'AWS processor: failed because the capture contains no usable public URL or stored image.'
      );
      await updateCaptureStatus(capture.id, 'failed');
      failed++;
      continue;
    }

    // Dedupe only within this scanner batch. URLs use their canonical public identity;
    // image captures use the immutable S3 object identity.
    const identity = url ? `url:${url}` : `image:${imageKey}`;
    const firstId = seen.get(identity);
    if (firstId) {
      await addCaptureNote(capture.id, `AWS processor: duplicate of capture ${firstId}.`);
      await updateCaptureStatus(capture.id, 'processed');
      duplicates++;
      continue;
    }
    seen.set(identity, capture.id);

    const claimed = await claimCapture(capture.id, 'bndy-capture-scan', 20);
    if (!claimed) continue;

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
