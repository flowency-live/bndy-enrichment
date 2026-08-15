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

function sortOldestFirst(captures: CaptureRecord[]): CaptureRecord[] {
  return [...captures].sort((a, b) =>
    String(a.receivedAt ?? a.capturedAt ?? '').localeCompare(String(b.receivedAt ?? b.capturedAt ?? ''))
  );
}

export const handler: Handler = async () => {
  const queueUrl = process.env.CAPTURE_QUEUE_URL;
  if (!queueUrl) throw new Error('CAPTURE_QUEUE_URL is required');

  const captures = sortOldestFirst(await listUnprocessedCaptures(Number(process.env.CAPTURE_SCAN_LIMIT ?? 25)));
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
    if (!url || url.startsWith('content://')) {
      await addCaptureNote(capture.id, 'AWS processor: failed because the capture contains no usable public URL.');
      await updateCaptureStatus(capture.id, 'failed');
      failed++;
      continue;
    }

    const firstId = seen.get(url);
    if (firstId) {
      await addCaptureNote(capture.id, `AWS processor: duplicate of capture ${firstId}.`);
      await updateCaptureStatus(capture.id, 'processed');
      duplicates++;
      continue;
    }
    seen.set(url, capture.id);

    const claimed = await claimCapture(capture.id, 'bndy-capture-scan', 20);
    if (!claimed) continue;

    await sqs.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ captureId: capture.id }),
      MessageGroupId: undefined,
    }));
    queued++;
  }

  const summary = { discovered: captures.length, queued, ignored, failed, duplicates };
  console.log('Capture scan complete', summary);
  return summary;
};
