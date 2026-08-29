import { isIP } from 'node:net';
import { assertSafeUrl, isPrivateAddress, DnsHostResolver, type HostResolver } from '../sources/runner/acquisition.js';

// Remaining-work item 2 (BACKLINE-TRUST-LAYER-TECHNICAL-STATUS-2026-08-29):
// provider url_citation URLs are Google grounding redirect URLs. Before any
// activation decision, Backline must safely resolve and preserve the public
// destination ALONGSIDE the immutable provider URL. This module resolves one
// citation URL to its final public destination without retaining any body
// bytes, failing closed on anything unsafe or unresolved.
//
// Trust rules enforced here:
// - HTTPS-only at the provider URL and at EVERY redirect hop.
// - SSRF-safe: assertSafeUrl plus DNS re-resolution and private-address
//   rejection per hop (same discipline as HttpAcquisitionRouter).
// - Bounded: hop and timeout limits; no retries.
// - Fail closed: any error, unsafe hop, non-redirect error status or loop
//   yields status 'failed-closed' with a reason and NO destination. The
//   provider URL remains the immutable citation of record either way.

export const DEFAULT_MAX_REDIRECT_HOPS = 3;
export const DEFAULT_HOP_TIMEOUT_MS = 5_000;

export interface CitationDestinationResult {
  providerUrl: string;
  status: 'resolved' | 'failed-closed';
  destinationUrl?: string;
  hops: string[];
  failureReason?: string;
}

export interface CitationDestinationOptions {
  maxHops?: number;
  hopTimeoutMs?: number;
  resolver?: HostResolver;
  fetchImpl?: typeof fetch;
}

function assertSafeHttpsUrl(urlText: string): URL {
  const url = assertSafeUrl(urlText);
  if (url.protocol !== 'https:') {
    throw new Error(`Citation destinations must be HTTPS: ${url.protocol}//${url.hostname}`);
  }
  return url;
}

async function assertResolvedSafe(resolver: HostResolver, url: URL): Promise<void> {
  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) {
    throw new Error(`Citation hop resolves to blocked address: ${url.hostname}`);
  }
  const addresses = await resolver.resolve(url.hostname);
  if (addresses.length === 0) throw new Error(`Citation hostname did not resolve: ${url.hostname}`);
  const unsafe = addresses.find(isPrivateAddress);
  if (unsafe) throw new Error(`Citation hostname resolves to blocked address: ${unsafe}`);
}

export async function resolveCitationDestination(
  providerUrl: string,
  options: CitationDestinationOptions = {},
): Promise<CitationDestinationResult> {
  const maxHops = options.maxHops ?? DEFAULT_MAX_REDIRECT_HOPS;
  const hopTimeoutMs = options.hopTimeoutMs ?? DEFAULT_HOP_TIMEOUT_MS;
  const resolver = options.resolver ?? new DnsHostResolver();
  const fetchImpl = options.fetchImpl ?? fetch;
  const hops: string[] = [];

  const failed = (failureReason: string): CitationDestinationResult => ({
    providerUrl,
    status: 'failed-closed',
    hops,
    failureReason,
  });

  let current: URL;
  try {
    current = assertSafeHttpsUrl(providerUrl);
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error));
  }

  const seen = new Set<string>();
  for (let hop = 0; hop <= maxHops; hop += 1) {
    if (seen.has(current.toString())) return failed(`Citation redirect loop at ${current.hostname}`);
    seen.add(current.toString());
    try {
      await assertResolvedSafe(resolver, current);
    } catch (error) {
      return failed(error instanceof Error ? error.message : String(error));
    }
    hops.push(current.toString());

    let response: Response;
    try {
      response = await fetchImpl(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(hopTimeoutMs),
      });
    } catch (error) {
      return failed(`Citation hop fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      await response.body?.cancel();
    } catch {
      // Body bytes are never retained; a cancel failure does not change the outcome.
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return failed(`Redirect status ${response.status} without location`);
      if (hop === maxHops) return failed(`Citation exceeded ${maxHops} redirect hops`);
      let next: URL;
      try {
        next = assertSafeHttpsUrl(new URL(location, current).toString());
      } catch (error) {
        return failed(error instanceof Error ? error.message : String(error));
      }
      current = next;
      continue;
    }

    if (response.status >= 200 && response.status < 300) {
      return { providerUrl, status: 'resolved', destinationUrl: current.toString(), hops };
    }

    return failed(`Citation destination returned HTTP ${response.status}`);
  }

  return failed(`Citation exceeded ${maxHops} redirect hops`);
}
