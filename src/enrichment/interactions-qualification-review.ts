import { z } from 'zod';

const CitationSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
}).passthrough();

const FactSchema = z.object({
  predicate: z.string().min(1),
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
  evidenceUrls: z.array(z.string().url()).min(1),
  evidenceText: z.string().min(1),
}).passthrough();

const CaseSchema = z.object({
  caseId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceCandidateKey: z.string().min(1),
  candidateType: z.enum(['artist', 'venue']),
  captureStatus: z.enum(['captured', 'error']),
  exactFailure: z.string().min(1).optional(),
  requestedPredicates: z.array(z.string().min(1)),
  citationCount: z.number().int().nonnegative(),
  admittedFacts: z.number().int().nonnegative(),
  entity: z.object({
    displayName: z.string().min(1),
  }).passthrough(),
  bundle: z.object({
    identityConfidence: z.number().min(0).max(1),
    facts: z.array(FactSchema),
    usage: z.object({
      searches: z.number().int().nonnegative(),
      modelCalls: z.number().int().nonnegative(),
    }).passthrough(),
    raw: z.object({
      identityReason: z.string().min(1).optional(),
      captureError: z.string().min(1).optional(),
      citations: z.array(CitationSchema),
    }).passthrough(),
  }).passthrough(),
}).passthrough();

const InteractionsReviewArtifactSchema = z.object({
  capturedAt: z.string().min(1),
  providerId: z.literal('gemini-interactions-evidence-first-v1'),
  reviewStatus: z.literal('unreviewed'),
  adapterStatus: z.literal('inactive'),
  attemptedCases: z.number().int().positive(),
  capturedCases: z.number().int().nonnegative(),
  errorCases: z.number().int().nonnegative(),
  canonicalWrites: z.literal(0),
  providerActivated: z.literal(false),
  scheduleCreated: z.literal(false),
  estimatedCost: z.number().nonnegative(),
  maximumReservedCost: z.number().positive(),
  approval: z.object({
    searchesPerCase: z.object({
      minimum: z.number().int().positive(),
      maximum: z.number().int().positive(),
    }),
  }).passthrough(),
  totals: z.object({
    searches: z.number().int().nonnegative(),
    modelCalls: z.number().int().nonnegative(),
    admittedFacts: z.number().int().nonnegative(),
    citationCount: z.number().int().nonnegative(),
  }).passthrough(),
  caseResults: z.array(CaseSchema).min(1),
}).passthrough().superRefine((artifact, context) => {
  const captured = artifact.caseResults.filter((item) => item.captureStatus === 'captured').length;
  const errors = artifact.caseResults.filter((item) => item.captureStatus === 'error').length;
  const admittedFacts = artifact.caseResults.reduce((total, item) => total + item.bundle.facts.length, 0);
  const searches = artifact.caseResults.reduce((total, item) => total + item.bundle.usage.searches, 0);
  const modelCalls = artifact.caseResults.reduce((total, item) => total + item.bundle.usage.modelCalls, 0);

  const checks: Array<[number, number, string]> = [
    [artifact.caseResults.length, artifact.attemptedCases, 'attemptedCases'],
    [captured, artifact.capturedCases, 'capturedCases'],
    [errors, artifact.errorCases, 'errorCases'],
    [admittedFacts, artifact.totals.admittedFacts, 'totals.admittedFacts'],
    [searches, artifact.totals.searches, 'totals.searches'],
    [modelCalls, artifact.totals.modelCalls, 'totals.modelCalls'],
  ];
  for (const [observed, recorded, field] of checks) {
    if (observed !== recorded) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field} records ${recorded}, but case results contain ${observed}`,
      });
    }
  }

  for (const item of artifact.caseResults) {
    if (item.bundle.facts.length !== item.admittedFacts) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${item.caseId} records ${item.admittedFacts} admitted facts, but the bundle contains ${item.bundle.facts.length}`,
      });
    }
    if (item.captureStatus === 'error' && !(item.exactFailure ?? item.bundle.raw.captureError)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${item.caseId} is an error without an exact failure`,
      });
    }
  }
});

type Artifact = z.infer<typeof InteractionsReviewArtifactSchema>;
type CaseResult = Artifact['caseResults'][number];
type Fact = z.infer<typeof FactSchema>;

function escaped(value: unknown): string {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function displayedValue(value: unknown): string {
  if (typeof value === 'string') return escaped(value);
  return escaped(JSON.stringify(value));
}

function citationLinks(item: CaseResult, fact: Fact): string {
  const byUrl = new Map(item.bundle.raw.citations.map((citation) => [citation.url, citation.title]));
  return [...new Set(fact.evidenceUrls)].map((url) => {
    const title = byUrl.get(url) ?? new URL(url).hostname;
    return `[${escaped(title)}](${url})`;
  }).join(', ');
}

function caseCategory(item: CaseResult): 'capture error' | 'safe abstention' | 'fact-bearing capture' {
  if (item.captureStatus === 'error') return 'capture error';
  return item.bundle.facts.length === 0 ? 'safe abstention' : 'fact-bearing capture';
}

function renderErrorCase(item: CaseResult): string[] {
  const failure = item.exactFailure ?? item.bundle.raw.captureError ?? 'Missing exact failure';
  return [
    `### ${item.caseId}: ${escaped(item.entity.displayName)}`,
    '',
    `- Source: ${escaped(item.sourceId)} / ${escaped(item.sourceCandidateKey)}`,
    `- Type: ${item.candidateType}`,
    `- Searches: ${item.bundle.usage.searches}; model calls: ${item.bundle.usage.modelCalls}; captured citations: ${item.citationCount}`,
    `- Exact failure: ${escaped(failure)}`,
    '- Adjudication: `capture-error / no fact decision`',
    '- Human notes:',
    '',
  ];
}

