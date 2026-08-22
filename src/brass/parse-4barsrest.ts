import type { BrassBandObservation, BrassSource } from './types.js';

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)));
}

export function htmlToLines(html: string): string[] {
  return decodeEntities(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function normaliseBandName(name: string): string {
  return name.normalize('NFKC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/[.*]+$/g, '').trim().toLowerCase();
}

function detectSection(line: string): string | undefined {
  const cleaned = line.replace(/^#+\s*/, '').replace(/:$/, '').trim();
  if (/championship section/i.test(cleaned)) return 'Championship';
  if (/first section|section 1/i.test(cleaned)) return 'First';
  if (/second section|section 2/i.test(cleaned)) return 'Second';
  if (/third section|section 3/i.test(cleaned)) return 'Third';
  if (/fourth (?:section|division)|section 4/i.test(cleaned)) return 'Fourth';
  return undefined;
}

function cleanResultSuffix(value: string): string {
  return value.replace(/\s*:\s*\d+(?:\.\d+)?(?:\*+)?\s*$/g, '').replace(/\s*\*+\s*$/g, '').trim();
}

export function splitBandAndConductor(raw: string): { bandName: string; conductorName?: string } {
  const cleaned = cleanResultSuffix(raw);
  const match = cleaned.match(/^(.*)\s+\(([^()]*)\)$/);
  if (!match) return { bandName: cleaned };
  const bandName = match[1].trim();
  const suffix = match[2].trim();
  if (!bandName) return { bandName: cleaned };
  if (/^(?:pre[- ]?qualified|qualified|withdrawn|tbc|tba|n\/a)$/i.test(suffix)) return { bandName };
  return { bandName, conductorName: suffix || undefined };
}

function numberedEntry(line: string): string | null {
  const match = line.match(/^\s*\d+\s*[.)]\s+(.+)$/);
  if (match) return match[1].trim();
  const table = line.match(/^\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)(?:\s*\||$)/);
  if (table) return `${table[1].trim()} (${table[2].trim()})`;
  return null;
}

function isMetadataOrNarrative(line: string): boolean {
  if (line.length > 150) return true;
  if (/^(?:test piece|adjudicators?|start|tickets?|venue|schedule|qualifiers?|competing bands|become a supporter|advertisement|advertise|sponsored|read more|latest|news|results?|report|gallery|comments?|previous|next|home|menu|login|register|subscribe|saturday|sunday|monday|tuesday|wednesday|thursday|friday)\b/i.test(line)) return true;
  if (/^(?:share|facebook|twitter|x|email|print)$/i.test(line)) return true;
  if (/^sections?\s+\d/i.test(line)) return true;
  if (/^royal albert hall\b|^york barbican\b|^upton vale baptist church\b/i.test(line)) return true;
  if (/^\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+(?:\s+\d{4})?$/i.test(line)) return true;
  if (/\b(?:will|there|this year|takes place|held at|qualif(?:y|ication)|invitation|defending champion)\b/i.test(line) && /[.!?]$/.test(line)) return true;
  return false;
}

function sectionListingEntry(line: string, source: BrassSource, section?: string): string | null {
  if (!section || isMetadataOrNarrative(line)) return null;
  if (/^\d/.test(line)) return null;
  if (/^[A-Z][a-z]+,\s+\d{2}\s+[A-Z][a-z]+\s+\d{4}$/.test(line)) return null;
  if (/^.{2,120}\s+\([^()]+\)$/.test(line)) return line;
  if (source.kind === 'contest_listing' && line.length <= 80 && !/[.:;!?]/.test(line)) return line;
  return null;
}

export function parse4BarsRestBandObservations(content: string, source: BrassSource, options: { input?: 'html' | 'text'; observedAt?: string } = {}): BrassBandObservation[] {
  const lines = options.input === 'text' ? content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : htmlToLines(content);
  const observedAt = options.observedAt ?? new Date().toISOString();
  const observations: BrassBandObservation[] = [];
  let section: string | undefined;

  for (const line of lines) {
    const nextSection = detectSection(line);
    if (nextSection) { section = nextSection; continue; }
    const entry = numberedEntry(line) ?? sectionListingEntry(line, source, section);
    if (!entry) continue;
    const { bandName, conductorName } = splitBandAndConductor(entry);
    if (bandName.length < 2 || bandName.length > 140 || isMetadataOrNarrative(bandName)) continue;
    observations.push({
      observedName: bandName,
      normalisedName: normaliseBandName(bandName),
      conductorName,
      section,
      region: source.region,
      year: source.year,
      sourceId: source.id,
      sourceUrl: source.url,
      sourceKind: source.kind,
      observedAt,
      evidenceText: line,
    });
  }

  const seen = new Set<string>();
  return observations.filter((observation) => {
    const key = `${observation.normalisedName}|${observation.section ?? ''}|${observation.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchAndParse4BarsRestSource(source: BrassSource): Promise<BrassBandObservation[]> {
  const response = await fetch(source.url, {
    headers: { 'user-agent': 'bndy-brass-research/1.0 (+https://bndy.live)', accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`4barsrest source ${source.id} returned ${response.status}`);
  return parse4BarsRestBandObservations(await response.text(), source, { input: 'html' });
}
