import { describe, expect, it } from 'vitest';
import { parse4BarsRestBandObservations, splitBandAndConductor } from './parse-4barsrest.js';
import type { BrassSource } from './types.js';

const resultSource: BrassSource = {
  id: 'test-2026-area',
  url: 'https://example.test/area',
  kind: 'contest_result',
  year: 2026,
  region: 'North West',
  priority: 100,
};

const listingSource: BrassSource = {
  ...resultSource,
  id: 'test-2026-listing',
  kind: 'contest_listing',
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

  it('treats pre-qualified as listing metadata rather than a conductor', () => {
    expect(splitBandAndConductor('Black Dyke (pre-qualified)')).toEqual({ bandName: 'Black Dyke' });
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
    const observations = parse4BarsRestBandObservations(text, resultSource, { input: 'text', observedAt: '2026-03-01T12:00:00Z' });
    expect(observations).toHaveLength(4);
    expect(observations[1]).toMatchObject({ observedName: 'KNDS Fairey', section: 'Championship', conductorName: 'Phil Chalk' });
    expect(observations[3]).toMatchObject({ observedName: 'Oldham Band (Lees)', section: 'First', conductorName: 'John Collins' });
  });

  it('parses unnumbered line-up entries with conductors while ignoring schedule metadata', () => {
    const text = `
Championship Section:
Sunday 8th March
Test Piece: Elgar Variations (Martin Ellerby)
Adjudicators: Stephen Cobb; Mareika Gray
Start: 3.00pm
Black Dyke (Prof. Nicholas J Childs)
Brighouse & Rastrick (Prof. David King)
First Section:
Saturday 7th March
BD1 Brass (Jamie Smith)
City of Bradford (Lee Skipsey)
`;
    const observations = parse4BarsRestBandObservations(text, listingSource, { input: 'text' });
    expect(observations.map((item) => item.observedName)).toEqual([
      'Black Dyke',
      'Brighouse & Rastrick',
      'BD1 Brass',
      'City of Bradford',
    ]);
  });

  it('parses bare National Finals band names and strips pre-qualified markers', () => {
    const text = `
Championship Section:
Royal Albert Hall, London
Saturday 3rd October
Competing bands:
Aldbourne
Black Dyke (pre-qualified)
Cory
KNDS Fairey
Section 1:
Blackburn & Darwen
Haydock
`;
    const observations = parse4BarsRestBandObservations(text, listingSource, { input: 'text' });
    expect(observations.map((item) => item.observedName)).toEqual([
      'Aldbourne',
      'Black Dyke',
      'Cory',
      'KNDS Fairey',
      'Blackburn & Darwen',
      'Haydock',
    ]);
    expect(observations.find((item) => item.observedName === 'Black Dyke')?.conductorName).toBeUndefined();
  });
});
