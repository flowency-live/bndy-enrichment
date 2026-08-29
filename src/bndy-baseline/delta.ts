export type PriorCanonicalState = {
  contentHash: string;
  removed: boolean;
};

export function needsCanonicalHydration(contentHash: string, prior: PriorCanonicalState | null): boolean {
  return !prior || prior.removed || prior.contentHash !== contentHash;
}

export function needsCanonicalRemoval(prior: PriorCanonicalState | null): boolean {
  return prior?.removed !== true;
}
