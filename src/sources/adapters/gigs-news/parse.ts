const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

// Bootstrap aliases ported from the proven bndy-signals adapter. These remain
// finite migration seed knowledge; successful resolution belongs in Claims.
const VENUE_ALIASES: Record<string, string> = {
  'mash guru': 'Mash',
  'bulls head': "The Bull's Head",
  "bull's head": "The Bull's Head",
  'marple con & social club': 'Marple Con Club',
  'railway greenfield': 'Railway Greenfield',
};

const FLAGGED_VENUES = ['ashton jubilee club'];
const PLACEHOLDER_PATTERNS = [
  /^reserved$/i, /^reserved\s*-/i, /^closed$/i, /^live bands?$/i, /^tbc$/i, /^to be confirmed$/i,
];
const JAM_PATTERNS = [/jam$/i, /jam\s*night$/i, /blues\s*jam/i];
const GENERIC_PATTERNS = [
  /open\s*mic/i, /karaoke/i, /^disco$/i, /music\s*quiz/i, /^quiz\s*night$/i,
  /^jazz(\s*night)?$/i, /^football$/i,
];
const DATE_AS_ARTIST_PATTERN = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+\d{1,2}(st|nd|rd|th)\s+\w+/i;
const TIME_AS_ARTIST_PATTERN = /^\d{1,2}([:.]\d{2})?\s*(am|pm)$/i;
const PLACEHOLDER_VENUE_SUFFIX = /-\s*(branded|reserved)\b/i;
const DJ_PATTERNS = [/^dj\s+\w+$/i];
const FOOTER_PATTERNS = [
  /recording my songs/i, /my bands/i, /contact/i, /chris statham/i,
  /^\d{5}\s+\d{6}$/, /email:/i,
];

export interface GigsNewsRawGig {
  date: string;
  artist: string;
  venue: string;
  venueCanonical: string;
  time: string;
  timeDefaulted: boolean;
}

export interface GigsNewsParkedGig {
  date: string;
  rawLine: string;
  reason: string;
}

export interface GigsNewsParseResult {
  gigs: GigsNewsRawGig[];
  parked: GigsNewsParkedGig[];
}

export interface DayHeaderResult {
  dayOfWeek: string;
  dayOfMonth: number;
  month: string;
}

export interface GigRowResult {
  artist: string | null;
  venue: string | null;
  venueCanonical: string | null;
  time: string | null;
  skipReason?: string;
  venueOnly?: boolean;
}

export function parseDayHeader(line: string): DayHeaderResult | null {
  const match = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})(st|nd|rd|th)\s+(\w+)$/i);
  if (!match || !match[1] || !match[2] || !match[4]) return null;
  return { dayOfWeek: match[1], dayOfMonth: parseInt(match[2], 10), month: match[4] };
}

function dayHeaderToIsoDate(header: DayHeaderResult, year: number): string {
  const monthNum = MONTHS[header.month.toLowerCase()];
  if (!monthNum) return '';
  return `${year}-${monthNum}-${header.dayOfMonth.toString().padStart(2, '0')}`;
}

