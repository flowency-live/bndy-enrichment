import { describe, expect, it } from 'vitest';
import type { KnowledgeClaim } from '../src/knowledge/types.js';
import {
  candidateItems,
  canonicalCandidateItems,
  coreArtistName,
  eventIdentityKey,
  normaliseIdentityText,
  type IndexedCandidate,
} from '../src/knowledge/stores/candidate-store.js';
import { assessEnrichment, classifyResolution } from '../src/trust-loop/evaluator.js';
import type { CandidateEvidence } from '../src/trust-loop/types.js';
import { trustLoopRunItem } from '../src/trust-loop/run-store.js';
import { selectBalancedCandidates } from '../src/trust-loop/runner.js';

function indexed(overrides: Partial<IndexedCandidate> = {}): IndexedCandidate {
  return {
    candidateType: 'artist',
    candidateKey: 'source-artist-1',
    sourceId: 'source-a',
    displayName: 'The Example Band',
    observedAt: '2026-08-28T10:00:00.000Z',
    supportingClaimIds: [],
    confidence: 1,
    ...overrides,
  };
}

function claim(
  subjectType: KnowledgeClaim['subject']['type'],
  subjectKey: string,
  predicate: KnowledgeClaim['predicate'],
  value: unknown,
  sourceId = 'source-a',
): KnowledgeClaim {
  return {
    id: `claim-${sourceId}-${predicate}-${JSON.stringify(value)}`,
    observationId: `obs-${sourceId}`,
    sourceId,
    subject: { type: subjectType, key: subjectKey },
    predicate,
    value,
    confidence: 1,
    observedAt: '2026-08-28T10:00:00.000Z',
    status: 'active',
  };
}

function evidence(candidate: IndexedCandidate, claims: KnowledgeClaim[]): CandidateEvidence {
  return { candidate, claims };
}

describe('Trust Loop identity keys', () => {
  it('normalises punctuation and ports the safe artist suffix rule', () => {
    expect(normaliseIdentityText("Tést & The O'Neils")).toBe('test and the oneils');
    expect(coreArtistName('The Example Band')).toBe('the example');
    expect(eventIdentityKey('The Act', 'The Hall', '2026-09-01')).toBe('the act|the hall|2026-09-01');
  });

  it('writes source and canonical aliases without confusing them', () => {
    const source = candidateItems({
      candidateKey: 'source-artist-1', entityType: 'artist', sourceId: 'source-a',
      displayName: 'The Example Band', observedAt: '2026-08-28T10:00:00.000Z',
      supportingClaimIds: [], confidence: 1,
    });
    const canonical = canonicalCandidateItems(indexed({
      candidateKey: 'bndy:artist:artist-1', sourceId: 'bndy-canonical-artist', canonicalEntityId: 'artist-1',
    }));
    expect(source.some((item) => item.GSI2SK === 'SOURCE#source-a#source-artist-1')).toBe(true);
    expect(canonical.some((item) => item.GSI2SK === 'CANONICAL#bndy-canonical-artist#bndy:artist:artist-1')).toBe(true);
  });
});

describe('Trust Loop cohort selection', () => {
  it('balances source families and entity types instead of returning only Venue rows', () => {
    const rows = [
      indexed({ sourceId: 'source-a', candidateType: 'artist', candidateKey: 'a-artist' }),
      indexed({ sourceId: 'source-a', candidateType: 'venue', candidateKey: 'a-venue' }),
      indexed({ sourceId: 'source-a', candidateType: 'event', candidateKey: 'a-event' }),
      indexed({ sourceId: 'source-b', candidateType: 'artist', candidateKey: 'b-artist' }),
      indexed({ sourceId: 'source-b', candidateType: 'venue', candidateKey: 'b-venue' }),
      indexed({ sourceId: 'source-b', candidateType: 'event', candidateKey: 'b-event' }),
    ];
    const selected = selectBalancedCandidates(['source-a', 'source-b'], rows, 6);
    expect(new Set(selected.map((row) => row.sourceId))).toEqual(new Set(['source-a', 'source-b']));
    expect(new Set(selected.map((row) => row.candidateType))).toEqual(new Set(['artist', 'venue', 'event']));
  });
});

