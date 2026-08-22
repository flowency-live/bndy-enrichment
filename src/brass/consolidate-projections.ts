import type { BrassBandProjectionPackage } from './projection.js';

function key(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const normalised = key(value);
    if (!normalised || seen.has(normalised)) continue;
    seen.add(normalised);
    out.push(value);
  }
  return out;
}

function quality(projection: BrassBandProjectionPackage): number {
  const brass = projection.record.domainProfiles.brass;
  let score = projection.provenance.identityConfidence * 100;
  if (brass.postcode) score += 20;
  if (brass.town) score += 12;
  if (brass.county) score += 5;
  if (brass.officialWebsiteUrl || projection.record.websiteUrl) score += 8;
  score += Math.min(projection.provenance.sourceUrls.length, 10);
  return score;
}

/**
 * Multiple contest observations can produce separate identity candidates that
 * later resolve to the same current official Band. Collapse those projections
 * before the canonical uniqueness gate while retaining evidence from every
 * resolved path.
 */
export function consolidateBrassBandProjections(projections: BrassBandProjectionPackage[]): BrassBandProjectionPackage[] {
  const groups = new Map<string, BrassBandProjectionPackage[]>();
  for (const projection of projections) {
    const nameKey = key(projection.record.name);
    const group = groups.get(nameKey) ?? [];
    group.push(projection);
    groups.set(nameKey, group);
  }

  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];

    const ranked = [...group].sort((a, b) => quality(b) - quality(a) || a.proposedId.localeCompare(b.proposedId));
    const base = structuredClone(ranked[0]);
    const allSourceUrls = uniqueStrings(group.flatMap((item) => item.provenance.sourceUrls));
    const allObservationIds = uniqueStrings(group.flatMap((item) => item.provenance.observationSourceIds));
    const variants = uniqueStrings(group.flatMap((item) => [
      ...item.record.name_variants,
      ...item.record.names.map((name) => name.name),
    ])).filter((name) => key(name) !== key(base.record.name));

    const namesByKey = new Map<string, (typeof base.record.names)[number]>();
    for (const item of group) {
      for (const name of item.record.names) {
        const nameKey = key(name.name);
        const existing = namesByKey.get(nameKey);
        if (!existing || name.confidence > existing.confidence) namesByKey.set(nameKey, name);
      }
    }

    base.record.name_variants = variants;
    base.record.names = [...namesByKey.values()];
    base.record.domainProfiles.brass.sourceRefs = uniqueStrings(group.flatMap((item) => item.record.domainProfiles.brass.sourceRefs));
    base.provenance.sourceUrls = allSourceUrls;
    base.provenance.observationSourceIds = allObservationIds;
    base.provenance.identityConfidence = Math.max(...group.map((item) => item.provenance.identityConfidence));
    base.publishable = group.some((item) => item.publishable);
    base.holdReasons = uniqueStrings(group.flatMap((item) => item.holdReasons));
    if (base.publishable) base.holdReasons = [];
    base.enrichmentFlags = uniqueStrings(group.flatMap((item) => item.enrichmentFlags));

    return base;
  }).sort((a, b) => a.record.name.localeCompare(b.record.name, 'en-GB', { sensitivity: 'base' }));
}
