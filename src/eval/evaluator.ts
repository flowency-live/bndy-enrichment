import type { EventCandidate } from '../domain/schema.js';

export interface TruthEvent {
  artistName: string;
  venueName: string;
  eventDate: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const key = (e: { artistName: string; venueName: string; eventDate: string }) => `${norm(e.artistName)}|${norm(e.venueName)}|${e.eventDate}`;

export function evaluate(truth: TruthEvent[], found: EventCandidate[]) {
  const truthKeys = new Set(truth.map(key));
  const foundKeys = new Set(found.map(key));
  const tp = [...foundKeys].filter(k => truthKeys.has(k)).length;
  const fp = [...foundKeys].filter(k => !truthKeys.has(k)).length;
  const fn = [...truthKeys].filter(k => !foundKeys.has(k)).length;
  return {
    tp,
    fp,
    fn,
    precision: tp + fp ? tp / (tp + fp) : 1,
    recall: tp + fn ? tp / (tp + fn) : 1,
  };
}
