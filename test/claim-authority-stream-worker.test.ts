import { describe, expect, it } from 'vitest';
import type { DynamoDBRecord } from 'aws-lambda';
import { claimFromStreamRecord, decodeNewImage } from '../src/handlers/claim-authority-stream-worker.js';
import { mapClaimV2ToAuthorityAssertion } from '../src/authority/claim-authority.js';

function s(value: string) { return { S: value }; }
function n(value: number) { return { N: String(value) }; }

function record(status = 'pending_review'): DynamoDBRecord {
  return {
    eventName: 'MODIFY',
    dynamodb: {
      NewImage: {
        claim_id: s('claim-live-1'),
        evidence_revision: n(2),
        entity_type: s('artist'),
        entity_id: s('artist-1'),
        user_id: s('private-cognito-id'),
        requested_role: s('member'),
        relationship_kind: s('band_member'),
        verification_method: s('manual'),
        status: s(status),
        source: s('join_bndy_v2'),
        created_at: s('2026-08-29T15:00:00Z'),
        updated_at: s('2026-08-29T15:05:00Z'),
        evidence: { L: [{ M: {
          evidence_id: s('ev-1'),
          method: s('manual_explanation'),
          status: s('submitted'),
          strength: s('weak'),
          public_reference: s('https://example.com/artist'),
          metadata: { M: {
            explanation: s('I am the drummer. Private phone 07123456789.'),
            official_email: s('private@example.com'),
          } },
        } }] },
      },
    },
  } as DynamoDBRecord;
}

describe('Claim authority stream ingestion', () => {
  it('decodes the current production Claim V2 persistence shape', () => {
    const decoded = decodeNewImage(record());
    expect(decoded?.source).toBe('join_bndy_v2');
    expect(decoded?.evidence_revision).toBe(2);
  });

  it('maps a production stream record without retaining private evidence', () => {
    const claim = claimFromStreamRecord(record());
    expect(claim).not.toBeNull();
    const assertion = mapClaimV2ToAuthorityAssertion(claim!);
    const serialised = JSON.stringify(assertion);
    expect(assertion.evidenceClasses).toEqual({
      explanationSupplied: true,
      officialEmailSupplied: true,
      supportingUrlSupplied: true,
      facebookPageControlSupplied: false,
    });
    expect(assertion.supportingUrl).toBe('https://example.com/artist');
    expect(serialised).not.toContain('private@example.com');
    expect(serialised).not.toContain('07123456789');
    expect(serialised).not.toContain('private-cognito-id');
  });

  it('ignores non-Join claims and unsupported lifecycle records', () => {
    const other = record();
    other.dynamodb!.NewImage!.source = s('legacy');
    expect(claimFromStreamRecord(other)).toBeNull();
    expect(claimFromStreamRecord(record('something_else'))).toBeNull();
  });
});
