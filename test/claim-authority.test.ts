import { describe, expect, it } from 'vitest';
import { containsSensitiveClaimMaterial, mapClaimV2ToAuthorityAssertion } from '../src/authority/claim-authority.js';

describe('Claim V2 authority boundary', () => {
  it('retains authority signals but drops manual PII and free text', () => {
    const result = mapClaimV2ToAuthorityAssertion({
      claim_id: 'claim-123',
      evidence_revision: 2,
      entity_type: 'artist',
      entity_id: 'artist-456',
      user_id: 'cognito-user-secret-id',
      requested_role: 'member',
      relationship_kind: 'band_member',
      verification_method: 'manual',
      status: 'pending_review',
      created_at: '2026-08-29T15:00:00Z',
      updated_at: '2026-08-29T15:05:00Z',
      evidence: [{
        type: 'manual_relationship',
        explanation: 'I am the drummer and run the band. Call me on 07123456789.',
        official_email: 'drummer@example.com',
        supporting_url: 'https://example.com/band/',
      }],
    });

    expect(result.claimRequestId).toBe('claim-123');
    expect(result.evidenceRevision).toBe(2);
    expect(result.actorRef).toMatch(/^bndy-user:[a-f0-9]{32}$/);
    expect(result.actorRef).not.toContain('cognito-user-secret-id');
    expect(result.evidenceClasses).toEqual({
      explanationSupplied: true,
      officialEmailSupplied: true,
      supportingUrlSupplied: true,
      facebookPageControlSupplied: false,
    });
    expect(result.supportingUrl).toBe('https://example.com/band/');
    expect(JSON.stringify(result)).not.toContain('07123456789');
    expect(JSON.stringify(result)).not.toContain('drummer@example.com');
    expect(JSON.stringify(result)).not.toContain('I am the drummer');
    expect(containsSensitiveClaimMaterial(result)).toBe(false);
  });

  it('retains verified public Facebook Page identity as authority evidence', () => {
    const result = mapClaimV2ToAuthorityAssertion({
      claim_id: 'claim-fb',
      entity_type: 'venue',
      entity_id: 'venue-1',
      user_id: 'user-1',
      requested_role: 'owner',
      relationship_kind: 'venue_owner',
      verification_method: 'facebook_page',
      status: 'verified_pending',
      created_at: '2026-08-29T15:00:00Z',
      evidence: [{
        type: 'facebook_page_control',
        page_id: '123456789',
        page_name: 'The Example Venue',
        page_url: 'https://www.facebook.com/examplevenue',
        verified_at: '2026-08-29T15:02:00Z',
      }],
    });

    expect(result.evidenceClasses.facebookPageControlSupplied).toBe(true);
    expect(result.facebookPage).toEqual({
      pageId: '123456789',
      pageName: 'The Example Venue',
      pageUrl: 'https://www.facebook.com/examplevenue',
      verifiedAt: '2026-08-29T15:02:00Z',
    });
  });

  it('marks ownership conflict without treating it as factual knowledge', () => {
    const result = mapClaimV2ToAuthorityAssertion({
      claim_id: 'claim-conflict',
      entity_type: 'artist',
      entity_id: 'artist-9',
      user_id: 'user-2',
      requested_role: 'owner',
      relationship_kind: 'artist_owner',
      verification_method: 'manual',
      status: 'conflict',
      created_at: '2026-08-29T15:00:00Z',
      evidence: [],
    });

    expect(result.ownershipConflict).toBe(true);
    expect(result.id).toBe('authority:claim-conflict:r1:conflict');
  });
});
