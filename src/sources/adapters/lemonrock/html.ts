export type HtmlAnchor = { href: string; text: string };

const ENTITY_MAP: Record<string, string> = {
  amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ', pound: '£', ndash: '–', mdash: '—',
};

export function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_all, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_all, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (all, name: string) => ENTITY_MAP[name.toLowerCase()] ?? all);
}

export function textFromHtml(html: string): string {
  return decodeHtml(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|p|div|li|tr|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\t\r ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function titleFromHtml(html: string): string | undefined {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? textFromHtml(match[1]).trim() : undefined;
}

export function anchorsFromHtml(html: string, baseUrl: string): HtmlAnchor[] {
  const anchors: HtmlAnchor[] = [];
  const regex = /<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(regex)) {
    try {
      const absolute = new URL(decodeHtml(match[2]), baseUrl);
      if (absolute.hostname !== 'www.lemonrock.com' && absolute.hostname !== 'lemonrock.com') continue;
      absolute.hash = '';
      anchors.push({ href: absolute.toString(), text: textFromHtml(match[3]).trim() });
    } catch {
      // Ignore malformed navigation URLs; evidence is still retained verbatim.
    }
  }
  return anchors;
}

export function lemonrockSlug(urlText: string): string | undefined {
  try {
    const url = new URL(urlText);
    const path = url.pathname.replace(/^\/+|\/+$/g, '');
    if (!path || path.includes('/') || path.includes('.')) return undefined;
    if (!/^[a-z0-9_-]+$/i.test(path)) return undefined;
    return path.toLowerCase();
  } catch {
    return undefined;
  }
}

export function gigId(urlText: string): string | undefined {
  try {
    const url = new URL(urlText);
    if (!url.pathname.toLowerCase().endsWith('/gig.php')) return undefined;
    const id = url.searchParams.get('id');
    return id && /^\d+$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
