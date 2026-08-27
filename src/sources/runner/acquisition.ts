import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import type { FetchedSource, FetchedSourceKind } from './types.js';

export type AcquisitionRequest = {
  url: string;
  kind?: FetchedSourceKind;
  method?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  complete?: boolean;
  fetchMethod?: string;
  /** Follow external HTTP redirects only when the adapter explicitly opts in. Every hop is SSRF-validated. */
  followRedirects?: boolean;
  /** Maximum validated redirect hops when followRedirects is enabled. */
  maxRedirects?: number;
  /** Preserve explicitly accepted non-2xx responses as evidence instead of throwing. */
  acceptedStatuses?: number[];
  /** Browser-only: return rendered document text instead of serialized HTML. */
  bodyMode?: 'html' | 'innerText';
  /** Browser-only hydration grace period after navigation. */
  settleMs?: number;
};

export interface AcquisitionRouter {
  acquire(request: AcquisitionRequest): Promise<FetchedSource>;
}

export interface HostResolver {
  resolve(hostname: string): Promise<string[]>;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_REDIRECTS = 5;

function privateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts as [number, number, number, number];
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function privateIpv6(address: string): boolean {
  const value = address.toLowerCase().split('%')[0] ?? '';
  return value === '::'
    || value === '::1'
    || value.startsWith('fc')
    || value.startsWith('fd')
    || value.startsWith('fe8')
    || value.startsWith('fe9')
    || value.startsWith('fea')
    || value.startsWith('feb');
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return privateIpv4(address);
  if (family === 6) return privateIpv6(address);
  return true;
}

export function assertSafeUrl(urlText: string): URL {
  const url = new URL(urlText);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Unsupported source protocol: ${url.protocol}`);
  }
  if (url.username || url.password) throw new Error('Source URLs may not contain credentials');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error(`Blocked source hostname: ${hostname}`);
  }
  if (isIP(hostname) && isPrivateAddress(hostname)) {
    throw new Error(`Blocked private source address: ${hostname}`);
  }
  return url;
}

export class DnsHostResolver implements HostResolver {
  async resolve(hostname: string): Promise<string[]> {
    if (isIP(hostname)) return [hostname];
    return (await lookup(hostname, { all: true, verbatim: true })).map((item) => item.address);
  }
}

export class HttpAcquisitionRouter implements AcquisitionRouter {
  constructor(
    private readonly resolver: HostResolver = new DnsHostResolver(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async assertResolvedSafe(url: URL): Promise<void> {
    const addresses = await this.resolver.resolve(url.hostname);
    if (addresses.length === 0) throw new Error(`Source hostname did not resolve: ${url.hostname}`);
    const unsafe = addresses.find(isPrivateAddress);
    if (unsafe) throw new Error(`Source hostname resolves to blocked address: ${unsafe}`);
  }

  async acquire(request: AcquisitionRequest): Promise<FetchedSource> {
    const requestedUrl = assertSafeUrl(request.url);
    let url = requestedUrl;
    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxBytes = request.maxBytes ?? DEFAULT_MAX_BYTES;
    const maxRedirects = request.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response: Response;
      let redirects = 0;

      while (true) {
        await this.assertResolvedSafe(url);
        response = await this.fetchImpl(url, {
          method: request.method ?? 'GET',
          headers: request.headers,
          signal: controller.signal,
          redirect: request.followRedirects ? 'manual' : 'error',
        });

        if (request.followRedirects && response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location) throw new Error(`Source redirect HTTP ${response.status} did not include Location`);
          if (redirects >= maxRedirects) throw new Error(`Source exceeded ${maxRedirects} redirect hop cap`);
          url = assertSafeUrl(new URL(location, url).toString());
          redirects += 1;
          continue;
        }
        break;
      }

      if (!response.ok && !request.acceptedStatuses?.includes(response.status)) {
        throw new Error(`Source fetch returned HTTP ${response.status}`);
      }

      const declaredLength = Number(response.headers.get('content-length') ?? '0');
      if (declaredLength > maxBytes) throw new Error(`Source response exceeds ${maxBytes} byte cap`);

      const buffer = new Uint8Array(await response.arrayBuffer());
      if (buffer.byteLength > maxBytes) throw new Error(`Source response exceeds ${maxBytes} byte cap`);
      const body = new TextDecoder().decode(buffer);
      const contentType = response.headers.get('content-type') ?? undefined;

      return {
        kind: request.kind ?? kindFromContentType(contentType),
        body,
        // Keep source identity/provenance on the requested URL. Redirect targets are transport detail.
        sourceUrl: requestedUrl.toString(),
        fetchMethod: request.fetchMethod ?? 'http',
        fetchedAt: new Date().toISOString(),
        complete: request.complete ?? true,
        httpStatus: response.status,
        contentType,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function kindFromContentType(contentType?: string): FetchedSourceKind {
  if (contentType?.includes('json')) return 'json';
  if (contentType?.includes('html')) return 'html';
  if (contentType?.includes('csv')) return 'csv';
  return 'text';
}
