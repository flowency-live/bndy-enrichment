import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { CaptureDiscoverySchema, type CaptureDiscovery, type CaptureRecord } from './schema.js';

const s3 = new S3Client({});
const MAX_INLINE_IMAGE_BYTES = 15 * 1024 * 1024;

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
          eventName: { type: 'string' },
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

async function imageInput(capture: CaptureRecord): Promise<any | undefined> {
  if (!capture.media || capture.media.type !== 'image') return undefined;
  const object = await s3.send(new GetObjectCommand({
    Bucket: capture.media.bucket,
    Key: capture.media.key,
  }));
  if (!object.Body) throw new Error(`Capture image ${capture.media.key} had no body`);
  const bytes = await object.Body.transformToByteArray();
  if (bytes.byteLength > MAX_INLINE_IMAGE_BYTES) {
    throw new Error(`Capture image is too large for inline Gemini processing (${bytes.byteLength} bytes)`);
  }
  return {
    type: 'image',
    mime_type: capture.media.mimeType,
    data: Buffer.from(bytes).toString('base64'),
  };
}

function buildPrompt(capture: CaptureRecord, metadata: string, horizonDays: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const isImage = capture.media?.type === 'image';
  return `You are processing one mobile share into BNDY, a UK grassroots live-music database.

CAPTURE
id: ${capture.id}
sharedUrl: ${capture.sharedUrl ?? '(none)'}
sharedText: ${capture.sharedText ?? '(none)'}
mimeType: ${capture.mimeType}
containsImage: ${isImage ? 'yes' : 'no'}
suggestedEntityType: ${capture.suggestedEntityType}
sourceApp: ${capture.sourceApp ?? '(unknown)'}

ANONYMOUS PAGE METADATA (may be empty or a Facebook login page; treat only useful exact page metadata as evidence)
${metadata || '(none)'}

Today is ${today}. Find only upcoming events within the next ${horizonDays} days.

Use Google Search grounding aggressively enough to identify the exact shared entity, but do not guess across similarly named acts.

IMAGE / POSTER RULES
- If an image is supplied, inspect the actual image carefully. Do not rely only on text search.
- A poster headed by one artist/band with many dates is an ARTIST capture and a gig guide, not ten unrelated event captures.
- Extract every clearly readable upcoming gig row from the poster, including month/date, time, town, price and annotations such as headline act.
- Resolve the artist identity from the poster name using web search. Find the canonical official Facebook artist/profile URL even when no URL was shared from the phone.
- Do not invent a Facebook URL. The URL must be supported by search evidence and clearly belong to the same act.
- Distinguish a VENUE from an EVENT/FESTIVAL name. For example a row may name a festival rather than the physical venue.
- Put a named festival/event/promoter title in eventName. Put only the actual physical venue in venueName.
- When the poster gives an event/festival name but not a physical venue, use grounded search to resolve the physical venue. If the venue cannot be resolved confidently, omit that event from the returned event list rather than inventing a venue.
- Poster text itself is valid evidence for dates, times, prices and artist billing. Web search should corroborate/resolve identity, venues and admission where possible.

For an ARTIST capture:
- identify the exact artist name from its own/official source or the supplied poster;
- preserve/find the canonical Facebook profile/page URL;
- location is REQUIRED for creation. Prefer the artist's own About/intro/website. If unavailable, infer a performing region only when repeated venue evidence supports it and use locationType=regional;
- artistType is REQUIRED: Band, Solo Act, Duo, Trio, Group, DJ, Collective;
- at least one actType is REQUIRED: Originals, Covers, Tribute Act. Multiple are allowed;
- genres are optional and must use only the controlled enum;
- bio is optional. Prefer concise factual wording derived from artist-declared/official text. Never fabricate a bio;
- discover upcoming gigs from the poster plus official artist sources, venue/promoter listings and search results. Facebook event pages may be used if indexed publicly.

EVENT RULES
- Only output real upcoming live performances for the identified artist.
- date must be YYYY-MM-DD.
- time must be HH:MM 24-hour when known; omit when unknown rather than inventing.
- venue town/city is important because the BNDY Venue Lambda will do authoritative Google Places resolution.
- FREE_CONFIRMED only when evidence explicitly says free/free entry/no admission charge.
- PAID_CONFIRMED when a price, mandatory paid ticket, or official ticket vendor clearly establishes paid admission.
- absence of a price is UNKNOWN. A poster with no price is NOT evidence of free entry.
- retain paid gigs. Do not drop them.
- cancelled events may be returned with cancelled=true but will not be published.
- deduplicate the same performance when poster evidence and web search both find it.

CLASSIFICATION
- artist: the shared page/image represents a music artist/band/act, including an artist gig-guide poster.
- venue: it is primarily a music venue rather than an artist.
- event: it is a single event rather than an artist profile/gig guide.
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
  const prompt = buildPrompt(capture, metadata, horizonDays);
  const image = await imageInput(capture);
  const input = image ? [image, { type: 'text', text: prompt }] : prompt;

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': options.apiKey,
    },
    body: JSON.stringify({
      model,
      input,
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
