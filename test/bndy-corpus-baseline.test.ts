import { describe, expect, it } from 'vitest';
import { buildCanonicalBaselineClaims, provenanceForRecord, stableJson } from '../src/bndy-baseline/mapper.js';
import { entityResolutionItem } from '../src/knowledge/stores/resolution-store.js';

const base = {
  snapshotId: 'baseline-test',
  snapshotAt: '2026-08-24T07:00:00.000Z',
  sourceId: 'bndy-canonical-artists',
  entityType: 'artist' as const,
  canonicalId: 'artist-1',
  observationId: 'obs-1',
  contentHash: 'abc123',
};

describe('canonical BNDY Backline baseline', () => {
  it('stableJson is independent of object key order', () => {
    expect(stableJson({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(stableJson({ a: { c: 3, d: 4 }, b: 2 }));
  });

  it('classifies missing provenance as BNDY legacy-canonical', () => {
    expect(provenanceForRecord({ id: 'a1', name: 'Legacy Artist' }))
      .toEqual({ classification: 'bndy-legacy-canonical' });

    const claims = buildCanonicalBaselineClaims({ ...base, record: { id: 'a1', name: 'Legacy Artist' } });
    const nameField = claims.find((claim) => claim.predicate === 'derivedFrom'
      && (claim.value as { field?: string }).field === 'name');
    expect(nameField?.value).toEqual({
      field: 'name',
      value: 'Legacy Artist',
      provenance: { classification: 'bndy-legacy-canonical' },
    });
  });

  it('preserves recoverable source labels without inventing source authority', () => {
    expect(provenanceForRecord({ source: 'mcp_ai_import' })).toEqual({
      classification: 'recoverable-source-label',
      sourceLabel: 'mcp_ai_import',
    });
    const claims = buildCanonicalBaselineClaims({
      ...base,
      record: { id: 'a1', name: 'Imported Artist', source: 'mcp_ai_import' },
    });
    const sourceField = claims.find((claim) => claim.predicate === 'derivedFrom'
      && (claim.value as { field?: string }).field === 'source');
    expect(sourceField?.value).toEqual({
      field: 'source',
      value: 'mcp_ai_import',
      provenance: { classification: 'recoverable-source-label', sourceLabel: 'mcp_ai_import' },
    });
  });

  it('atomises nested ownership and external-id fields', () => {
    const claims = buildCanonicalBaselineClaims({
      ...base,
      record: {
        id: 'a1',
        ownerUserId: 'user-7',
        externalIds: [{ source: 'lemonrock', id: 'artist-slug' }],
      },
    });
    const fields = claims
      .filter((claim) => claim.predicate === 'derivedFrom')
      .map((claim) => (claim.value as { field: string }).field);
    expect(fields).toContain('ownerUserId');
    expect(fields).toContain('externalIds[0].source');
    expect(fields).toContain('externalIds[0].id');
  });

  it('materialises semantic event relationships and deterministic self-resolution', () => {
    const claims = buildCanonicalBaselineClaims({
      ...base,
      sourceId: 'bndy-canonical-events',
      entityType: 'event',
      canonicalId: 'event-1',
      record: {
        id: 'event-1',
        artistId: 'artist-1',
        artistName: 'Artist One',
        venueId: 'venue-1',
        venueName: 'Venue One',
        date: '2026-09-01',
        startTime: '20:00',
      },
    });
    expect(claims).toEqual(expect.arrayContaining([
      expect.objectContaining({ predicate: 'hasPerformer', value: { canonicalEntityId: 'artist-1' } }),
      expect.objectContaining({ predicate: 'occursAt', value: { canonicalEntityId: 'venue-1' } }),
      expect.objectContaining({ predicate: 'occursOn', value: '2026-09-01' }),
      expect.objectContaining({ predicate: 'startsAt', value: '20:00' }),
      expect.objectContaining({
        predicate: 'resolvesTo',
        value: expect.objectContaining({ canonicalEntityId: 'event-1', method: 'canonical-self-baseline' }),
      }),
    ]));
  });

  it('uses festival subjects and supports festival EntityResolution rows', () => {
    const claims = buildCanonicalBaselineClaims({
      ...base,
      sourceId: 'bndy-canonical-festivals',
      entityType: 'festival',
      canonicalId: 'festival-1',
      record: { id: 'festival-1', name: 'A Festival', source: 'mcp_ai_import' },
    });
    expect(claims.every((claim) => claim.subject.type === 'festival')).toBe(true);
    expect(claims.some((claim) => claim.predicate === 'hasName' && claim.value === 'A Festival')).toBe(true);

    const item = entityResolutionItem({
      candidateType: 'festival',
      candidateKey: 'bndy:festival:festival-1',
      canonicalEntityId: 'festival-1',
      method: 'canonical-self-baseline',
      confidence: 1,
      supportingClaimIds: ['claim-1'],
      status: 'resolved',
      resolvedAt: '2026-08-24T07:00:00.000Z',
    }, { sourceId: 'bndy-canonical-festivals', snapshotId: 'baseline-test' });

    expect(item).toMatchObject({
      pk: 'RESOLUTION#festival#bndy:festival:festival-1',
      sk: 'META',
      entityType: 'EntityResolution',
      GSI1PK: 'BASELINE#baseline-test',
      GSI1SK: 'RESOLUTION#festival#festival-1',
    });
  });

  it('changes deterministic claim IDs when canonical content changes within a resumed snapshot', () => {
    const first = buildCanonicalBaselineClaims({ ...base, contentHash: 'hash-a', record: { id: 'a1', name: 'Name A' } });
    const second = buildCanonicalBaselineClaims({ ...base, contentHash: 'hash-b', record: { id: 'a1', name: 'Name B' } });
    expect(first.map((claim) => claim.id)).not.toEqual(second.map((claim) => claim.id));
  });
});