function renderAbstentionCase(item: CaseResult): string[] {
  return [
    `### ${item.caseId}: ${escaped(item.entity.displayName)}`,
    '',
    `- Source: ${escaped(item.sourceId)} / ${escaped(item.sourceCandidateKey)}`,
    `- Type: ${item.candidateType}`,
    `- Provider identity confidence: ${item.bundle.identityConfidence.toFixed(3)}`,
    `- Provider reason: ${escaped(item.bundle.raw.identityReason ?? 'None returned')}`,
    `- Requested predicates: ${item.requestedPredicates.map(escaped).join(', ')}`,
    '- Human abstention decision: [ ] safe park  [ ] incorrect abstention  [ ] needs external verification',
    '- Human notes:',
    '',
  ];
}

function renderFactCase(item: CaseResult): string[] {
  const lines = [
    `### ${item.caseId}: ${escaped(item.entity.displayName)}`,
    '',
    `- Source: ${escaped(item.sourceId)} / ${escaped(item.sourceCandidateKey)}`,
    `- Type: ${item.candidateType}`,
    `- Provider identity confidence: ${item.bundle.identityConfidence.toFixed(3)}`,
    `- Provider reason: ${escaped(item.bundle.raw.identityReason ?? 'None returned')}`,
    `- Requested predicates: ${item.requestedPredicates.map(escaped).join(', ')}`,
    '- Human identity decision: [ ] exact match  [ ] wrong identity  [ ] needs external verification',
    '- Human identity notes:',
    '',
    '| # | Predicate | Value | Confidence | Provider evidence text | Captured provider citation | Human fact decision | Notes |',
    '|---:|---|---|---:|---|---|---|---|',
  ];
  item.bundle.facts.forEach((fact, index) => {
    lines.push(
      `| ${index + 1} | ${escaped(fact.predicate)} | ${displayedValue(fact.value)} | ${fact.confidence.toFixed(3)} | ${escaped(fact.evidenceText)} | ${citationLinks(item, fact)} | supported / unsupported / wrong identity / needs external verification | |`,
    );
  });
  lines.push('');
  return lines;
}

export function isInteractionsQualificationArtifact(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  return Array.isArray((input as { caseResults?: unknown }).caseResults);
}

