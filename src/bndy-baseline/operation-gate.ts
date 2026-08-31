export type CanonicalBacklineOperation = 'baseline' | 'delta-hydration' | 'activate-change-sources';

export const CANONICAL_BACKLINE_CONFIRMATIONS: Record<CanonicalBacklineOperation, string> = {
  baseline: 'WRITE_BACKLINE_CANONICAL_BASELINE',
  'delta-hydration': 'WRITE_BACKLINE_CANONICAL_DELTA',
  'activate-change-sources': 'ACTIVATE_BACKLINE_CANONICAL_CHANGE_SOURCES',
};

export function namedArgument(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const matches = args.filter((arg) => arg.startsWith(prefix));
  if (matches.length > 1) throw new Error(`--${name} must be supplied at most once`);
  return matches[0]?.slice(prefix.length);
}

export function requiredNamedArgument(args: string[], name: string): string {
  const value = namedArgument(args, name);
  if (!value?.trim()) throw new Error(`--${name}=<value> is required`);
  return value.trim();
}

export function requireCanonicalBacklineConfirmation(
  args: string[],
  operation: CanonicalBacklineOperation,
): void {
  const expected = CANONICAL_BACKLINE_CONFIRMATIONS[operation];
  const actual = namedArgument(args, 'confirm');
  if (actual !== expected) {
    throw new Error(`Operation ${operation} requires exact --confirm=${expected}`);
  }
}

export function isReadOnlyPlan(args: string[]): boolean {
  return args.includes('--dry-run');
}

export function assertGlobalCanonicalWritesDisabled(enabled: boolean): void {
  if (enabled) {
    throw new Error('Global canonical writes are enabled; canonical Backline hydration must stop');
  }
}

export type CanonicalBaselineManifest = {
  snapshotId?: unknown;
  status?: unknown;
  shadow?: unknown;
  canonicalWritesEnabled?: unknown;
};

export function assertCompleteCanonicalBaseline(
  manifest: CanonicalBaselineManifest | undefined,
  expectedSnapshotId: string,
): void {
  if (!manifest) throw new Error(`Canonical baseline ${expectedSnapshotId} does not exist`);
  if (manifest.snapshotId !== expectedSnapshotId) {
    throw new Error(`Canonical baseline manifest does not match ${expectedSnapshotId}`);
  }
  if (manifest.status !== 'complete') {
    throw new Error(`Canonical baseline ${expectedSnapshotId} is not complete`);
  }
  if (manifest.shadow !== true || manifest.canonicalWritesEnabled !== false) {
    throw new Error(`Canonical baseline ${expectedSnapshotId} does not prove shadow-only operation`);
  }
}
