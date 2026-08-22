import type { BrassBandIdentityCandidate } from './types.js';
import type { ResolvedBrassBand } from './resolve-band.js';
import { resolveOfficialSiteLocation } from './official-site.js';

export interface BrassBandResultsRecord {
  pageUrl: string;
  currentName: string;
  aliases: string[];
  website?: string;
  region?: string;
  section?: string;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)));
}

function stripTags(input: string): string {
  return decodeEntities(input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

export function slugCandidates(name: string): string[] {
  const base = name
    .normalize('NFKD')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  const candidates = [base];
  const withoutBand = base.replace(/-(?:brass-)?band$/, '').replace(/-silver-band$/, '-silver');
  const withoutBrass = base.replace(/-brass$/, '');
  for (const value of [withoutBand, withoutBrass]) {
    if (value && !candidates.includes(value)) candidates.push(value);
  }
  return candidates;
}

export function parseBrassBandResultsPage(html: string, pageUrl: string): BrassBandResultsRecord | null {
  const heading = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (!heading) return null;
  const currentName = stripTags(heading[1]).replace(/\s+\d{4}-$|\s+\d{4}-\d{4}$/g, '').trim();
  if (!currentName) return null;

  const aliasesMatch = html.match(/Also\/previously known as:\s*([\s\S]*?)(?:<br\s*\/?>|<\/p>|Embed These Results|Section:|Website:|Region:)/i);
  const aliases = aliasesMatch
    ? stripTags(aliasesMatch[1]).split(',').map((value) => value.trim()).filter(Boolean)
    : [];

  const websiteMatch = html.match(/Website:\s*[\s\S]{0,300}?href=["'](https?:\/\/[^"']+)["']/i);
  const regionMatch = html.match(/Region:\s*[\s\S]{0,400}?alt=["']([^"']+)["']/i)
    ?? html.match(/Region:\s*[\s\S]{0,400}?title=["']([^"']+)["']/i);
  const sectionMatch = html.match(/Section:\s*[\s\S]{0,200}?>(Championship|First|Second|Third|Fourth|Youth|Non[- ]competing)<\/[^>]+>/i);

  return {
    pageUrl,
    currentName,
    aliases: [...new Set(aliases.filter((alias) => alias.toLowerCase() !== currentName.toLowerCase()))],
    website: websiteMatch?.[1],
    region: regionMatch ? stripTags(regionMatch[1]) : undefined,
    section: sectionMatch?.[1],
  };
}

function normaliseName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\b(?:the|band|brass|silver|prize)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compatible(candidate: BrassBandIdentityCandidate, record: BrassBandResultsRecord): boolean {
  const observed = new Set([
    candidate.canonicalName,
    ...candidate.aliases,
    ...candidate.observations.map((item) => item.observedName),
  ].map(normaliseName).filter(Boolean));
  const recordNames = [record.currentName, ...record.aliases].map(normaliseName).filter(Boolean);
  return recordNames.some((name) => observed.has(name));
}

export async function resolveViaBrassBandResults(candidate: BrassBandIdentityCandidate): Promise<ResolvedBrassBand | null> {
  const names = [...new Set([candidate.canonicalName, ...candidate.aliases, ...candidate.observations.map((item) => item.observedName)])];
  const urls = [...new Set(names.flatMap((name) => slugCandidates(name)).map((slug) => `https://www.brassbandresults.co.uk/bands/${slug}/`))];

  for (const pageUrl of urls) {
    let response: Response;
    try {
      response = await fetch(pageUrl, {
        headers: { 'user-agent': 'bndy-brass-research/1.0 (+https://bndy.live)', accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const record = parseBrassBandResultsPage(await response.text(), response.url || pageUrl);
    if (!record || !compatible(candidate, record)) continue;

    const siteLocation = record.website ? await resolveOfficialSiteLocation(record.website) : null;
    const evidenceUrls = [...new Set([
      record.pageUrl,
      ...candidate.observations.map((item) => item.sourceUrl),
      ...(record.website ? [record.website] : []),
      ...(siteLocation?.evidenceUrl ? [siteLocation.evidenceUrl] : []),
    ])];

    return {
      officialName: record.currentName,
      officialWebsite: record.website,
      town: siteLocation?.town,
      county: siteLocation?.county,
      postcode: siteLocation?.postcode,
      country: 'United Kingdom',
      aliases: record.aliases.map((name) => ({
        name,
        type: 'alternate' as const,
        confidence: 0.97,
        evidenceUrls: [record.pageUrl],
      })),
      identityConfidence: record.website ? 0.98 : 0.94,
      evidenceUrls,
      notes: `Resolved deterministically via Brass Band Results${record.region ? ` (${record.region})` : ''}${siteLocation ? '; location clues read from the official site' : ''}. Section is evidence only and is not projected as permanent Band metadata.`,
    };
  }

  return null;
}
