import { describe, expect, it } from 'vitest';
import { checkpointKey, partitionTestimony, type TestimonyCheckpoint } from '../src/sources/runner/testimony.js';
import type { NormalisedSourceEvent } from '../src/sources/runner/types.js';

function event(key: string, hash: string): NormalisedSourceEvent {
  return { sourceEventKey: key, artistName: `Artist ${key}`, venueName: `Venue ${key}`, date: '2026-09-20', startTime: '20:00', contentHash: hash };
}

function checkpoint(overrides: Partial<TestimonyCheckpoint> = {}): TestimonyCheckpoint {
  return { candidateType: 'event', candidateKey: 'event:src:e1', sourceId: 'src', fingerprint: 'same', ...overrides };
}

describe('partitionTestimony', () => {
  it('treats an event with the same fingerprint from the same source as re-observed', () => {
    const existing = new Map([[checkpointKey({ candidateType: 'event', candidateKey: 'event:src:e1' }), checkpoint()]]);

    const result = partitionTestimony('src', [event('e1', 'same'), event('e2', 'new')], existing);

    expect(result.fresh.map((item) => item.sourceEventKey)).toEqual(['e2']);
    expect(result.reobserved.map((item) => item.event.sourceEventKey)).toEqual(['e1']);
    expect(result.reobserved[0]?.checkpoint.fingerprint).toBe('same');
    expect(result.fingerprints.get('event#event:src:e2')).toBe('new');
  });

  it('treats a changed fingerprint as fresh testimony', () => {
    const existing = new Map([[checkpointKey({ candidateType: 'event', candidateKey: 'event:src:e1' }), checkpoint({ fingerprint: 'old' })]]);

    const result = partitionTestimony('src', [event('e1', 'same')], existing);

    expect(result.fresh).toHaveLength(1);
    expect(result.reobserved).toHaveLength(0);
  });

  it('never suppresses testimony on the strength of another source', () => {
    const existing = new Map([[checkpointKey({ candidateType: 'event', candidateKey: 'event:src:e1' }), checkpoint({ sourceId: 'other' })]]);

    const result = partitionTestimony('src', [event('e1', 'same')], existing);

    expect(result.fresh).toHaveLength(1);
  });

  it('treats a candidate without a stored fingerprint as fresh', () => {
    const existing = new Map([[checkpointKey({ candidateType: 'event', candidateKey: 'event:src:e1' }), checkpoint({ fingerprint: undefined })]]);

    expect(partitionTestimony('src', [event('e1', 'same')], existing).fresh).toHaveLength(1);
  });
});
