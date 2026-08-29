import { describe, expect, it } from 'vitest';
import { canAttemptNextCase, recordCaseSpend } from '../src/enrichment/qualification-budget.js';

const budget = { totalReservedUsd: 1.5, perCaseReservedUsd: 0.05 };

describe('qualification cohort budget', () => {
  it('permits a case only while its full reservation fits inside the total', () => {
    expect(canAttemptNextCase(budget, { spentEstimatedUsd: 0, attemptedCases: 0 })).toBe(true);
    expect(canAttemptNextCase(budget, { spentEstimatedUsd: 1.45, attemptedCases: 29 })).toBe(true);
    expect(canAttemptNextCase(budget, { spentEstimatedUsd: 1.451, attemptedCases: 29 })).toBe(false);
    expect(canAttemptNextCase(budget, { spentEstimatedUsd: 1.5, attemptedCases: 30 })).toBe(false);
  });

  it('refuses degenerate budgets outright', () => {
    expect(canAttemptNextCase({ totalReservedUsd: 0, perCaseReservedUsd: 0.05 }, { spentEstimatedUsd: 0, attemptedCases: 0 })).toBe(false);
    expect(canAttemptNextCase({ totalReservedUsd: 1, perCaseReservedUsd: 0 }, { spentEstimatedUsd: 0, attemptedCases: 0 })).toBe(false);
    expect(canAttemptNextCase({ totalReservedUsd: 0.04, perCaseReservedUsd: 0.05 }, { spentEstimatedUsd: 0, attemptedCases: 0 })).toBe(false);
  });

  it('charges the full per-case reservation when a case has no measured cost', () => {
    const state = recordCaseSpend({ spentEstimatedUsd: 0.1, attemptedCases: 2 }, undefined, 0.05);
    expect(state.spentEstimatedUsd).toBeCloseTo(0.15, 10);
    expect(state.attemptedCases).toBe(3);
  });

  it('charges measured cost when present, including zero', () => {
    expect(recordCaseSpend({ spentEstimatedUsd: 0, attemptedCases: 0 }, 0.0296, 0.05).spentEstimatedUsd).toBeCloseTo(0.0296, 10);
    expect(recordCaseSpend({ spentEstimatedUsd: 0.5, attemptedCases: 9 }, 0, 0.05).spentEstimatedUsd).toBeCloseTo(0.5, 10);
  });

  it('never lets NaN or negative measurements create headroom', () => {
    expect(recordCaseSpend({ spentEstimatedUsd: 0, attemptedCases: 0 }, Number.NaN, 0.05).spentEstimatedUsd).toBeCloseTo(0.05, 10);
    expect(recordCaseSpend({ spentEstimatedUsd: 0, attemptedCases: 0 }, -1, 0.05).spentEstimatedUsd).toBeCloseTo(0.05, 10);
  });
});
