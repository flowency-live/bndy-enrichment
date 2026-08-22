import { describe, expect, it } from 'vitest';
import { storedImageKey } from '../src/handlers/capture-scan.js';
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