describe('Trust Loop deterministic classification', () => {
  const sourceCandidate = indexed();
  const canonicalCandidate = indexed({
    candidateKey: 'bndy:artist:artist-1', sourceId: 'bndy-canonical-artist', canonicalEntityId: 'artist-1',
  });

  it('resolves an exact official identity and retains its Claims and reasons', () => {
    const source = evidence(sourceCandidate, [
      claim('artist-candidate', sourceCandidate.candidateKey, 'hasName', 'The Example Band'),
      claim('artist-candidate', sourceCandidate.candidateKey, 'hasFacebookUrl', 'https://facebook.com/exampleband'),
    ]);
    const canonical = evidence(canonicalCandidate, [
      claim('artist', 'artist-1', 'hasName', 'The Example Band', 'bndy-canonical-artist'),
      claim('artist', 'artist-1', 'hasFacebookUrl', 'https://www.facebook.com/exampleband/', 'bndy-canonical-artist'),
    ]);
    const decision = classifyResolution({ candidate: source, canonicalHypotheses: [canonical], corroboratingCandidates: [], classifiedAt: '2026-08-28T11:00:00.000Z' });
    expect(decision).toMatchObject({ status: 'resolved', canonicalEntityId: 'artist-1', method: 'backline-trust-loop-v1' });
    expect(decision.hypotheses[0]?.matchedDimensions).toEqual(expect.arrayContaining(['name', 'facebook']));
    expect(decision.supportingClaimIds.length).toBe(4);
  });

  it('classifies name-only evidence as unresolved instead of forcing a merge', () => {
    const source = evidence(sourceCandidate, [claim('artist-candidate', sourceCandidate.candidateKey, 'hasName', 'The Example Band')]);
    const canonical = evidence(canonicalCandidate, [claim('artist', 'artist-1', 'hasName', 'The Example Band', 'bndy-canonical-artist')]);
    const decision = classifyResolution({ candidate: source, canonicalHypotheses: [canonical], corroboratingCandidates: [], classifiedAt: '2026-08-28T11:00:00.000Z' });
    expect(decision.status).toBe('unresolved');
    expect(decision.canonicalEntityId).toBeUndefined();
    expect(decision.decisionReasoning).toContain('Name similarity or footprint alone is not sufficient');
  });

  it('classifies a disputed official URL as conflicted', () => {
    const source = evidence(sourceCandidate, [
      claim('artist-candidate', sourceCandidate.candidateKey, 'hasName', 'The Example Band'),
      claim('artist-candidate', sourceCandidate.candidateKey, 'hasFacebookUrl', 'https://facebook.com/wrong-act'),
    ]);
    const canonical = evidence(canonicalCandidate, [
      claim('artist', 'artist-1', 'hasName', 'The Example Band', 'bndy-canonical-artist'),
      claim('artist', 'artist-1', 'hasFacebookUrl', 'https://facebook.com/exampleband', 'bndy-canonical-artist'),
    ]);
    const decision = classifyResolution({ candidate: source, canonicalHypotheses: [canonical], corroboratingCandidates: [], classifiedAt: '2026-08-28T11:00:00.000Z' });
    expect(decision.status).toBe('conflicted');
    expect(decision.hypotheses[0]?.conflictingDimensions).toContain('facebook');
  });

  it('resolves an exact Event fingerprint without requiring a title', () => {
    const source = evidence(indexed({ candidateType: 'event', candidateKey: 'event:source-a:1', displayName: undefined, artistName: 'The Act', venueName: 'The Hall', date: '2026-09-01' }), []);
    const canonical = evidence(indexed({ candidateType: 'event', candidateKey: 'bndy:event:event-1', sourceId: 'bndy-canonical-event', canonicalEntityId: 'event-1', displayName: undefined, artistName: 'The Act', venueName: 'The Hall', date: '2026-09-01' }), []);
    const decision = classifyResolution({ candidate: source, canonicalHypotheses: [canonical], corroboratingCandidates: [], classifiedAt: '2026-08-28T11:00:00.000Z' });
    expect(decision).toMatchObject({ status: 'resolved', canonicalEntityId: 'event-1', confidence: 0.99 });
  });

  it('reports enrichment confirmation and wrong-link incidents independently', () => {
    const source = evidence(sourceCandidate, [
      claim('artist-candidate', sourceCandidate.candidateKey, 'hasGenre', 'Rock'),
      claim('artist-candidate', sourceCandidate.candidateKey, 'hasFacebookUrl', 'https://facebook.com/wrong-act'),
    ]);
    const canonical = evidence(canonicalCandidate, [
      claim('artist', 'artist-1', 'hasGenre', 'Rock', 'bndy-canonical-artist'),
      claim('artist', 'artist-1', 'hasFacebookUrl', 'https://facebook.com/exampleband', 'bndy-canonical-artist'),
    ]);
    const assessment = assessEnrichment(source, {
      candidateType: 'artist', candidateKey: sourceCandidate.candidateKey, sourceId: sourceCandidate.sourceId,
      canonicalEntityId: 'artist-1', method: 'test', confidence: 1, supportingClaimIds: [], hypotheses: [],
      decisionReasoning: ['test'], status: 'resolved', classifiedAt: '2026-08-28T11:00:00.000Z', resolvedAt: '2026-08-28T11:00:00.000Z',
    }, canonical, []);
    expect(assessment.fields.hasGenre).toBe('confirmed');
    expect(assessment.fields.hasFacebookUrl).toBe('conflicted');
    expect(assessment.wrongLinkIncidents).toBe(1);
  });

  it('keeps the run summary bounded while decisions remain in the Resolution store', () => {
    const item = trustLoopRunItem({
      id: 'trust-loop-1',
      startedAt: '2026-08-28T11:00:00.000Z',
      completedAt: '2026-08-28T11:01:00.000Z',
      sourceIds: ['source-a'],
      candidateLimit: 40,
      candidatesSeen: 1,
      candidatesClassified: 1,
      classifications: { resolved: 0, unresolved: 1, conflicted: 0 },
      entityTypes: { artist: 1, venue: 0, event: 0, festival: 0 },
      noSilentDrops: true,
      canonicalWrites: 0,
      enrichment: {
        eligibleArtists: 1,
        assessedArtists: 1,
        classificationCoverage: 1,
        genreCoverage: 0,
        officialLinkCoverage: 0,
        attemptedNoOfficialPresence: 0,
        parkedOrConflicted: 1,
        wrongLinkIncidents: 0,
      },
      acceptance: {
        completeClassification: true,
        zeroWrongLinks: true,
        traceableDecisions: true,
        reviewedKnownAnswerSetPassed: false,
      },
      status: 'needs-review',
      decisions: [{
        candidateType: 'artist', candidateKey: 'source-artist-1', sourceId: 'source-a',
        method: 'backline-trust-loop-v1', confidence: 0, supportingClaimIds: ['claim-1'], hypotheses: [],
        decisionReasoning: ['Insufficient evidence'], status: 'unresolved', classifiedAt: '2026-08-28T11:01:00.000Z',
      }],
      reviewCases: [],
      enrichmentAssessments: [{
        candidateKey: 'source-artist-1', eligible: true, fields: {}, confirmedOfficialLinks: [],
        wrongLinkIncidents: 0, evidenceClaimIds: ['claim-1'],
      }],
    });
    expect(item.decisions).toEqual([]);
    expect(item.enrichmentAssessments).toEqual([]);
  });
});
