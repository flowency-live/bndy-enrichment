import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  isInteractionsQualificationArtifact,
  renderInteractionsQualificationReview,
} from '../src/enrichment/interactions-qualification-review.js';

describe('Interactions evidence-first qualification review', () => {
  it('renders the exact captured outcome and preserves the human adjudication gate', async () => {
    const artifact = JSON.parse(await readFile(
      new URL('../ops/enrichment/gemini-interactions-evidence-first-20-case-unreviewed.json', import.meta.url),
      'utf8',
    ));
    const review = renderInteractionsQualificationReview(artifact);

    expect(review).toContain('Attempted: 20; captured: 12; errors: 8.');
    expect(review).toContain('Fact-bearing captures: 9; safe abstentions with zero admitted facts: 3.');
    expect(review).toContain('Admitted facts: 50; provider citations: 86.');
    expect(review).toContain('Searches: 52; model calls: 20.');
    expect(review).toContain('Estimated cost: $0.758573 against a $1.50 reserve.');
    expect(review).toContain('Canonical writes: 0; provider activated: false; schedule created: false.');
    expect(review).toContain('`FAILED_CAPTURE_CONTRACT`');
    expect(review).toContain('`PENDING_HUMAN_ADJUDICATION`');
    expect(review).toContain('Raising the allowance to four searches would be a new qualification and cost contract');
  });

  it('renders every error, abstention and admitted fact with the correct review decision', async () => {
    const artifact = JSON.parse(await readFile(
      new URL('../ops/enrichment/gemini-interactions-evidence-first-20-case-unreviewed.json', import.meta.url),
      'utf8',
    ));
    const review = renderInteractionsQualificationReview(artifact);

    expect(review.match(/Adjudication: `capture-error \/ no fact decision`/g)).toHaveLength(8);
    expect(review.match(/Human abstention decision:/g)).toHaveLength(3);
    expect(review.match(/Human identity decision:/g)).toHaveLength(9);
    expect(review.match(/supported \/ unsupported \/ wrong identity \/ needs external verification/g)).toHaveLength(50);
    expect(review).toContain('interactions-evidence-first-q03-artist: Neovenator');
    expect(review).toContain('observed 4 Google Search queries, expected one or two');
    expect(review).toContain('interactions-evidence-first-q10-artist: Tom Meighan Raw26');
    expect(review).toContain('invalid FACT line');
    expect(review).toContain('interactions-evidence-first-q01-artist: the Reform');
    expect(review).toContain('hasWebsiteUrl');
    expect(review).toContain('[facebook.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/');
  });

  it('only selects artefacts with caseResults for the Interactions renderer', () => {
    expect(isInteractionsQualificationArtifact({ caseResults: [] })).toBe(true);
    expect(isInteractionsQualificationArtifact({ items: [] })).toBe(false);
    expect(isInteractionsQualificationArtifact(null)).toBe(false);
  });
});
