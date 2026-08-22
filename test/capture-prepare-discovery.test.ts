import { describe, expect, it } from 'vitest';
import { prepareCaptureForDiscovery } from '../src/capture/prepare-discovery.js';
import type { CaptureRecord } from '../src/capture/schema.js';

function capture(url: string): CaptureRecord {
  return {
    id: 'capture-123',
    sharedUrl: url,
    sharedText: url,
    mimeType: 'text/plain',
    suggestedEntityType: 'unknown',
    status: 'processing',
  };
}

describe('prepareCaptureForDiscovery', () => {
  it('replaces an opaque Facebook share transport URL with the resolved event URL for discovery', () => {
    const original = capture('https://www.facebook.com/share/18FZZvzpfF/');
    const prepared = prepareCaptureForDiscovery(
      original,
      'https://www.facebook.com/events/1052283023872867/',
    );

    expect(prepared.sharedUrl).toBe('https://www.facebook.com/events/1052283023872867/');
    expect(prepared.sharedText).toBe(original.sharedText);
    expect(prepared.rawPayload).toMatchObject({
      captureTransportUrl: 'https://www.facebook.com/share/18FZZvzpfF/',
      captureResolvedUrl: 'https://www.facebook.com/events/1052283023872867/',
    });
  });

  it('does not rewrite a share URL when the public resolution is not a Facebook object', () => {
    const original = capture('https://www.facebook.com/share/18FZZvzpfF/');
    const prepared = prepareCaptureForDiscovery(original, 'https://example.com/not-facebook');
    expect(prepared).toEqual(original);
  });

  it('does not rewrite an already canonical Facebook event URL', () => {
    const original = capture('https://www.facebook.com/events/1052283023872867/');
    const prepared = prepareCaptureForDiscovery(original, 'https://www.facebook.com/login/');
    expect(prepared).toEqual(original);
  });
});
