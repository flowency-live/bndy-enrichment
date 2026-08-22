export interface PostcodeGeocode {
  postcode: string;
  latitude: number;
  longitude: number;
  town?: string;
  county?: string;
  evidenceUrl: string;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function geocodeUkPostcode(postcode: string): Promise<PostcodeGeocode | null> {
  const normalised = postcode.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!normalised) return null;
  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(normalised)}`;

  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'bndy-brass-research/1.0 (+https://bndy.live)', accept: 'application/json' },
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) return null;
    const body = await response.json() as { result?: Record<string, unknown> };
    const result = body.result ?? {};
    const latitude = result.latitude;
    const longitude = result.longitude;
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || typeof longitude !== 'number' || !Number.isFinite(longitude)) return null;

    // postcodes.io geography varies slightly by nation. Prefer locality-like
    // values where present, then the local authority as a usable fallback.
    const town = text(result.parish)
      ?? text(result.admin_ward)
      ?? text(result.admin_district)
      ?? text(result.council_area);
    const county = text(result.admin_county)
      ?? text(result.region)
      ?? text(result.council_area);

    return {
      postcode: text(result.postcode) ?? normalised,
      latitude,
      longitude,
      town,
      county,
      evidenceUrl: url,
    };
  } catch {
    return null;
  }
}
