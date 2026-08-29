import { describe, expect, it } from 'vitest';
import { resolveCitationDestination } from '../src/enrichment/citation-destination.js';
import type { HostResolver } from '../src/sources/runner/acquisition.js';

const publicResolver: HostResolver = {
  resolve: async () => ['93.184.216.34'],
};

function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

describe('citation destination resolution', () => {
  it('resolves a grounding redirect chain to its public HTTPS destination and preserves every hop', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(String(input));
      expect(init?.redirect).toBe('manual');
      if (calls.length === 1) return redirect('https://vertexaisearch.cloud.google.com/hop2');
      if (calls.length === 2) return redirect('https://whittlesoldham.com/');
      return new Response('<html></html>', { status: 200 });
    }) as typeof fetch;

    const result = await resolveCitationDestination('https://vertexaisearch.cloud.google.com/hop1', {
      resolver: publicResolver,
      fetchImpl,
    });

    expect(result.status).toBe('resolved');
    expect(result.destinationUrl).toBe('https://whittlesoldham.com/');
    expect(result.providerUrl).toBe('https://vertexaisearch.cloud.google.com/hop1');
    expect(result.hops).toEqual([
      'https://vertexaisearch.cloud.google.com/hop1',
      'https://vertexaisearch.cloud.google.com/hop2',
      'https://whittlesoldham.com/',
    ]);
  });

  it('fails closed when any hop downgrades to HTTP', async () => {
    const fetchImpl = (async () => redirect('http://whittlesoldham.com/')) as typeof fetch;
    const result = await resolveCitationDestination('https://provider.example/citation', {
      resolver: publicResolver,
      fetchImpl,
    });
    expect(result.status).toBe('failed-closed');
    expect(result.destinationUrl).toBeUndefined();
    expect(result.failureReason).toContain('HTTPS');
  });

  it('fails closed when a hop hostname resolves to a private address', async () => {
    const resolver: HostResolver = {
      resolve: async (hostname) => (hostname === 'internal.example' ? ['10.0.0.7'] : ['93.184.216.34']),
    };
    let fetches = 0;
    const fetchImpl = (async () => {
      fetches += 1;
      return redirect('https://internal.example/private');
    }) as typeof fetch;

    const result = await resolveCitationDestination('https://provider.example/citation', { resolver, fetchImpl });
    expect(result.status).toBe('failed-closed');
    expect(result.failureReason).toContain('blocked address');
    expect(fetches).toBe(1);
  });

  it('fails closed beyond the hop limit instead of following forever', async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      return redirect(`https://provider.example/hop${n}`);
    }) as typeof fetch;
    const result = await resolveCitationDestination('https://provider.example/hop0', {
      resolver: publicResolver,
      fetchImpl,
      maxHops: 2,
    });
    expect(result.status).toBe('failed-closed');
    expect(result.failureReason).toContain('redirect hops');
  });

  it('fails closed on a redirect loop', async () => {
    const fetchImpl = (async () => redirect('https://provider.example/hop0')) as typeof fetch;
    const result = await resolveCitationDestination('https://provider.example/hop0', {
      resolver: publicResolver,
      fetchImpl,
    });
    expect(result.status).toBe('failed-closed');
    expect(result.failureReason).toContain('loop');
  });

  it('fails closed on an error status and on fetch failure, retaining the provider URL', async () => {
    const errorFetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
    const notFound = await resolveCitationDestination('https://provider.example/gone', {
      resolver: publicResolver,
      fetchImpl: errorFetch,
    });
    expect(notFound.status).toBe('failed-closed');
    expect(notFound.failureReason).toContain('HTTP 404');
    expect(notFound.providerUrl).toBe('https://provider.example/gone');

    const throwingFetch = (async () => {
      throw new Error('network unreachable');
    }) as typeof fetch;
    const failed = await resolveCitationDestination('https://provider.example/x', {
      resolver: publicResolver,
      fetchImpl: throwingFetch,
    });
    expect(failed.status).toBe('failed-closed');
    expect(failed.failureReason).toContain('network unreachable');
  });

  it('rejects a non-HTTPS or credentialed provider URL before any network activity', async () => {
    let fetches = 0;
    const fetchImpl = (async () => {
      fetches += 1;
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const plain = await resolveCitationDestination('http://provider.example/citation', {
      resolver: publicResolver,
      fetchImpl,
    });
    expect(plain.status).toBe('failed-closed');

    const withCreds = await resolveCitationDestination('https://user:pass@provider.example/citation', {
      resolver: publicResolver,
      fetchImpl,
    });
    expect(withCreds.status).toBe('failed-closed');
    expect(fetches).toBe(0);
  });
});
