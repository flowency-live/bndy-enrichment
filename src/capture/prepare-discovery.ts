import { classifyCaptureTarget } from './classify-target.js';
import { refineCaptureTargetFromResolvedUrl } from './resolve-target.js';
import type { CaptureRecord } from './schema.js';

/**
 * Keep the original Capture record as provenance, but give discovery the resolved
 * canonical Facebook object URL when Android supplied an opaque /share/<token>/ URL.
 * This is what makes the existing event-specific prompt deterministic for modern
 * Facebook share-sheet links rather than treating them as generic artist URLs.
 */
export function prepareCaptureForDiscovery(capture: CaptureRecord, resolvedUrl?: string): CaptureRecord {
  const initial = classifyCaptureTarget({
    sharedUrl: capture.sharedUrl,
    mimeType: capture.mimeType,
    hasImage: capture.media?.type === 'image',
  });
  const refined = refineCaptureTargetFromResolvedUrl(initial, resolvedUrl);

  if (
    initial.kind === 'facebook_share' &&
    refined.platform === 'facebook' &&
    refined.normalisedUrl &&
    (refined.kind === 'facebook_event' || refined.kind === 'facebook_url')
  ) {
    return {
      ...capture,
      sharedUrl: refined.normalisedUrl,
      rawPayload: {
        ...(capture.rawPayload ?? {}),
        captureTransportUrl: capture.sharedUrl,
        captureResolvedUrl: refined.normalisedUrl,
      },
    };
  }

  return capture;
}
