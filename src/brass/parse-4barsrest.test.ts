import { describe, expect, it } from 'vitest';
import { parse4BarsRestBandObservations, splitBandAndConductor } from './parse-4barsrest';
import type { BrassSource } from './types';

const source: BrassSource = {
  id: 'test-2026-area',
  url: 'https://example.test/area',
  kind: 'contest_result',
  year: 2026,
  region: 'North West',
  priority: 100,
};

describe('4barsrest brass parser', () => {
  it('preserves parentheses that are part of a band name', () => {
    expect(splitBandAndConductor('Oldham Band (Lees) (John Collins)')).toEqual({
      bandName: 'Oldham Band (Lees)',
      conductorName: 'John Collins',
    });
  });

  it('removes result points and qualification stars', () => {
    expect(splitBandAndConductor("Foden's (Russell Gray): 192**")).toEqual({
      bandName: "Foden's",
      conductorName: 'Russell Gray',
    });
  });

  it('creates observations without promoting section or conductor to band facts', () => {
    const text = `
Championship Section:
1. Foden's (Russell Gray): 192**
2. KNDS Fairey (Phil Chalk): 191*
First Section:
1. Haydock (Mark Quinn)*
2. Oldham Band (Lees) (John Collins)
`;
    const observations = parse4BarsRestBandObservations(text, source, { input: 'text', observedAt: '2026-03-01T12:00:00Z' });
    expect(observations).toHaveLength(4);
    expect(observations[1]).toMatchObject({ observedName: 'KNDS Fairey', section: 'Championship', conductorName: 'Phil Chalk' });
    expect(observations[3]).toMatchObject({ observedName: 'Oldham Band (Lees)', section: 'First', conductorName: 'John Collins' });
  });
});
