import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertCompleteCanonicalBaseline,
  assertGlobalCanonicalWritesDisabled,
  CANONICAL_BACKLINE_CONFIRMATIONS,
  isReadOnlyPlan,
  namedArgument,
  requireCanonicalBacklineConfirmation,
  requiredNamedArgument,
} from '../src/bndy-baseline/operation-gate.js';

describe('canonical Backline operation gate', () => {
  it('requires the exact operation-specific confirmation token', () => {
    expect(() => requireCanonicalBacklineConfirmation([], 'baseline'))
      .toThrow(`--confirm=${CANONICAL_BACKLINE_CONFIRMATIONS.baseline}`);
    expect(() => requireCanonicalBacklineConfirmation([
      '--confirm=WRITE_BACKLINE_CANONICAL_DELTA',
    ], 'baseline')).toThrow();
    expect(() => requireCanonicalBacklineConfirmation([
      `--confirm=${CANONICAL_BACKLINE_CONFIRMATIONS.baseline}`,
    ], 'baseline')).not.toThrow();
  });

  it('requires the exact Lemonrock repair confirmation phrase', () => {
    expect(() => requireCanonicalBacklineConfirmation(
      ['--confirm=WRITE_BACKLINE_LEMONROCK_OCCURS_AT_REPAIR'],
      'lemonrock-occurs-at-repair',
    )).not.toThrow();
    expect(() => requireCanonicalBacklineConfirmation(
      ['--confirm=WRITE_BACKLINE_CANONICAL_DELTA'],
      'lemonrock-occurs-at-repair',
    )).toThrow(/WRITE_BACKLINE_LEMONROCK_OCCURS_AT_REPAIR/);
  });

  it('requires the exact OnTheCase repair confirmation phrase', () => {
    expect(() => requireCanonicalBacklineConfirmation(
      ['--confirm=WRITE_BACKLINE_ONTHECASE_OCCURS_AT_REPAIR'],
      'onthecase-occurs-at-repair',
    )).not.toThrow();
    expect(() => requireCanonicalBacklineConfirmation(
      ['--confirm=WRITE_BACKLINE_LEMONROCK_OCCURS_AT_REPAIR'],
      'onthecase-occurs-at-repair',
    )).toThrow(/WRITE_BACKLINE_ONTHECASE_OCCURS_AT_REPAIR/);
  });

  it('rejects duplicate or empty named arguments', () => {
    expect(namedArgument(['--run-id=one'], 'run-id')).toBe('one');
    expect(() => namedArgument(['--run-id=one', '--run-id=two'], 'run-id')).toThrow('at most once');
    expect(() => requiredNamedArgument([], 'run-id')).toThrow('--run-id=<value> is required');
    expect(() => requiredNamedArgument(['--run-id=   '], 'run-id')).toThrow();
  });

  it('recognises only an explicit dry-run as a read-only plan', () => {
    expect(isReadOnlyPlan(['--dry-run'])).toBe(true);
    expect(isReadOnlyPlan(['--dry-run=true'])).toBe(false);
    expect(isReadOnlyPlan([])).toBe(false);
  });

  it('stops hydration if the global canonical-write gate is enabled', () => {
    expect(() => assertGlobalCanonicalWritesDisabled(false)).not.toThrow();
    expect(() => assertGlobalCanonicalWritesDisabled(true)).toThrow('must stop');
  });

  it('accepts only the exact complete shadow baseline manifest', () => {
    expect(() => assertCompleteCanonicalBaseline({
      snapshotId: 'baseline-1',
      status: 'complete',
      shadow: true,
      canonicalWritesEnabled: false,
    }, 'baseline-1')).not.toThrow();

    for (const manifest of [
      undefined,
      { snapshotId: 'other', status: 'complete', shadow: true, canonicalWritesEnabled: false },
      { snapshotId: 'baseline-1', status: 'failed', shadow: true, canonicalWritesEnabled: false },
      { snapshotId: 'baseline-1', status: 'complete', shadow: false, canonicalWritesEnabled: false },
      { snapshotId: 'baseline-1', status: 'complete', shadow: true, canonicalWritesEnabled: true },
    ]) {
      expect(() => assertCompleteCanonicalBaseline(manifest, 'baseline-1')).toThrow();
    }
  });

  it('is wired into every canonical Backline mutation CLI', () => {
    const baseline = readFileSync(resolve('src/cli/bndy-corpus-bootstrap.ts'), 'utf8');
    const delta = readFileSync(resolve('src/cli/bndy-corpus-delta-hydration.ts'), 'utf8');
    const activation = readFileSync(resolve('src/cli/activate-canonical-change-sources.ts'), 'utf8');
    const lemonrockRepair = readFileSync(resolve('src/cli/repair-lemonrock-occurs-at.ts'), 'utf8');
    const onTheCaseRepair = readFileSync(resolve('src/cli/repair-onthecase-occurs-at.ts'), 'utf8');

    expect(baseline).toContain("requireCanonicalBacklineConfirmation(cliArgs, 'baseline')");
    expect(baseline).toContain('assertGlobalCanonicalWritesDisabled');
    expect(delta).toContain("requireCanonicalBacklineConfirmation(cliArgs, 'delta-hydration')");
    expect(delta).toContain('if (!dryRun) await changes.persist(change)');
    expect(delta).toContain('assertCompleteCanonicalBaseline');
    expect(activation).toContain("requireCanonicalBacklineConfirmation(process.argv.slice(2), 'activate-change-sources')");
    expect(activation).toContain('assertGlobalCanonicalWritesDisabled');
    expect(lemonrockRepair).toContain("requireCanonicalBacklineConfirmation(args, 'lemonrock-occurs-at-repair')");
    expect(lemonrockRepair).toContain('assertGlobalCanonicalWritesDisabled');
    expect(onTheCaseRepair).toContain("requireCanonicalBacklineConfirmation(args, 'onthecase-occurs-at-repair')");
    expect(onTheCaseRepair).toContain('assertGlobalCanonicalWritesDisabled');
  });
});
