export interface VerifiedExistingBand {
  id: string;
  name?: string;
  publicationScopes: string[];
  discoveryScopes?: string[];
  performerKind?: string;
  locationLat?: number;
  locationLng?: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function duplicateArtistIdFromError(message: string): string | null {
  if (!message.includes('BNDY API 409') || !message.includes('existingArtistId')) return null;
  const jsonStart = message.indexOf('{');
  if (jsonStart < 0) return null;
  try {
    const body = asRecord(JSON.parse(message.slice(jsonStart)));
    const id = body.existingArtistId ?? body.existingId;
    return typeof id === 'string' && id.trim() ? id : null;
  } catch {
    return null;
  }
}

export async function verifyExistingBrassBand(
  id: string,
  fetchImpl: typeof fetch = fetch,
  brassApiBase = (process.env.BNDY_BRASS_API_BASE ?? 'https://ua1ptezszl.execute-api.eu-west-2.amazonaws.com').replace(/\/$/, ''),
): Promise<VerifiedExistingBand | null> {
  const response = await fetchImpl(`${brassApiBase}/bands`);
  if (!response.ok) throw new Error(`Brass API ${response.status} while verifying duplicate Artist ${id}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error('Brass API /bands did not return an array');

  for (const value of body) {
    const band = asRecord(value);
    if (band.id !== id) continue;
    const publicationScopes = strings(band.publicationScopes);
    if (!publicationScopes.includes('brass') || band.performerKind !== 'brass_band') return null;
    return {
      id,
      name: typeof band.name === 'string' ? band.name : undefined,
      publicationScopes,
      discoveryScopes: strings(band.discoveryScopes),
      performerKind: typeof band.performerKind === 'string' ? band.performerKind : undefined,
      locationLat: typeof band.locationLat === 'number' ? band.locationLat : undefined,
      locationLng: typeof band.locationLng === 'number' ? band.locationLng : undefined,
    };
  }
  return null;
}