export function renderInteractionsQualificationReview(input: unknown): string {
  const artifact = InteractionsReviewArtifactSchema.parse(input);
  const errors = artifact.caseResults.filter((item) => item.captureStatus === 'error');
  const abstentions = artifact.caseResults.filter(
    (item) => item.captureStatus === 'captured' && item.bundle.facts.length === 0,
  );
  const factCases = artifact.caseResults.filter(
    (item) => item.captureStatus === 'captured' && item.bundle.facts.length > 0,
  );
  const searchBreaches = errors.filter(
    (item) => item.bundle.usage.searches > artifact.approval.searchesPerCase.maximum,
  );
  const formatErrors = errors.filter((item) => {
    const failure = item.exactFailure ?? item.bundle.raw.captureError ?? '';
    return failure.includes('invalid FACT line');
  });

  const lines = [
    '# Backline Interactions evidence-first qualification review',
    '',
    `Captured: ${artifact.capturedAt}`,
    `Provider: \`${artifact.providerId}\` (${artifact.adapterStatus})`,
    '',
    '## Fixed capture outcome',
    '',
    `- Attempted: ${artifact.attemptedCases}; captured: ${artifact.capturedCases}; errors: ${artifact.errorCases}.`,
    `- Fact-bearing captures: ${factCases.length}; safe abstentions with zero admitted facts: ${abstentions.length}.`,
    `- Admitted facts: ${artifact.totals.admittedFacts}; provider citations: ${artifact.totals.citationCount}.`,
    `- Searches: ${artifact.totals.searches}; model calls: ${artifact.totals.modelCalls}.`,
    `- Estimated cost: $${artifact.estimatedCost.toFixed(6)} against a $${artifact.maximumReservedCost.toFixed(2)} reserve.`,
    `- Canonical writes: ${artifact.canonicalWrites}; provider activated: ${artifact.providerActivated}; schedule created: ${artifact.scheduleCreated}.`,
    '',
    '**Capture verdict: `FAILED_CAPTURE_CONTRACT`. Identity and fact adjudication: `PENDING_HUMAN_ADJUDICATION`.**',
    '',
    `The run failed its approved one-to-two-search contract: ${searchBreaches.length} cases used four searches. ${formatErrors.length} further cases failed the FACT-line format. The provider cannot be qualified on this cohort, irrespective of the remaining human decisions. Human review is still required to establish identity quality, factual accuracy and whether a revised contract would be worthwhile. Raising the allowance to four searches would be a new qualification and cost contract, not an automatic repair or approval.`,
    '',
    'The links below are the immutable provider redirect URLs retained by the capture. Their visible labels are the provider citation titles. This renderer performs no network resolution and makes no provider, AWS or canonical data call.',
    '',
    '## Contract breaches',
    '',
    '| Case | Entity | Searches | Captured citations | Failure |',
    '|---|---|---:|---:|---|',
    ...errors.map((item) => `| ${item.caseId} | ${escaped(item.entity.displayName)} | ${item.bundle.usage.searches} | ${item.citationCount} | ${escaped(item.exactFailure ?? item.bundle.raw.captureError)} |`),
    '',
    '## Cohort index',
    '',
    '| Case | Type | Source | Entity | Outcome | Searches | Citations | Admitted facts | Human review |',
    '|---|---|---|---|---|---:|---:|---:|---|',
    ...artifact.caseResults.map((item) => `| ${item.caseId} | ${item.candidateType} | ${escaped(item.sourceId)} | ${escaped(item.entity.displayName)} | ${caseCategory(item)} | ${item.bundle.usage.searches} | ${item.citationCount} | ${item.bundle.facts.length} | ${item.captureStatus === 'error' ? 'capture-error / no fact decision' : 'pending'} |`),
    '',
    '## Human review instructions',
    '',
    'Review all 12 captured cases. For each fact-bearing case, first decide whether the evidence belongs to the exact BNDY entity, then decide every admitted fact independently. Mark uncertainty as `needs external verification`; do not infer support from provider confidence. For each abstention, decide whether parking was safe or incorrectly withheld a knowable match. The eight capture errors contain no admitted facts and therefore receive no fact decision.',
    '',
    '## Capture errors',
    '',
    ...errors.flatMap(renderErrorCase),
    '## Safe abstentions',
    '',
    ...abstentions.flatMap(renderAbstentionCase),
    '## Fact-bearing captures',
    '',
    ...factCases.flatMap(renderFactCase),
    '## Final human record',
    '',
    '- Capture verdict: `FAILED_CAPTURE_CONTRACT`',
    '- Identity and fact adjudication: `PENDING_HUMAN_ADJUDICATION`',
    '- Confident false identities found:',
    '- Wrong official URLs found:',
    '- Expected-park outcomes reviewed:',
    '- Requested-predicate coverage where knowable:',
    '- Reviewer:',
    '- Reviewed at:',
    '- Recommendation: [ ] do not re-run  [ ] propose a fresh bounded contract  [ ] abandon provider',
    '- Recommendation notes:',
    '',
  ];

  return `${lines.join('\n')}\n`;
}
