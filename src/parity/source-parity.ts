import { createHash } from 'node:crypto';
import type { NormalisedSourceEvent, ParsedSource, SourceEventDiff } from '../sources/runner/types.js';

export type ParityClassification =
  | 'INPUT_DIFFERENCE'
  | 'EXPECTED_RULE_CHANGE'
  | 'IDENTITY_DIFFERENCE'
  | 'PROJECTION_DIFFERENCE'
  | 'DEFECT';

export type ComparableParityEvent = {
  sourceEventKey: string;
  sourceNativeId?: string;
  artistName?: string;
  artistExternalId?: string;
  artistLocation?: string;
  venueName?: string;
  venueExternalId?: string;
  venueLocation?: string;
  venueAddress?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  eventUrl?: string;
  ticketUrl?: string;
  status?: string;
  admissionStatus?: string;
  price?: string;
};

export type ParityDiffSummary = {
  added: string[];
  updated: string[];
  unchanged: string[];
  withdrawn: string[];
  pastDropped: string[];
  ignoredAbsences: string[];
};

export type SourceParityArtifact = {
  schemaVersion: 1;
  sourceId: string;
  runDate: string;
  evidenceSha256: string;
  events: ComparableParityEvent[];
  parkedByReason: Record<string, number>;
  parkedRows?: Array<{ reason: string; rawSha256: string }>;
  diff?: ParityDiffSummary;
  provenance?: Record<string, string>;
};

export type ParityDifference = {
  classification: ParityClassification;
  path: string;
  expected: unknown;
  actual: unknown;
  material: boolean;
};

export type ParityComparison = {
  passed: boolean;
  differences: ParityDifference[];
};

const IDENTITY_FIELDS = new Set([
  'sourceNativeId',
  'artistName',
  'artistExternalId',
  'artistLocation',
  'venueName',
  'venueExternalId',
  'venueLocation',
  'venueAddress',
]);

function eventForParity(event: NormalisedSourceEvent): ComparableParityEvent {
  const result: ComparableParityEvent = { sourceEventKey: event.sourceEventKey };
  const fields: Array<keyof Omit<ComparableParityEvent, 'sourceEventKey'>> = [
    'sourceNativeId', 'artistName', 'artistExternalId', 'artistLocation',
    'venueName', 'venueExternalId', 'venueLocation', 'venueAddress',
    'date', 'startTime', 'endTime', 'title', 'eventUrl', 'ticketUrl',
    'status', 'admissionStatus', 'price',
  ];
  for (const field of fields) {
    const value = event[field];
    if (value !== undefined) result[field] = value;
  }
  return result;
}

