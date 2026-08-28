import { timingSafeEqual } from 'node:crypto';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GraphReader } from '../knowledge/graph-read.js';
import { LEMONROCK_SOURCES } from '../sources/adapters/lemonrock/sources.js';
import { ONTHECASE_SOURCES } from '../sources/adapters/onthecase/sources.js';
import { SCENICEYE_SOURCES } from '../sources/adapters/sceniceye/sources.js';
import { waveOneSources } from '../cli/seed-wave1-sources.js';

// Backline Evidence Explorer admin read API (Lambda Function URL).
//
// Read-only, bounded, bearer-authenticated with the existing BNDY service
// token. Never scans the table; every route maps to keyed gets or indexed
// queries in GraphReader. Canonical writes are unaffected: this handler has
// no write permissions and no write code.

type UrlEvent = {
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  requestContext?: { http?: { method?: string } };
};

type UrlResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const JSON_HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
};

// The registry has no list-all access pattern by design (no scans). The
// explorer lists the known source families and reads each config by key.
function knownSourceIds(): string[] {
  const ids = new Set<string>();
  for (const source of LEMONROCK_SOURCES) ids.add(source.id);
  for (const source of ONTHECASE_SOURCES) ids.add(source.id);
  for (const source of SCENICEYE_SOURCES) ids.add(source.id);
  for (const source of waveOneSources()) ids.add(source.id);
  return [...ids].sort();
}

export type TokenLoader = () => Promise<string>;

let cachedToken: string | undefined;

async function defaultTokenLoader(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (process.env.BNDY_SERVICE_TOKEN) {
    cachedToken = process.env.BNDY_SERVICE_TOKEN;
    return cachedToken;
  }
  const secretName = process.env.BNDY_SERVICE_SECRET_NAME ?? 'bndy/mcp-service';
  const secrets = new SecretsManagerClient({});
  const output = await secrets.send(new GetSecretValueCommand({ SecretId: secretName }));
  if (!output.SecretString) throw new Error(`Service secret ${secretName} has no SecretString`);
  const parsed = JSON.parse(output.SecretString) as Record<string, unknown>;
  const token = typeof parsed.token === 'string' ? parsed.token
    : typeof parsed.MCP_SERVICE_TOKEN === 'string' ? parsed.MCP_SERVICE_TOKEN : undefined;
  if (!token) throw new Error(`Service secret ${secretName} must contain token`);
  cachedToken = token;
  return token;
}

function bearerFrom(event: UrlEvent): string | undefined {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function tokensMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function respond(statusCode: number, body: unknown): UrlResult {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

export type HandlerDependencies = {
  reader: GraphReader;
  loadToken: TokenLoader;
};

export function createHandler(deps?: Partial<HandlerDependencies>) {
  const loadToken = deps?.loadToken ?? defaultTokenLoader;
  let readerInstance = deps?.reader;

  function reader(): GraphReader {
    if (!readerInstance) {
      const tableName = process.env.STATE_TABLE;
      if (!tableName) throw new Error('STATE_TABLE is required');
      readerInstance = new GraphReader(tableName);
    }
    return readerInstance;
  }

  return async function handler(event: UrlEvent): Promise<UrlResult> {
    const method = event.requestContext?.http?.method ?? 'GET';
    const path = (event.rawPath ?? '/').replace(/\/+$/, '') || '/';

    if (method === 'OPTIONS') return { statusCode: 204, headers: JSON_HEADERS, body: '' };
    if (method !== 'GET') return respond(405, { error: 'GET only' });
    if (path === '/health') return respond(200, { ok: true });

    const provided = bearerFrom(event);
    if (!provided) return respond(401, { error: 'Missing bearer token' });
    const expected = await loadToken();
    if (!tokensMatch(provided, expected)) return respond(401, { error: 'Invalid bearer token' });

    const query = new URLSearchParams(event.rawQueryString ?? '');
    const limitParam = Number.parseInt(query.get('limit') ?? '', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 5), 200) : 60;

    try {
      if (path === '/sources') {
        const sources = await reader().listSources(knownSourceIds());
        return respond(200, {
          sources: sources.map((source) => ({
            ref: `source:${source.id}`,
            id: source.id,
            name: source.name,
            enabled: source.enabled,
            shadow: source.shadow,
            writerAuthority: source.writerAuthority,
            health: source.health,
            region: source.region,
          })),
        });
      }

      if (path === '/graph') {
        const node = query.get('node');
        if (!node) return respond(400, { error: 'node query parameter is required' });
        const neighborhood = await reader().neighborhood(node, limit);
        return respond(200, neighborhood);
      }

      if (path === '/trust-loop') {
        const runs = await reader().listTrustLoopRuns(Math.min(limit, 25));
        return respond(200, { runs, canonicalWritesEnabled: false });
      }

      return respond(404, { error: `Unknown path ${path}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Invalid|Unknown node ref/.test(message)) return respond(400, { error: message });
      console.error('backline-admin-api failure', message);
      return respond(500, { error: 'Internal error' });
    }
  };
}

export const handler = createHandler();
