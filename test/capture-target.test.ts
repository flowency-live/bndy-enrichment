import { describe, expect, it } from 'vitest';
import { classifyCaptureTarget, isFacebookEventTarget } from '../src/capture/classify-target.js';
import { refineCaptureTargetFromResolvedUrl } from '../src/capture/resolve-target.js';

describe('classifyCaptureTarget', () => {
  it('classifies fb.me event short links without AI', () => {
    const result = classifyCaptureTarget({ sharedUrl: 'https://fb.me/e/gwHFuwf71', mimeType: 'text/plain' });
    expect(result).toMatchObject({
      kind: 'facebook_event_short',
      platform: 'facebook',
      platformObjectType: 'event',
      deterministic: true,
    });
    expect(isFacebookEventTarget(result)).toBe(true);
  });

  it.each([
    'https://www.facebook.com/events/123456789012345/',
    'https://m.facebook.com/events/123456789012345/?ref=share',
    'https://facebook.com/some-page/events/123456789012345',
  ])('classifies Facebook event URLs: %s', (url) => {
    const result = classifyCaptureTarget({ sharedUrl: url });
    expect(result.kind).toBe('facebook_event');
    expect(result.platformObjectType).toBe('event');
    expect(isFacebookEventTarget(result)).toBe(true);
  });

  it('treats Facebook /share tokens as transport URLs until resolved', () => {
    const initial = classifyCaptureTarget({ sharedUrl: 'https://www.facebook.com/share/1YHQ83pwfB/' });
    expect(initial).toMatchObject({
      kind: 'facebook_share',
      platform: 'facebook',
      platformObjectType: 'unknown',
      deterministic: true,
    });
    expect(isFacebookEventTarget(initial)).toBe(false);

    const resolved = refineCaptureTargetFromResolvedUrl(
      initial,
      'https://www.facebook.com/events/1555240929628880/',
    );
    expect(resolved).toMatchObject({
      kind: 'facebook_event',
      platform: 'facebook',
      platformObjectType: 'event',
      inputUrl: 'https://www.facebook.com/share/1YHQ83pwfB/',
      normalisedUrl: 'https://www.facebook.com/events/1555240929628880/',
    });
    expect(isFacebookEventTarget(resolved)).toBe(true);
  });

  it('does not misclassify a normal Facebook profile as an event', () => {
    const result = classifyCaptureTarget({ sharedUrl: 'https://www.facebook.com/example.band' });
    expect(result).toMatchObject({
      kind: 'facebook_url',
      platform: 'facebook',
      platformObjectType: 'url',
    });
    expect(isFacebookEventTarget(result)).toBe(false);
  });

  it('classifies image shares as poster/image evidence before URL semantics', () => {
    const result = classifyCaptureTarget({
      sharedUrl: 'https://www.facebook.com/example.band',
      mimeType: 'image/jpeg',
      hasImage: true,
    });
    expect(result).toMatchObject({
      kind: 'image',
      platformObjectType: 'poster',
    });
  });

  it('classifies ordinary websites and invalid input safely', () => {
    expect(classifyCaptureTarget({ sharedUrl: 'https://example.com/gigs' }).kind).toBe('generic_url');
    expect(classifyCaptureTarget({ sharedUrl: 'not a url' }).kind).toBe('unknown');
  });
});
