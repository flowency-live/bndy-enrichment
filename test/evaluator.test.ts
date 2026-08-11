import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/eval/evaluator.js';

describe('evaluate', () => {
  it('calculates precision and recall', () => {
    const truth = [{ artistName: 'Band', venueName: 'Pub', eventDate: '2026-09-01' }];
    const found: any[] = [{
      artistName: 'Band',
      venueName: 'Pub',
      eventDate: '2026-09-01',
      timezone: 'Europe/London',
      cancelled: false,
      confidence: 0.9,
      sourceUrls: ['https://example.com/gig'],
    }];
    expect(evaluate(truth, found)).toMatchObject({ tp: 1, fp: 0, fn: 0, precision: 1, recall: 1 });
  });
});
