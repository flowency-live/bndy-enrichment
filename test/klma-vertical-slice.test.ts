import { describe, expect, it } from 'vitest';
import {
  buildKlmaKnowledge,
  normaliseKlmaRows,
  parseKlmaCsv,
  parseKlmaDate,
  parseKlmaTime,
  type KlmaFetchResult,
} from '../src/vertical-slice/klma-source.js';
import { buildKnowledgeGraph } from '../src/vertical-slice/graph-export.js';

describe('KLMA knowledge vertical slice', () => {
  it('parses UK dates deterministically', () => {
    expect(parseKlmaDate('21/08/2026')).toBe('2026-08-21');
    expect(parseKlmaDate('21-08-26')).toBe('2026-08-21');
    expect(parseKlmaDate('2026-08-21')).toBe('2026-08-21');
    expect(parseKlmaDate('August 21, 2026')).toBe('2026-08-21');
    expect(parseKlmaDate('1/1/1899')).toBeNull();
  });

  it('parses common gig times and defaults missing time', () => {
    expect(parseKlmaTime('9pm')).toEqual({ time: '21:00', defaulted: false });
    expect(parseKlmaTime('20:30')).toEqual({ time: '20:30', defaulted: false });
    expect(parseKlmaTime('8.30pm').time).toBe('20:30');
    expect(parseKlmaTime('').time).toBe('21:00');
    expect(parseKlmaTime('7:12').defaulted).toBe(true);
  });

  it('turns one source row into an Observation, graph-shaped Claims and a candidate', () => {
    const csv = [
      'date,artist,venue,time,genre,url',
      '"21/08/2026","The Test Band","The Test Arms, Stoke-on-Trent","9pm","Rock","https://example.com/gig"',
    ].join('\n');
    const rows = parseKlmaCsv(csv);
    const events = normaliseKlmaRows(rows, '2026-08-20');
    expect(events).toHaveLength(1);
    expect(events[0]?.town).toBe('Stoke-on-Trent');

    const fetched: KlmaFetchResult = {
      body: csv,
      sourceUrl: 'https://example.com/source.csv',
      fetchMethod: 'export_csv',
      httpStatus: 200,
    };
    const knowledge = buildKlmaKnowledge(events, fetched, '2026-08-20T15:00:00.000Z');
    expect(knowledge.observation.complete).toBe(true);
    expect(knowledge.observation.itemCount).toBe(1);
    expect(knowledge.candidates).toHaveLength(1);
    expect(knowledge.claims.some((claim) => claim.predicate === 'hasPerformer')).toBe(true);
    expect(knowledge.claims.some((claim) => claim.predicate === 'occursAt')).toBe(true);
    expect(knowledge.claims.some((claim) => claim.predicate === 'occursOn' && claim.value === '2026-08-21')).toBe(true);
  });

  it('adds canonical projection nodes when BNDY resolution is available', () => {
    const csv = [
      'date,artist,venue,time,genre,url',
      '"21/08/2026","The Test Band","The Test Arms, Stoke-on-Trent","9pm","Rock",""',
    ].join('\n');
    const events = normaliseKlmaRows(parseKlmaCsv(csv), '2026-08-20');
    const knowledge = buildKlmaKnowledge(events, {
      body: csv,
      sourceUrl: 'https://example.com/source.csv',
      fetchMethod: 'export_csv',
      httpStatus: 200,
    }, '2026-08-20T15:00:00.000Z');
    const graph = buildKnowledgeGraph(knowledge, events, [{
      sourceEventKey: events[0]!.sourceEventKey,
      artist: { id: 'artist-1', action: 'matched', name: 'The Test Band' },
      venue: { id: 'venue-1', action: 'matched', name: 'The Test Arms' },
      event: { id: 'event-1', action: 'created', verified: true },
    }]);

    expect(graph.nodes.some((node) => node.id === 'canonical-event:event-1')).toBe(true);
    expect(graph.edges.some((edge) => edge.label === 'projectsTo')).toBe(true);
    expect(graph.edges.some((edge) => edge.label === 'resolvesTo')).toBe(true);
  });
});
