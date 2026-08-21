import { classifyCaptureTarget, type CaptureTargetClassification } from './classify-target.js';

/**
 * Facebook's Android share sheet increasingly emits opaque /share/<token>/ URLs
 * instead of the canonical object URL. The transport URL is still useful
 * provenance, but object classification must happen after following the public
 * redirect.
 */
export function refineCaptureTargetFromResolvedUrl(
  initial: CaptureTargetClassification,
  resolvedUrl?: string,
): CaptureTargetClassification {
  if (!resolvedUrl) return initial;

  // Explicit event URLs are already authoritative. Never let a login/interstitial
  // redirect downgrade them.
  if (initial.platformObjectType === 'event') return initial;

  if (initial.kind !== 'facebook_share') return initial;

  const resolved = classifyCaptureTarget({ sharedUrl: resolvedUrl });
  if (resolved.platform !== 'facebook') return initial;

  if (resolved.kind === 'facebook_event' || resolved.kind === 'facebook_url') {
    return {
      ...resolved,
      inputUrl: initial.inputUrl,
      normalisedUrl: resolved.normalisedUrl,
    };
  }

  return initial;
}