function parkedSummary(parsed: ParsedSource): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const parked of parsed.parked) counts[parked.reason] = (counts[parked.reason] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function parkedRows(parsed: ParsedSource): Array<{ reason: string; rawSha256: string }> {
  return parsed.parked
    .map((item) => ({
      reason: item.reason,
      rawSha256: createHash('sha256').update(stable(item.raw ?? null)).digest('hex'),
    }))
    .sort((a, b) => `${a.reason}:${a.rawSha256}`.localeCompare(`${b.reason}:${b.rawSha256}`));
}

function keys(events: NormalisedSourceEvent[]): string[] {
  return events.map((event) => event.sourceEventKey).sort();
}

export function summariseDiff(diff: SourceEventDiff): ParityDiffSummary {
  return {
    added: keys(diff.added),
    updated: keys(diff.updated),
    unchanged: keys(diff.unchanged),
    withdrawn: keys(diff.withdrawn),
    pastDropped: keys(diff.pastDropped),
    ignoredAbsences: keys(diff.ignoredAbsences),
  };
}

export function buildParityArtifact(input: {
  sourceId: string;
  runDate: string;
  evidence: string | Uint8Array;
  parsed: ParsedSource;
  diff?: SourceEventDiff;
  provenance?: Record<string, string>;
}): SourceParityArtifact {
  const body = typeof input.evidence === 'string' ? Buffer.from(input.evidence, 'utf8') : Buffer.from(input.evidence);
  return {
    schemaVersion: 1,
    sourceId: input.sourceId,
    runDate: input.runDate,
    evidenceSha256: createHash('sha256').update(body).digest('hex'),
    events: input.parsed.events.map(eventForParity).sort((a, b) => a.sourceEventKey.localeCompare(b.sourceEventKey)),
    parkedByReason: parkedSummary(input.parsed),
    parkedRows: parkedRows(input.parsed),
    ...(input.diff ? { diff: summariseDiff(input.diff) } : {}),
    ...(input.provenance ? { provenance: input.provenance } : {}),
  };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function pushDifference(
  differences: ParityDifference[],
  classification: ParityClassification,
  path: string,
  expected: unknown,
  actual: unknown,
  expectedRuleChanges: Set<string>,
): void {
  const documented = expectedRuleChanges.has(path);
  differences.push({
    classification: documented ? 'EXPECTED_RULE_CHANGE' : classification,
    path,
    expected,
    actual,
    material: !documented,
  });
}

function compareEvents(
  expected: ComparableParityEvent[],
  actual: ComparableParityEvent[],
  differences: ParityDifference[],
  expectedRuleChanges: Set<string>,
): void {
  const expectedMap = new Map(expected.map((event) => [event.sourceEventKey, event]));
  const actualMap = new Map(actual.map((event) => [event.sourceEventKey, event]));
  const allKeys = [...new Set([...expectedMap.keys(), ...actualMap.keys()])].sort();

  for (const key of allKeys) {
    const left = expectedMap.get(key);
    const right = actualMap.get(key);
    if (!left || !right) {
      pushDifference(differences, 'PROJECTION_DIFFERENCE', `events.${key}`, left, right, expectedRuleChanges);
      continue;
    }
    const fields = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((field) => field !== 'sourceEventKey').sort();
    for (const field of fields) {
      const expectedValue = left[field as keyof ComparableParityEvent];
      const actualValue = right[field as keyof ComparableParityEvent];
      if (stable(expectedValue) === stable(actualValue)) continue;
      pushDifference(
        differences,
        IDENTITY_FIELDS.has(field) ? 'IDENTITY_DIFFERENCE' : 'PROJECTION_DIFFERENCE',
        `events.${key}.${field}`,
        expectedValue,
        actualValue,
        expectedRuleChanges,
      );
    }
  }
}

export function compareParityArtifacts(
  expected: SourceParityArtifact,
  actual: SourceParityArtifact,
  options: { expectedRuleChanges?: string[] } = {},
): ParityComparison {
  const differences: ParityDifference[] = [];
  const expectedRuleChanges = new Set(options.expectedRuleChanges ?? []);

  if (expected.sourceId !== actual.sourceId) {
    pushDifference(differences, 'DEFECT', 'sourceId', expected.sourceId, actual.sourceId, expectedRuleChanges);
  }
  if (expected.evidenceSha256 !== actual.evidenceSha256) {
    pushDifference(differences, 'INPUT_DIFFERENCE', 'evidenceSha256', expected.evidenceSha256, actual.evidenceSha256, expectedRuleChanges);
  }

  compareEvents(expected.events, actual.events, differences, expectedRuleChanges);

  if (stable(expected.parkedByReason) !== stable(actual.parkedByReason)) {
    pushDifference(differences, 'DEFECT', 'parkedByReason', expected.parkedByReason, actual.parkedByReason, expectedRuleChanges);
  }
  if (expected.parkedRows !== undefined && actual.parkedRows !== undefined
    && stable(expected.parkedRows) !== stable(actual.parkedRows)) {
    pushDifference(differences, 'DEFECT', 'parkedRows', expected.parkedRows, actual.parkedRows, expectedRuleChanges);
  }
  if (stable(expected.diff) !== stable(actual.diff)) {
    pushDifference(differences, 'DEFECT', 'diff', expected.diff, actual.diff, expectedRuleChanges);
  }

  return {
    passed: !differences.some((difference) => difference.material),
    differences,
  };
}
