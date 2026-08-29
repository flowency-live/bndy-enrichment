import { describe, expect, it } from 'vitest';
import { captureBatchIdentity, storedImageKey, usableSharedText } from '../src/handlers/capture-scan.js';
import type { CaptureRecord } from '../src/capture/schema.js';

function capture(overrides: Partial<CaptureRecord> = {}): CaptureRecord {
  return {
    id: 'capture-1',
    mimeType: 'image/jpeg',
    suggestedEntityType: 'event',
    status: 'unprocessed',
    ...overrides,
  };
}

describe('storedImageKey', () => {
  it('uses the first-class Capture media object used by web Dropzone and current Android clients', () => {
    expect(storedImageKey(capture({
      media: {
        type: 'image',
        bucket: 'bndy-capture-images-test',
        key: 'captures/public/2026/08/22/poster.jpg',
        mimeType: 'image/jpeg',
      },
      rawPayload: { transport: 'web_dropzone', public: true },
    }))).toBe('s3://bndy-capture-images-test/captures/public/2026/08/22/poster.jpg');
  });

  it('keeps the legacy rawPayload image location as a backwards-compatible fallback', () => {
    expect(storedImageKey(capture({
      rawPayload: {
        imageBucket: 'legacy-bucket',
        imageKey: 'captures/legacy/poster.jpg',
      },
    }))).toBe('s3://legacy-bucket/captures/legacy/poster.jpg');
  });

  it('prefers first-class media over the legacy rawPayload location', () => {
    expect(storedImageKey(capture({
      media: {
        type: 'image',
        bucket: 'current-bucket',
        key: 'captures/public/current.jpg',
        mimeType: 'image/jpeg',
      },
      rawPayload: {
        imageBucket: 'legacy-bucket',
        imageKey: 'captures/legacy/poster.jpg',
      },
    }))).toBe('s3://current-bucket/captures/public/current.jpg');
  });

  it('does not treat a text Capture as an image merely because raw payload contains image-looking fields', () => {
    expect(storedImageKey(capture({
      mimeType: 'text/plain',
      rawPayload: {
        imageBucket: 'legacy-bucket',
        imageKey: 'captures/legacy/poster.jpg',
      },
    }))).toBeUndefined();
  });
});

describe('text Capture intake', () => {
  it('accepts meaningful event text without requiring a URL or stored image', () => {
    const item = capture({
      mimeType: 'text/plain',
      sharedText: 'The Torrists at Disley Club on 26 September at 9pm',
    });

    expect(usableSharedText(item)).toBe(item.sharedText);
    expect(captureBatchIdentity(item)).toMatch(/^text:[0-9a-f]{64}$/);
  });

  it('normalises equivalent text for scanner-batch deduplication', () => {
    const first = capture({ mimeType: 'text/plain', sharedText: 'Band at Venue on Friday' });
    const second = capture({ mimeType: 'text/plain', sharedText: '  BAND   AT venue ON friday  ' });
    expect(captureBatchIdentity(first)).toBe(captureBatchIdentity(second));
  });

  it('does not spend interpretation work on empty or trivial text', () => {
    expect(usableSharedText(capture({ mimeType: 'text/plain', sharedText: 'gig' }))).toBeUndefined();
  });
});
