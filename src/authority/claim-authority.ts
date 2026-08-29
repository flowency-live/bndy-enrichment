import { createHash } from 'node:crypto';
import { z } from 'zod';

export const AuthorityEntityTypeSchema = z.enum(['artist', 'venue']);
export type AuthorityEntityType = z.infer<typeof AuthorityEntityTypeSchema>;

export const AuthorityRoleSchema = z.enum(['owner', 'admin', 'member']);
export type AuthorityRole = z.infer<typeof AuthorityRoleSchema>;

export const AuthorityVerificationMethodSchema = z.enum(['manual', 'facebook_page']);
export type AuthorityVerificationMethod = z.infer<typeof AuthorityVerificationMethodSchema>;

export const AuthorityStatusSchema = z.enum([
  'pending_review',
  'verified_pending',
  'more_evidence_required',
  'conflict',
  'approved',
  'rejected',
  'cancelled',
]);
export type AuthorityStatus = z.infer<typeof AuthorityStatusSchema>;

const PublicFacebookPageSchema = z.object({
  pageId: z.string().min(1),
  pageName: z.string().min(1).optional(),
  pageUrl: z.string().url().optional(),
  verifiedAt: z.string().min(1).optional(),
});

export const AuthorityAssertionSchema = z.object({
  id: z.string().min(1),
  claimRequestId: z.string().min(1),
  evidenceRevision: z.number().int().positive(),
  entityType: AuthorityEntityTypeSchema,
  entityId: z.string().min(1),
  actorRef: z.string().regex(/^bndy-user:[a-f0-9]{32}$/),
  requestedRole: AuthorityRoleSchema,
  relationshipKind: z.string().min(1),
  verificationMethod: AuthorityVerificationMethodSchema,
  status: AuthorityStatusSchema,
  evidenceClasses: z.object({
    explanationSupplied: z.boolean(),
    officialEmailSupplied: z.boolean(),
    supportingUrlSupplied: z.boolean(),
    facebookPageControlSupplied: z.boolean(),
  }),
  supportingUrl: z.string().url().optional(),
  facebookPage: PublicFacebookPageSchema.optional(),
  ownershipConflict: z.boolean().default(false),
  assertedAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type AuthorityAssertion = z.infer<typeof AuthorityAssertionSchema>;

export type ClaimV2Evidence = {
  // Preferred portable shape.
  type?: string;
  explanation?: string;
  official_email?: string | null;
  supporting_url?: string | null;
  page_id?: string | null;
  page_name?: string | null;
  page_url?: string | null;
  verified_at?: string | null;

  // Current bndy-serverless-api persistence shape. Supporting both shapes keeps
  // this boundary honest to production without copying its private metadata.
  method?: string;
  public_reference?: string | null;
  observed_at?: string | null;
  metadata?: {
    explanation?: string | null;
    official_email?: string | null;
    page_id?: string | null;
    page_name?: string | null;
    page_url?: string | null;
    verified_at?: string | null;
  } | null;
};

export type ClaimV2AuthorityInput = {
  claim_id: string;
  evidence_revision?: number;
  entity_type: AuthorityEntityType;
  entity_id: string;
  user_id: string;
  requested_role: AuthorityRole;
  relationship_kind: string;
  verification_method: AuthorityVerificationMethod;
  status: AuthorityStatus;
  evidence?: ClaimV2Evidence[];
  owner_conflict?: boolean;
  created_at: string;
  updated_at?: string;
};

function actorReference(userId: string): string {
  const digest = createHash('sha256').update(`bndy-claim-authority:${userId}`).digest('hex').slice(0, 32);
  return `bndy-user:${digest}`;
}

function safePublicUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function evidenceKind(item: ClaimV2Evidence): 'manual' | 'facebook_page' | 'other' {
  if (item.type === 'manual_relationship' || item.method === 'manual_explanation') return 'manual';
  if (item.type === 'facebook_page_control' || item.method === 'facebook_page_control') return 'facebook_page';
  return 'other';
}

function manualExplanation(item: ClaimV2Evidence | undefined): string | undefined {
  return item?.explanation ?? item?.metadata?.explanation ?? undefined;
}

function manualEmail(item: ClaimV2Evidence | undefined): string | undefined {
  return item?.official_email ?? item?.metadata?.official_email ?? undefined;
}

function supportingReference(item: ClaimV2Evidence | undefined): string | undefined {
  return item?.supporting_url ?? item?.public_reference ?? undefined;
}

function pageField(item: ClaimV2Evidence | undefined, field: 'page_id' | 'page_name' | 'page_url' | 'verified_at'): string | undefined {
  return item?.[field] ?? item?.metadata?.[field] ?? undefined;
}

export function mapClaimV2ToAuthorityAssertion(input: ClaimV2AuthorityInput): AuthorityAssertion {
  const evidence = input.evidence ?? [];
  const manual = evidence.find((item) => evidenceKind(item) === 'manual');
  const facebook = evidence.find((item) => evidenceKind(item) === 'facebook_page');
  const revision = input.evidence_revision ?? 1;
  const supportingUrl = safePublicUrl(supportingReference(manual));
  const pageId = pageField(facebook, 'page_id');
  const pageUrl = safePublicUrl(pageField(facebook, 'page_url'));

  const assertion: AuthorityAssertion = {
    id: `authority:${input.claim_id}:r${revision}`,
    claimRequestId: input.claim_id,
    evidenceRevision: revision,
    entityType: input.entity_type,
    entityId: input.entity_id,
    actorRef: actorReference(input.user_id),
    requestedRole: input.requested_role,
    relationshipKind: input.relationship_kind,
    verificationMethod: input.verification_method,
    status: input.status,
    evidenceClasses: {
      explanationSupplied: Boolean(manualExplanation(manual)?.trim()),
      officialEmailSupplied: Boolean(manualEmail(manual)?.trim()),
      supportingUrlSupplied: Boolean(supportingUrl),
      facebookPageControlSupplied: Boolean(pageId),
    },
    supportingUrl,
    facebookPage: pageId
      ? {
          pageId,
          pageName: pageField(facebook, 'page_name'),
          pageUrl,
          verifiedAt: pageField(facebook, 'verified_at') ?? facebook?.observed_at ?? undefined,
        }
      : undefined,
    ownershipConflict: Boolean(input.owner_conflict || input.status === 'conflict'),
    assertedAt: input.created_at,
    updatedAt: input.updated_at ?? input.created_at,
  };

  return AuthorityAssertionSchema.parse(assertion);
}

export function containsSensitiveClaimMaterial(value: AuthorityAssertion): boolean {
  // Check values only. The safe schema intentionally contains boolean field
  // names such as explanationSupplied and officialEmailSupplied; those names
  // are not sensitive material themselves.
  const values: string[] = [
    value.id,
    value.claimRequestId,
    value.entityType,
    value.entityId,
    value.actorRef,
    value.requestedRole,
    value.relationshipKind,
    value.verificationMethod,
    value.status,
    value.supportingUrl ?? '',
    value.facebookPage?.pageId ?? '',
    value.facebookPage?.pageName ?? '',
    value.facebookPage?.pageUrl ?? '',
    value.facebookPage?.verifiedAt ?? '',
    value.assertedAt,
    value.updatedAt,
  ];
  return values.some((entry) => entry.includes('@'));
}
