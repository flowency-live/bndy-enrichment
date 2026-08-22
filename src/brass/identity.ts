import type { BrassBandIdentityCandidate, BrassBandObservation } from './types';

/**
 * Conservative first pass: exact normalised names only.
 * Sponsored/former-name merges are deliberately NOT guessed here. They become
 * alias proposals in the inference stage and require supporting evidence.
 */
export function groupExactIdentityCandidates(observations: BrassBandObservation[]): BrassBandIdentityCandidate[] {
  const groups = new Map<string, BrassBandObservation[]>();
  for (const observation of observations) {
    const group = groups.get(observation.normalisedName) ?? [];
    group.push(observation);
    groups.set(observation.normalisedName, group);
  }

  return [...groups.values()].map((group) => {
    const nameCounts = new Map<string, number>();
    for (const observation of group) nameCounts.set(observation.observedName, (nameCounts.get(observation.observedName) ?? 0) + 1);
    const canonicalName = [...nameCounts.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
    const aliases = [...new Set(group.map((observation) => observation.observedName).filter((name) => name !== canonicalName))];
    const regions = [...new Set(group.map((observation) => observation.region).filter((region): region is string => !!region))];
    const sourceCount = new Set(group.map((observation) => observation.sourceId)).size;
    const confidence = Math.min(0.99, 0.78 + Math.max(0, sourceCount - 1) * 0.05);
    return { canonicalName, observations: group, aliases, regions, confidence };
  }).sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, 'en-GB', { sensitivity: 'base' }));
}

export interface AliasProposal {
  leftName: string;
  rightName: string;
  reason: string;
  confidence: number;
  status: 'candidate';
}

/**
 * Generates only low-risk *candidates* for the later inference layer.
 * No proposal here mutates or merges identities.
 */
export function proposeAliasCandidates(candidates: BrassBandIdentityCandidate[]): AliasProposal[] {
  const proposals: AliasProposal[] = [];
  const tokens = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter((token) => token.length > 2 && !['band','brass','silver','colliery','town'].includes(token));

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const left = candidates[i];
      const right = candidates[j];
      const a = new Set(tokens(left.canonicalName));
      const b = new Set(tokens(right.canonicalName));
      if (!a.size || !b.size) continue;
      const overlap = [...a].filter((token) => b.has(token));
      const score = overlap.length / Math.max(a.size, b.size);
      const sameRegion = left.regions.some((region) => right.regions.includes(region));
      if (score >= 0.6 && sameRegion) {
        proposals.push({
          leftName: left.canonicalName,
          rightName: right.canonicalName,
          reason: `name-token overlap (${overlap.join(', ')}) in same observed region`,
          confidence: Math.min(0.74, 0.45 + score * 0.25),
          status: 'candidate',
        });
      }
    }
  }
  return proposals;
}
