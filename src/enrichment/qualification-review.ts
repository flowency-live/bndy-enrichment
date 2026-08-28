import { z } from 'zod';

const FactSchema = z.object({
  predicate: z.string().min(1),
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
  evidenceUrls: z.array(z.string().url()).default([]),
}).passthrough();

const RejectedFactSchema = z.object({
  fact: FactSchema,
  reason: z.string().min(1),
}).passthrough();

const EvidenceSchema = z.object({
  sourceUrl: z.string().url(),
  sourceDomain: z.string().optional(),
}).passthrough();

const ReviewArtifactSchema = z.object({
  capturedAt: z.string().min(1),
  cases: z.number().int().positive(),
  artistCases: z.number().int().nonnegative(),
  venueCases: z.number().int().nonnegative(),
  captureErrors: z.number().int().nonnegative(),
  totalEstimatedCost: z.number().nonnegative(),
  canonicalWrites: z.literal(0),
  items: z.array(z.object({
    caseId: z.string().min(1),
    sourceId: z.string().min(1),
    sourceCandidateKey: z.string().min(1),
    captureStatus: z.enum(['captured', 'error']),
    entity: z.object({
      entityType: z.enum(['artist', 'venue']),
      displayName: z.string().min(1),
    }).passthrough(),
    bundle: z.object({
      identityConfidence: z.number().min(0).max(1),
      facts: z.array(FactSchema).default([]),
      raw: z.object({
        identityReason: z.string().optional(),
        captureError: z.string().optional(),
        rejectedFacts: z.array(RejectedFactSchema).optional(),
        evidence: z.array(EvidenceSchema).optional(),
      }).passthrough().optional(),
    }).passthrough(),
  }).passthrough()),
});

function escaped(value: unknown): string {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function factLabel(fact: z.infer<typeof FactSchema>): string {
  return `${fact.predicate}=${escaped(fact.value)} (${fact.confidence.toFixed(3)})`;
}

function evidenceLinks(urls: string[]): string {
  const unique = [...new Set(urls)];
  return unique.length ? unique.map((url) => `[link](${url})`).join(', ') : 'none';
}

export function renderQualificationReview(input: unknown): string {
  const artifact = ReviewArtifactSchema.parse(input);
  const capturedCases = artifact.items.filter((item) => item.captureStatus === 'captured').length;
  const acceptedFacts = artifact.items.reduce((total, item) => total + item.bundle.facts.length, 0);
  const quarantinedFacts = artifact.items.reduce(
    (total, item) => total + (item.bundle.raw?.rejectedFacts?.length ?? 0),
    0,
  );

  const lines = [
    '# Backline grounded-enrichment qualification review',
    '',
    `Captured: ${artifact.capturedAt}`,
    '',
    'This is a bounded 20-case provider qualification cohort, not the full Backline corpus. It contains 10 artists and 10 venues selected from the live Trust Loop review set. No canonical writes occurred.',
    '',
    `Captured cases: ${capturedCases}/${artifact.cases}. Capture errors: ${artifact.captureErrors}. Accepted facts: ${acceptedFacts}. Quarantined facts: ${quarantinedFacts}. Estimated cost: $${artifact.totalEstimatedCost.toFixed(4)}.`,
    '',
    'A quarantined fact is visible for review but is not accepted evidence and cannot project to canonical BNDY. Human adjudication does not repair missing provider citations; those cases remain parked.',
    '',
    '| Case | Type | Source | Entity | Capture | Identity confidence | Accepted | Quarantined | Human identity |',
    '|---|---|---|---|---|---:|---:|---:|---|',
    ...artifact.items.map((item) => {
      const rejected = item.bundle.raw?.rejectedFacts?.length ?? 0;
      return `| ${item.caseId} | ${item.entity.entityType} | ${escaped(item.sourceId)} | ${escaped(item.entity.displayName)} | ${item.captureStatus} | ${item.bundle.identityConfidence.toFixed(3)} | ${item.bundle.facts.length} | ${rejected} | match / park |`;
    }),
    '',
    '## Review instructions',
    '',
    'Confirm `match` only if the captured provider evidence definitely belongs to the exact Artist or Venue. Mark `park` for ambiguity, a same-name entity, weak locality, missing provider citations or an unproven official link. Any confident false identity, wrong official URL or unsupported classification fails qualification.',
    '',
  ];

  for (const item of artifact.items) {
    const raw = item.bundle.raw;
    const rejected = raw?.rejectedFacts ?? [];
    const capturedEvidence = raw?.evidence?.map((evidence) => evidence.sourceUrl) ?? [];
    const acceptedEvidence = item.bundle.facts.flatMap((fact) => fact.evidenceUrls);
    const rejectedEvidence = rejected.flatMap((entry) => entry.fact.evidenceUrls);
    lines.push(
      `### ${item.caseId}: ${item.entity.displayName}`,
      '',
      `- Source: ${item.sourceId} / ${item.sourceCandidateKey}`,
      `- Capture status: ${item.captureStatus}`,
      `- Provider identity confidence: ${item.bundle.identityConfidence.toFixed(3)}`,
      `- Provider reasoning or error: ${escaped(raw?.identityReason ?? raw?.captureError ?? 'None returned')}`,
      `- Accepted facts: ${item.bundle.facts.length ? item.bundle.facts.map(factLabel).join('; ') : 'none'}`,
      `- Quarantined facts: ${rejected.length ? rejected.map((entry) => `${factLabel(entry.fact)} [${escaped(entry.reason)}]`).join('; ') : 'none'}`,
      `- Captured provider evidence: ${evidenceLinks(capturedEvidence)}`,
      `- All cited URLs: ${evidenceLinks([...acceptedEvidence, ...rejectedEvidence])}`,
      '- Human identity decision: [ ] match  [ ] park',
      '- Human fact decision: [ ] all supported  [ ] corrections required  [ ] provider evidence missing',
      '- Human notes:',
      '',
    );
  }

  return `${lines.join('\n')}\n`;
}
