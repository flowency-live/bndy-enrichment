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
  const conductor = match[2].trim();
  if (!bandName) return { bandName: cleaned };
  if (!conductor || /^(?:tbc|tba|n\/a)$/i.test(conductor)) return { bandName };
  return { bandName, conductorName: conductor };
}

function numberedEntry(line: string): string | null {
  const match = line.match(/^\s*\d+\s*[.)]\s+(.+)$/);
  if (match) return match[1].trim();
  const table = line.match(/^\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)(?:\s*\||$)/);
  if (table) return `${table[1].trim()} (${table[2].trim()})`;
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
    const entry = numberedEntry(line);
    if (!entry) continue;
    const { bandName, conductorName } = splitBandAndConductor(entry);
    if (bandName.length < 2 || bandName.length > 140) continue;
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
