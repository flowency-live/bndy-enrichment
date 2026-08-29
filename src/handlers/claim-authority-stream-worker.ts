import type { AttributeValue, DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import { mapClaimV2ToAuthorityAssertion, type ClaimV2AuthorityInput } from '../authority/claim-authority.js';
import { AuthorityAssertionStore } from '../authority/authority-assertion-store.js';

const STATE_TABLE = process.env.STATE_TABLE;
if (!STATE_TABLE) throw new Error('STATE_TABLE is required');

const store = new AuthorityAssertionStore(STATE_TABLE);

function decode(value: AttributeValue | undefined): unknown {
  if (!value) return undefined;
  if ('S' in value) return value.S;
  if ('N' in value) return Number(value.N);
  if ('BOOL' in value) return value.BOOL;
  if ('NULL' in value) return null;
  if ('L' in value) return (value.L ?? []).map((item) => decode(item));
  if ('M' in value) return Object.fromEntries(Object.entries(value.M ?? {}).map(([key, item]) => [key, decode(item)]));
  if ('SS' in value) return value.SS ?? [];
  if ('NS' in value) return (value.NS ?? []).map(Number);
  if ('BS' in value) return value.BS ?? [];
  if ('B' in value) return value.B;
  return undefined;
}

export function decodeNewImage(record: DynamoDBRecord): Record<string, unknown> | null {
  const image = record.dynamodb?.NewImage;
  if (!image) return null;
  return Object.fromEntries(Object.entries(image).map(([key, value]) => [key, decode(value)]));
}

function isConditionalFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && ('name' in error || 'code' in error)
    && (((error as { name?: string }).name === 'ConditionalCheckFailedException')
      || ((error as { code?: string }).code === 'ConditionalCheckFailedException'));
}

export function claimFromStreamRecord(record: DynamoDBRecord): ClaimV2AuthorityInput | null {
  if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') return null;
  const item = decodeNewImage(record);
  if (!item || item.source !== 'join_bndy_v2') return null;

  const status = String(item.status ?? '');
  if (!['pending_review', 'verified_pending', 'more_evidence_required', 'conflict', 'approved', 'rejected', 'cancelled'].includes(status)) return null;
  const entityType = String(item.entity_type ?? '');
  if (entityType !== 'artist' && entityType !== 'venue') return null;
  const requestedRole = String(item.requested_role ?? '');
  if (requestedRole !== 'owner' && requestedRole !== 'admin' && requestedRole !== 'member') return null;
  const verificationMethod = item.verification_method === 'facebook_page' ? 'facebook_page' : 'manual';

  const requiredStrings = ['claim_id', 'entity_id', 'user_id', 'relationship_kind', 'created_at'] as const;
  if (requiredStrings.some((key) => typeof item[key] !== 'string' || String(item[key]).length === 0)) return null;

  return {
    claim_id: String(item.claim_id),
    evidence_revision: typeof item.evidence_revision === 'number' ? item.evidence_revision : 1,
    entity_type: entityType,
    entity_id: String(item.entity_id),
    user_id: String(item.user_id),
    requested_role: requestedRole,
    relationship_kind: String(item.relationship_kind),
    verification_method: verificationMethod,
    status: status as ClaimV2AuthorityInput['status'],
    evidence: Array.isArray(item.evidence) ? item.evidence as ClaimV2AuthorityInput['evidence'] : [],
    owner_conflict: status === 'conflict',
    created_at: String(item.created_at),
    updated_at: typeof item.updated_at === 'string' ? item.updated_at : String(item.created_at),
  };
}

export async function processRecord(record: DynamoDBRecord): Promise<'stored' | 'duplicate' | 'ignored'> {
  const claim = claimFromStreamRecord(record);
  if (!claim) return 'ignored';
  const assertion = mapClaimV2ToAuthorityAssertion(claim);
  try {
    await store.put(assertion);
    return 'stored';
  } catch (error) {
    if (isConditionalFailure(error)) return 'duplicate';
    throw error;
  }
}

export async function handler(event: DynamoDBStreamEvent): Promise<{ stored: number; duplicate: number; ignored: number }> {
  const result = { stored: 0, duplicate: 0, ignored: 0 };
  for (const record of event.Records) {
    const outcome = await processRecord(record);
    result[outcome] += 1;
  }
  // Deliberately log counts only. Stream records contain claimant evidence and
  // must never be copied into CloudWatch logs.
  console.log('Claim authority stream batch', result);
  return result;
}
