import { describe, expect, it } from 'vitest';
import { buildCapturePrompt } from '../src/capture/discover.js';
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

  it('activates the exact Facebook Event discovery prompt after resolving an opaque share URL', () => {
    const prepared = prepareCaptureForDiscovery(
      capture('https://www.facebook.com/share/18FZZvzpfF/'),
      'https://www.facebook.com/events/1052283023872867/',
    );

    const prompt = buildCapturePrompt(prepared, '', 90);
    expect(prompt).toContain('FACEBOOK EVENT URL RULES');
    expect(prompt).toContain('sharedUrl: https://www.facebook.com/events/1052283023872867/');
    expect(prompt).toContain('deterministicTargetKind: facebook_event');
    expect(prompt).toContain('deterministicObjectType: event');
    expect(prompt).toContain('Identify only the specific event represented by the supplied URL');
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

  it('uses event-message rules for text-only submissions instead of URL-share rules', () => {
    const prompt = buildCapturePrompt({
      id: 'capture-text',
      sharedText: 'The Torrists at Disley Club on 26 September at 9pm',
      mimeType: 'text/plain',
      suggestedEntityType: 'event',
      status: 'processing',
    }, '', 90);

    expect(prompt).toContain('TEXT EVENT MESSAGE RULES');
    expect(prompt).toContain('can be classified as event even when it has no public URL');
    expect(prompt).not.toContain('PUBLIC URL SHARE RULES');
  });
});
