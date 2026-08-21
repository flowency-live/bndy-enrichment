export type CaptureTargetKind =
  | 'facebook_event_short'
  | 'facebook_event'
  | 'facebook_url'
  | 'instagram_url'
  | 'generic_url'
  | 'image'
  | 'unknown';

export type CapturePlatform = 'facebook' | 'instagram' | 'web' | 'unknown';
export type CapturePlatformObjectType = 'event' | 'url' | 'poster' | 'unknown';

export interface CaptureTargetClassification {
  kind: CaptureTargetKind;
  platform: CapturePlatform;
  platformObjectType: CapturePlatformObjectType;
  deterministic: boolean;
  inputUrl?: string;
  normalisedUrl?: string;
}

function parseHttpUrl(value?: string): URL | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function canonicalHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
}

function isFacebookHost(hostname: string): boolean {
  const host = canonicalHost(hostname);
  return host === 'facebook.com' || host.endsWith('.facebook.com');
}

function isInstagramHost(hostname: string): boolean {
  const host = canonicalHost(hostname);
  return host === 'instagram.com' || host.endsWith('.instagram.com');
}

export function classifyCaptureTarget(input: {
  sharedUrl?: string;
  mimeType?: string;
  hasImage?: boolean;
}): CaptureTargetClassification {
  if (input.hasImage || input.mimeType?.toLowerCase().startsWith('image/')) {
    return {
      kind: 'image',
      platform: 'unknown',
      platformObjectType: 'poster',
      deterministic: true,
      inputUrl: input.sharedUrl,
      normalisedUrl: parseHttpUrl(input.sharedUrl)?.toString(),
    };
  }

  const url = parseHttpUrl(input.sharedUrl);
  if (!url) {
    return {
      kind: 'unknown',
      platform: 'unknown',
      platformObjectType: 'unknown',
      deterministic: false,
      inputUrl: input.sharedUrl,
    };
  }

  const host = canonicalHost(url.hostname);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (host === 'fb.me' && /^\/e\//i.test(path)) {
    return {
      kind: 'facebook_event_short',
      platform: 'facebook',
      platformObjectType: 'event',
      deterministic: true,
      inputUrl: input.sharedUrl,
      normalisedUrl: url.toString(),
    };
  }

  if (isFacebookHost(url.hostname)) {
    const eventPath = /(?:^|\/)events(?:\/|$)/i.test(path);
    return {
      kind: eventPath ? 'facebook_event' : 'facebook_url',
      platform: 'facebook',
      platformObjectType: eventPath ? 'event' : 'url',
      deterministic: true,
      inputUrl: input.sharedUrl,
      normalisedUrl: url.toString(),
    };
  }

  if (isInstagramHost(url.hostname)) {
    return {
      kind: 'instagram_url',
      platform: 'instagram',
      platformObjectType: 'url',
      deterministic: true,
      inputUrl: input.sharedUrl,
      normalisedUrl: url.toString(),
    };
  }

  return {
    kind: 'generic_url',
    platform: 'web',
    platformObjectType: 'url',
    deterministic: true,
    inputUrl: input.sharedUrl,
    normalisedUrl: url.toString(),
  };
}

export function isFacebookEventTarget(target: CaptureTargetClassification): boolean {
  return target.kind === 'facebook_event' || target.kind === 'facebook_event_short';
}
