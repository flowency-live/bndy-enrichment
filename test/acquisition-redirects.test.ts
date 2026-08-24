import { describe, expect, it } from 'vitest';
import { HttpAcquisitionRouter, type HostResolver } from '../src/sources/runner/acquisition.js';

const publicResolver: HostResolver = {
  resolve: async () => ['93.184.216.34'],
};

describe('HTTP acquisition redirect safety', () => {
  it('follows an opted-in relative redirect while preserving requested source identity', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(String(input));
      expect(init?.redirect).toBe('manual');
      if (calls.length === 1) {
        return new Response(null, { status: 301, headers: { location: 'searchbands.php' } });
      }
      return new Response('<html><body>ok</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }) as typeof fetch;

    const router = new HttpAcquisitionRouter(publicResolver, fetchImpl);
    const requested = 'https://www.lemonrock.com/advancedsearchbands.php?_start=0';
    const result = await router.acquire({ url: requested, followRedirects: true, kind: 'html' });

    expect(calls).toEqual([
      requested,
      'https://www.lemonrock.com/searchbands.php',
    ]);
    expect(result.sourceUrl).toBe(requested);
    expect(result.body).toContain('<body>ok</body>');
    expect(result.httpStatus).toBe(200);
  });

  it('revalidates every redirect hop and blocks a redirect to a private address', async () => {
    const resolver: HostResolver = {
      resolve: async (hostname) => hostname === 'internal.example' ? ['10.0.0.7'] : ['93.184.216.34'],
    };
    let fetches = 0;
    const fetchImpl = (async () => {
      fetches += 1;
      return new Response(null, { status: 302, headers: { location: 'https://internal.example/private' } });
    }) as typeof fetch;

    const router = new HttpAcquisitionRouter(resolver, fetchImpl);
    await expect(router.acquire({ url: 'https://www.lemonrock.com/start', followRedirects: true }))
      .rejects.toThrow('blocked address');
    expect(fetches).toBe(1);
  });

  it('retains strict no-redirect behaviour unless an adapter opts in', async () => {
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe('error');
      return new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    }) as typeof fetch;
    const router = new HttpAcquisitionRouter(publicResolver, fetchImpl);
    await expect(router.acquire({ url: 'https://example.com/' })).resolves.toMatchObject({ httpStatus: 200 });
  });
});
