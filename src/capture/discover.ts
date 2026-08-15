import { CaptureDiscoverySchema, type CaptureDiscovery, type CaptureRecord } from './schema.js';

const genreValues = [
  'Rock', 'Rock n Roll', 'Grunge', 'Metal', 'Punk', 'Alternative', 'New Wave', 'Pop',
  'Indie', 'Britpop', 'Mod', 'Blues', 'R&B', 'Country', 'Americana', 'Folk', 'Soul',
  'Funk', 'Motown', 'Electronic', 'Dance', 'Jazz', 'Classical', 'Reggae', 'Latin', 'Other',
];
const artistTypeValues = ['Band', 'Solo Act', 'Duo', 'Trio', 'Group', 'DJ', 'Collective'];
const actTypeValues = ['Originals', 'Covers', 'Tribute Act'];

const responseSchema = {
  type: 'object',
  properties: {
    classification: { type: 'string', enum: ['artist', 'venue', 'event', 'non_music', 'unsupported'] },
    reason: { type: 'string' },
    canonicalUrl: { type: 'string' },
    artist: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        facebookUrl: { type: 'string' },
        location: { type: 'string' },
        locationType: { type: 'string', enum: ['city', 'regional'] },
        artistType: { type: 'string', enum: artistTypeValues },
        actTypes: { type: 'array', items: { type: 'string', enum: actTypeValues } },
        genres: { type: 'array', items: { type: 'string', enum: genreValues } },
        bio: { type: 'string' },
        officialWebsite: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        evidenceUrls: { type: 'array', items: { type: 'string' } },
      },
      required: ['name', 'actTypes', 'genres', 'confidence', 'evidenceUrls'],
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          artistName: { type: 'string' },
          venueName: { type: 'string' },
          town: { type: 'string' },
          address: { type: 'string' },
          date: { type: 'string' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          eventUrl: { type: 'string' },
          ticketed: { type: 'boolean' },
          ticketUrl: { type: 'string' },
          price: { type: 'string' },
          admission: { type: 'string', enum: ['FREE_CONFIRMED', 'PAID_CONFIRMED', 'UNKNOWN'] },
          cancelled: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          sourceUrls: { type: 'array', items: { type: 'string' } },
        },
        required: ['artistName', 'venueName', 'date', 'admission', 'cancelled', 'confidence', 'sourceUrls'],
      },
    },
    evidenceUrls: { type: 'array', items: { type: 'string' } },
  },
  required: ['classification', 'reason', 'events', 'evidenceUrls'],
};

function extractOutputText(raw: any): string | undefined {
  if (typeof raw?.output_text === 'string') return raw.output_text;
  if (typeof raw?.outputText === 'string') return raw.outputText;
  const texts: string[] = [];
  for (const step of raw?.steps ?? []) {
    if (step?.type !== 'model_output') continue;
    for (const item of step?.content ?? []) {
      if (item?.type === 'text' && typeof item.text === 'string') texts.push(item.text);
    }
  }
  return texts.length ? texts[texts.length - 1] : undefined;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function publicPageMetadata(url?: string): Promise<string> {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; BNDYBot/1.0; +https://bndy.co.uk)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return `Anonymous page fetch returned HTTP ${res.status}.`;
    const html = (await res.text()).slice(0, 250_000);
    const pick = (property: string) => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'),
        new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return decodeEntities(match[1]).trim();
      }
      return '';
    };
    const title = pick('og:title') || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim();
    const description = pick('og:description') || pick('description');
    return [
      `Final anonymous URL: ${res.url}`,
      title ? `Public page title: ${title}` : '',
      description ? `Public page description: ${description}` : '',
    ].filter(Boolean).join('\n');
  } catch (error) {
    return `Anonymous page fetch unavailable: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(capture: CaptureRecord, metadata: string, horizonDays: number): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are processing one mobile share into BNDY, a UK grassroots live-music database.

CAPTURE
id: ${capture.id}
sharedUrl: ${capture.sharedUrl ?? '(none)'}
sharedText: ${capture.sharedText ?? '(none)'}
suggestedEntityType: ${capture.suggestedEntityType}
sourceApp: ${capture.sourceApp ?? '(unknown)'}

ANONYMOUS PAGE METADATA (may be empty or a Facebook login page; treat only useful exact page metadata as evidence)
${metadata || '(none)'}

Today is ${today}. Find only upcoming events within the next ${horizonDays} days.

Use Google Search grounding aggressively enough to identify the exact shared entity, but do not guess across similarly named acts.
The normal case is a Facebook artist/band page shared from a phone.

For an ARTIST capture:
- identify the exact artist name from its own/official source;
- preserve the canonical Facebook profile/page URL. If the supplied Facebook URL is the artist page, return it even if Google does not expose richer Facebook text;
- location is REQUIRED for creation. Prefer the artist's own About/intro/website. If unavailable, infer a performing region only when repeated venue evidence supports it and use locationType=regional;
- artistType is REQUIRED: Band, Solo Act, Duo, Trio, Group, DJ, Collective;
- at least one actType is REQUIRED: Originals, Covers, Tribute Act. Multiple are allowed;
- genres are optional and must use only the controlled enum;
- bio is optional. Prefer concise factual wording derived from artist-declared/official text. Never fabricate a bio;
- discover upcoming gigs from official artist sources, venue/promoter listings and search results. Facebook event pages may be used if indexed publicly.

EVENT RULES
- Only output real upcoming live performances for the identified artist.
- date must be YYYY-MM-DD.
- time must be HH:MM 24-hour when known; omit when unknown rather than inventing.
- venue town/city is important because the BNDY Venue Lambda will do authoritative Google Places resolution.
- FREE_CONFIRMED only when evidence explicitly says free/free entry/no admission charge.
- PAID_CONFIRMED when a price, mandatory paid ticket, or official ticket vendor clearly establishes paid admission.
- absence of a price is UNKNOWN.
- retain paid gigs. Do not drop them.
- cancelled events may be returned with cancelled=true but will not be published.

CLASSIFICATION
- artist: the shared page is a music artist/band/act.
- venue: it is a music venue rather than an artist.
- event: it is a single event rather than an artist profile.
- non_music: clearly unrelated to live music.
- unsupported: cannot reliably identify the source/entity.

Return JSON only matching the supplied schema.`;
}

export interface CaptureDiscoverOptions {
  apiKey: string;
  model?: string;
  horizonDays?: number;
}

export async function discoverCapture(capture: CaptureRecord, options: CaptureDiscoverOptions): Promise<CaptureDiscovery> {
  const model = options.model ?? 'gemini-3.6-flash';
  const horizonDays = options.horizonDays ?? 90;
  const metadata = await publicPageMetadata(capture.sharedUrl);
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': options.apiKey,
    },
    body: JSON.stringify({
      model,
      input: buildPrompt(capture, metadata, horizonDays),
      tools: [{ type: 'google_search' }],
      response_format: { type: 'text', mime_type: 'application/json', schema: responseSchema },
    }),
  });
  if (!res.ok) throw new Error(`Gemini capture discovery ${res.status}: ${await res.text()}`);
  const raw: any = await res.json();
  const text = extractOutputText(raw);
  if (!text) throw new Error('Gemini capture response contained no model text output');
  return CaptureDiscoverySchema.parse(JSON.parse(text));
}
