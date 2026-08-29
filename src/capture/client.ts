import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { CaptureRecordSchema, type CaptureRecord } from './schema.js';

export type CapturePublicOutcome = {
  state: 'added' | 'already_exists' | 'processed' | 'needs_review' | 'could_not_resolve' | 'ignored';
  message?: string;
  result?: {
    artist?: {
      name: string;
      action?: string;
      id?: string;
    };
    event?: {
      id: string;
      date: string;
      time: string;
      venue: string;
      action?: string;
      venueAction?: string;
      url: string;
    };
  };
};

const secrets = new SecretsManagerClient({});
let cachedToken: string | undefined;

async function captureToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (process.env.CAPTURE_TOKEN) {
    cachedToken = process.env.CAPTURE_TOKEN;
    return cachedToken;
  }

  const secretId = process.env.CAPTURE_SECRET_NAME ?? 'bndy/capture-service';
  const out = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!out.SecretString) throw new Error(`Capture secret ${secretId} has no SecretString`);
  const parsed = JSON.parse(out.SecretString);
  cachedToken = parsed.token ?? parsed.CAPTURE_TOKEN;
  if (!cachedToken) throw new Error(`Capture secret ${secretId} must contain token`);
  return cachedToken;
}

function baseUrl(): string {
  return (process.env.CAPTURE_API_BASE ?? 'https://capture.bndy.co.uk').replace(/\/$/, '');
}

async function request(path: string, init: RequestInit = {}, allowStatuses: number[] = []): Promise<any> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${await captureToken()}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let body: any = undefined;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }

  if (!res.ok && !allowStatuses.includes(res.status)) {
    throw new Error(`Capture API ${res.status} ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return { status: res.status, body };
}

export async function listUnprocessedCaptures(limit = 25): Promise<CaptureRecord[]> {
  const out = await request(`/v1/captures?status=unprocessed&limit=${Math.max(1, Math.min(limit, 100))}`);
  const items = out.body?.items ?? out.body?.captures ?? [];
  return items.map((item: unknown) => CaptureRecordSchema.parse(item));
}

export async function getCapture(id: string): Promise<CaptureRecord> {
  const out = await request(`/v1/captures/${encodeURIComponent(id)}`);
  return CaptureRecordSchema.parse(out.body?.capture ?? out.body);
}

export async function claimCapture(id: string, workerId: string, leaseMinutes = 15): Promise<boolean> {
  const leaseUntil = new Date(Date.now() + leaseMinutes * 60_000).toISOString();
  const out = await request(`/v1/captures/${encodeURIComponent(id)}/claim`, {
    method: 'PATCH',
    body: JSON.stringify({ expectedStatus: 'unprocessed', workerId, leaseUntil }),
  }, [404, 409]);

  if (out.status === 200) return true;
  if (out.status === 409) return false;

  // Backwards-compatible fallback while the capture stack is being upgraded.
  // This is not atomic, so remove this fallback once /claim is deployed everywhere.
  if (out.status === 404) {
    await updateCaptureStatus(id, 'processing');
    return true;
  }
  return false;
}

export async function updateCaptureStatus(
  id: string,
  status: CaptureRecord['status'],
  publicOutcome?: CapturePublicOutcome,
): Promise<void> {
  await request(`/v1/captures/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(publicOutcome ? { publicOutcome } : {}) }),
  });
}

export async function addCaptureNote(id: string, note: string): Promise<void> {
  await request(`/v1/captures/${encodeURIComponent(id)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}
