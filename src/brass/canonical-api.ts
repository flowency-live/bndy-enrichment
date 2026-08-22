import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { BrassBandProjectionPackage } from './projection.js';

export interface CanonicalBandResult {
  id: string;
  name: string;
  action: 'created' | 'matched';
  publicationScopes?: string[];
  discoveryScopes?: string[];
  performerKind?: string;
  matchedBy?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value as string[] : undefined;
}

export class BrassCanonicalApi {
  private readonly secrets = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'eu-west-2' });
  private cachedToken?: string;

  constructor(
    private readonly apiBase = (process.env.BNDY_API_BASE ?? 'https://api.bndy.co.uk').replace(/\/$/, ''),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async token(): Promise<string> {
    if (this.cachedToken) return this.cachedToken;
    if (process.env.BNDY_SERVICE_TOKEN) {
      this.cachedToken = process.env.BNDY_SERVICE_TOKEN;
      return this.cachedToken;
    }

    const secretName = process.env.BNDY_SERVICE_SECRET_NAME ?? 'bndy/mcp-service';
    const output = await this.secrets.send(new GetSecretValueCommand({ SecretId: secretName }));
    if (!output.SecretString) throw new Error(`BNDY service secret ${secretName} has no SecretString`);
    const parsed = asRecord(JSON.parse(output.SecretString));
    const token = stringField(parsed.token) ?? stringField(parsed.MCP_SERVICE_TOKEN);
    if (!token) throw new Error(`BNDY service secret ${secretName} must contain token`);
    this.cachedToken = token;
    return token;
  }

  private async post(path: string, payload: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await this.fetchImpl(`${this.apiBase}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await this.token()}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let body: unknown = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
    const record = asRecord(body);
    if (!response.ok) {
      throw new Error(`BNDY API ${response.status} ${path}: ${JSON.stringify(record)}`);
    }
    return { status: response.status, body: record };
  }

  async ensureBand(projection: BrassBandProjectionPackage): Promise<CanonicalBandResult> {
    if (!projection.publishable) throw new Error(`Refusing non-publishable projection ${projection.proposedId}`);
    if (projection.edition !== 'brass') throw new Error(`Refusing non-brass projection ${projection.proposedId}`);
    if (projection.record.publicationScopes.length !== 1 || projection.record.publicationScopes[0] !== 'brass') {
      throw new Error(`Band ${projection.proposedId} must be brass-only at canonical creation`);
    }
    if (projection.record.discoveryScopes.length !== 1 || projection.record.discoveryScopes[0] !== 'brass') {
      throw new Error(`Band ${projection.proposedId} must have brass-only discovery scope`);
    }

    const out = await this.post('/api/artists/find-or-create/mcp', {
      name: projection.record.name,
      location: projection.record.location,
      locationType: 'region',
      canCreate: true,
      confirmNew: true,
      artistType: projection.record.artist_type,
      websiteUrl: projection.record.websiteUrl,
      nameVariants: projection.record.name_variants,
      externalIds: [{ source: 'bndy-brass-intelligence', id: projection.proposedId }],
      verifiedSourceName: projection.record.name,
      bio: '',
      performerKind: projection.record.performerKind,
      publicationScopes: projection.record.publicationScopes,
      discoveryScopes: projection.record.discoveryScopes,
      names: projection.record.names,
      domainProfiles: projection.record.domainProfiles,
      acts: projection.record.acts,
    });

    const artist = asRecord(out.body.artist);
    const id = stringField(artist.id) ?? stringField(out.body.existingArtistId);
    if (!id) throw new Error(`Artist resolution returned no ID: ${JSON.stringify(out.body)}`);

    const actionRaw = stringField(out.body.action);
    const action: 'created' | 'matched' = actionRaw === 'created' || out.status === 201 ? 'created' : 'matched';
    const publicationScopes = stringArray(artist.publicationScopes) ?? stringArray(out.body.publicationScopes);
    const discoveryScopes = stringArray(artist.discoveryScopes) ?? stringArray(out.body.discoveryScopes);
    const performerKind = stringField(artist.performerKind) ?? stringField(out.body.performerKind);

    if (action === 'matched' && !(publicationScopes ?? []).includes('brass')) {
      throw new Error(`SCOPE_CONFLICT:${id}:${projection.record.name}:matched canonical Artist is not brass-scoped`);
    }
    if (action === 'created' && !(publicationScopes ?? []).includes('brass')) {
      throw new Error(`ATOMIC_SCOPE_FAILURE:${id}:${projection.record.name}:created Artist did not return brass publication scope`);
    }

    return {
      id,
      name: stringField(artist.name) ?? projection.record.name,
      action,
      publicationScopes,
      discoveryScopes,
      performerKind,
      matchedBy: stringField(out.body.matchedBy),
    };
  }
}