function parseTime(timeStr: string): string {
  const clean = timeStr.trim().toLowerCase();
  const match12 = clean.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/);
  if (match12 && match12[1] && match12[3]) {
    let hour = parseInt(match12[1], 10);
    const min = match12[2] || '00';
    const period = match12[3];
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${min}`;
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24 && match24[1] && match24[2]) return `${match24[1].padStart(2, '0')}:${match24[2]}`;
  return '';
}

function normaliseVenue(venue: string): string {
  const lower = venue.toLowerCase().trim();
  if (VENUE_ALIASES[lower]) return VENUE_ALIASES[lower];
  if ((lower.includes("bull's head") || lower.includes('bulls head')) && lower.includes('high lane')) {
    return "The Bull's Head";
  }
  return venue;
}

function isFlaggedVenue(venue: string): boolean {
  const lower = venue.toLowerCase().trim();
  return FLAGGED_VENUES.some((flagged) => lower.includes(flagged));
}

function classifiedArtist(artist: string, venue: string, time: string | null): GigRowResult | null {
  for (const pattern of PLACEHOLDER_PATTERNS) if (pattern.test(artist)) {
    return { artist: null, venue, venueCanonical: normaliseVenue(venue), time, skipReason: 'placeholder_performer' };
  }
  for (const pattern of JAM_PATTERNS) if (pattern.test(artist)) {
    return { artist: null, venue, venueCanonical: normaliseVenue(venue), time, skipReason: 'jam_night' };
  }
  for (const pattern of GENERIC_PATTERNS) if (pattern.test(artist)) {
    return { artist: null, venue, venueCanonical: normaliseVenue(venue), time, skipReason: 'generic_recurring' };
  }
  for (const pattern of DJ_PATTERNS) if (pattern.test(artist)) {
    return { artist: null, venue, venueCanonical: normaliseVenue(venue), time, skipReason: 'generic_dj' };
  }
  return null;
}

function classifiedVenue(artist: string, venue: string, time: string | null): GigRowResult | null {
  if (/looking for a venue/i.test(venue)) {
    return { artist, venue, venueCanonical: venue, time, skipReason: 'placeholder_venue' };
  }
  if (isFlaggedVenue(venue)) {
    return { artist, venue, venueCanonical: normaliseVenue(venue), time, skipReason: 'venue_geocode_risk' };
  }
  return null;
}

function parseGigRowDashFormat(line: string, dashIndex: number): GigRowResult {
  const artistPart = line.slice(0, dashIndex).trim();
  const venue = line.slice(dashIndex + 3).trim();
  if (!artistPart) {
    return { artist: null, venue, venueCanonical: normaliseVenue(venue), time: null, venueOnly: true };
  }

  const timeMatch = artistPart.match(/\s+(\d{1,2}:?\d{0,2}\s*(?:am|pm))\s*$/i);
  let artist: string;
  let time: string | null = null;
  if (timeMatch?.[1]) {
    artist = artistPart.slice(0, artistPart.length - timeMatch[0].length).trim().replace(/\s+from$/i, '').trim();
    time = parseTime(timeMatch[1]);
  } else {
    artist = artistPart;
  }

  const artistClassification = classifiedArtist(artist, venue, time);
  if (artistClassification) return artistClassification;
  const venueClassification = classifiedVenue(artist, venue, time);
  if (venueClassification) return venueClassification;
  return { artist, venue, venueCanonical: normaliseVenue(venue), time };
}

export function parseGigRow(line: string): GigRowResult {
  const trimmed = line.trim();
  for (const pattern of FOOTER_PATTERNS) if (pattern.test(trimmed)) {
    return { artist: null, venue: null, venueCanonical: null, time: null };
  }

  const dashIndex = trimmed.indexOf(' - ');
  if (dashIndex > 0) return parseGigRowDashFormat(trimmed, dashIndex);
  if (trimmed.startsWith('- ')) {
    const venue = trimmed.slice(2).trim();
    return { artist: null, venue, venueCanonical: normaliseVenue(venue), time: null, venueOnly: true };
  }

  const atIndex = trimmed.toLowerCase().indexOf(' at ');
  if (atIndex === -1) {
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex > 0) {
      const possibleVenue = trimmed.slice(0, commaIndex).trim();
      const possibleTime = trimmed.slice(commaIndex + 1).trim();
      const time = parseTime(possibleTime);
      return { artist: null, venue: possibleVenue, venueCanonical: normaliseVenue(possibleVenue), time: time || null, venueOnly: true };
    }
    return { artist: null, venue: null, venueCanonical: null, time: null };
  }

  const artist = trimmed.slice(0, atIndex).trim();
  const venueAndTime = trimmed.slice(atIndex + 4).trim();
  const initialClassification = classifiedArtist(artist, venueAndTime, null);
  if (initialClassification) return initialClassification;

  const commaIndex = venueAndTime.lastIndexOf(',');
  let venue: string;
  let time: string | null = null;
  if (commaIndex > 0) {
    venue = venueAndTime.slice(0, commaIndex).trim();
    time = parseTime(venueAndTime.slice(commaIndex + 1).trim()) || null;
  } else {
    venue = venueAndTime;
  }

  const venueClassification = classifiedVenue(artist, venue, time);
  if (venueClassification) return venueClassification;
  return { artist, venue, venueCanonical: normaliseVenue(venue), time };
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export function parseGigsNewsPage(input: string, year: number): GigsNewsParseResult {
  // Production acquisition returns rendered body.innerText. Keeping tolerant HTML
  // stripping here preserves donor fixtures and makes saved raw HTML usable too.
  const text = decodeBasicHtmlEntities(input.replace(/<[^>]+>/g, '\n'));
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const gigs: GigsNewsRawGig[] = [];
  const parked: GigsNewsParkedGig[] = [];
  let currentDate: string | null = null;

  for (const line of lines) {
    const dayHeader = parseDayHeader(line);
    if (dayHeader) {
      currentDate = dayHeaderToIsoDate(dayHeader, year);
      continue;
    }
    if (!currentDate) continue;
    if (FOOTER_PATTERNS.some((pattern) => pattern.test(line))) continue;

    const parsed = parseGigRow(line);
    if (!parsed.venue && !parsed.artist) continue;
    if (parsed.venueOnly) {
      parked.push({ date: currentDate, rawLine: line, reason: 'venue_only' });
      continue;
    }
    if (parsed.skipReason) {
      parked.push({ date: currentDate, rawLine: line, reason: parsed.skipReason });
      continue;
    }
    if (parsed.artist && DATE_AS_ARTIST_PATTERN.test(parsed.artist)) {
      parked.push({ date: currentDate, rawLine: line, reason: 'footer_date_row' });
      continue;
    }
    if (parsed.artist && TIME_AS_ARTIST_PATTERN.test(parsed.artist)) {
      parked.push({ date: currentDate, rawLine: line, reason: 'time_not_artist' });
      continue;
    }
    if (parsed.venue && PLACEHOLDER_VENUE_SUFFIX.test(parsed.venue)) {
      parked.push({ date: currentDate, rawLine: line, reason: 'placeholder_venue_booking' });
      continue;
    }
    if (parsed.artist && parsed.venue && parsed.venueCanonical) {
      gigs.push({
        date: currentDate,
        artist: parsed.artist,
        venue: parsed.venue,
        venueCanonical: parsed.venueCanonical,
        time: parsed.time || '20:00',
        timeDefaulted: !parsed.time,
      });
    }
  }

  return { gigs, parked };
}
