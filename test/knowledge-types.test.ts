import { describe, expect, it } from 'vitest';
import {
  EventCandidateSchema,
  GigSourceSchema,
  KnowledgeClaimSchema,
  ProjectionWorkItemSchema,
  SourceObservationSchema,
  TombstoneSchema,
} from '../src/knowledge/types.js';

describe('canonical knowledge schemas', () => {
  it('parses a venue website source with safe defaults', () => {
    const source = GigSourceSchema.parse({
      id: 'venue-web:venue-123',
      name: 'The Fishpond website',
      type: 'VENUE_WEBSITE',
      url: 'https://example.com/whats-on/',
      linkedEntity: { type: 'venue', id: 'venue-123' },
      mode: 'delta',
      snapshotSemantics: 'complete',
      authorityClass: 'venue-owned',
    });

    expect(source.enabled).toBe(false);
    expect(source.shadow).toBe(true);
    expect(source.writerAuthority).toBe('cowork');
    expect(source.runtimeClass).toBe('standard');
    expect(source.timezone).toBe('Europe/London');
    expect(source.thresholds).toEqual({});
  });

  it('records completeness separately from the observation payload', () => {
    const observation = SourceObservationSchema.parse({
      id: 'obs-1',
      sourceId: 'gigs-news',
      observedAt: '2026-08-20T05:00:00Z',
      sourceUrl: 'https://gigs-news.uk/',
      captureHash: 'sha256:abc',
      evidenceKey: 'source-observations/gigs-news/obs-1/response.html',
      enumerationMethod: 'chromium-v1',
      complete: false,
      paginationComplete: false,
      itemCount: 42,
    });

    expect(observation.complete).toBe(false);
    expect(observation.itemCount).toBe(42);
  });

  it('parses a graph-shaped claim with provenance', () => {
    const claim = KnowledgeClaimSchema.parse({
      id: 'claim-1',
      observationId: 'obs-1',
      sourceId: 'venue-web:venue-123',
      subject: { type: 'event-candidate', key: 'event:11882' },
      predicate: 'startsAt',
      value: '21:00',
      confidence: 0.99,
      evidence: {
        sourceUrl: 'https://example.com/events/legacy-of-crows/',
        rawItemId: '11882',
        text: 'Live from 9pm',
      },
      observedAt: '2026-08-20T05:00:00Z',
    });

    expect(claim.status).toBe('active');
    expect(claim.subject.key).toBe('event:11882');
    expect(claim.predicate).toBe('startsAt');
  });

  it('retains source-native event identity beyond the current BNDY projection sentinel', () => {
    const candidate = EventCandidateSchema.parse({
      candidateKey: 'candidate-1',
      sourceId: 'venue-web:venue-123',
      sourceEventKey: 'wordpress:event:11882',
      sourceNativeId: '11882',
      artistName: 'Legacy of Crows',
      venueName: 'The Fishpond',
      date: '2026-09-12',
      startTime: '21:00',
      eventUrl: 'https://example.com/events/legacy-of-crows/',
      festivalIdentity: 'festival-7',
      stageIdentity: 'main-stage',
      supportingClaimIds: ['claim-1'],
      confidence: 0.98,
      observedAt: '2026-08-20T05:00:00Z',
    });

    expect(candidate.sourceEventKey).toBe('wordpress:event:11882');
    expect(candidate.stageIdentity).toBe('main-stage');
  });

  it('supports tombstone supersession and reinstatement lifecycle', () => {
    const tombstone = TombstoneSchema.parse({
      id: 'tombstone-1',
      eventFingerprint: 'artist-1:venue-1:2026-09-12',
      canonicalEventId: 'event-1',
      artistId: 'artist-1',
      venueId: 'venue-1',
      date: '2026-09-12',
      status: 'reinstated',
      reason: 'Previously cancelled, later explicitly reinstated by venue',
      authorityClass: 'venue-owned',
      sourceId: 'venue-web:venue-1',
      claimId: 'claim-cancelled',
      observationId: 'obs-cancelled',
      createdAt: '2026-08-20T05:00:00Z',
      supersededAt: '2026-08-22T05:00:00Z',
      supersededByClaimId: 'claim-reinstated',
    });

    expect(tombstone.status).toBe('reinstated');
    expect(tombstone.supersededByClaimId).toBe('claim-reinstated');
  });

  it('requires a stable idempotency key for projection work', () => {
    const item = ProjectionWorkItemSchema.parse({
      id: 'projection-1',
      sourceId: 'gigs-news',
      observationId: 'obs-1',
      candidateKey: 'candidate-1',
      entityType: 'event',
      action: 'create',
      idempotencyKey: 'gigs-news:obs-1:candidate-1:create',
      claimIds: ['claim-1'],
      createdAt: '2026-08-20T05:01:00Z',
    });

    expect(item.idempotencyKey).toContain('candidate-1');
  });

  it('rejects unsupported predicates so adapters cannot invent private claim vocabularies', () => {
    const result = KnowledgeClaimSchema.safeParse({
      id: 'claim-bad',
      observationId: 'obs-1',
      sourceId: 'gigs-news',
      subject: { type: 'event-candidate', key: 'event-1' },
      predicate: 'whateverThisAdapterWants',
      value: true,
      confidence: 1,
      observedAt: '2026-08-20T05:00:00Z',
    });

    expect(result.success).toBe(false);
  });
});
