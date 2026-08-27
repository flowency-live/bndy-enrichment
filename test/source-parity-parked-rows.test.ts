import { describe, expect, it } from 'vitest';
import { buildParityArtifact, compareParityArtifacts } from '../src/parity/source-parity.js';

describe('source parity parked-row evidence', () => {
  it('compares every parked row by deterministic raw fingerprint', () => {
    const expected = buildParityArtifact({
      sourceId: 'synthetic-source', runDate: '2026-08-27', evidence: 'same',
      parsed: { events: [], parked: [{ reason: 'review', raw: { rowIndex: 4 } }], warnings: [] },
    });
    const actual = buildParityArtifact({
      sourceId: 'synthetic-source', runDate: '2026-08-27', evidence: 'same',
      parsed: { events: [], parked: [{ reason: 'review', raw: { rowIndex: 5 } }], warnings: [] },
    });

    const comparison = compareParityArtifacts(expected, actual);
    expect(comparison.passed).toBe(false);
    expect(comparison.differences).toContainEqual(expect.objectContaining({ path: 'parkedRows' }));
  });
});
