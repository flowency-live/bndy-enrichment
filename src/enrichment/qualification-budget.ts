// Cohort budget control for provider qualification runs.
//
// A qualification run reserves a total cost ceiling before any provider call.
// Each case additionally carries a per-case reserved ceiling. The run must
// stop BEFORE a case whose reserved cost could breach the total reservation,
// and must never rely on post-hoc measurement to stay inside the approval.

export interface CohortBudget {
  totalReservedUsd: number;
  perCaseReservedUsd: number;
}

export interface CohortBudgetState {
  spentEstimatedUsd: number;
  attemptedCases: number;
}

export function canAttemptNextCase(budget: CohortBudget, state: CohortBudgetState): boolean {
  if (budget.perCaseReservedUsd <= 0 || budget.totalReservedUsd <= 0) return false;
  if (budget.perCaseReservedUsd > budget.totalReservedUsd) return false;
  return state.spentEstimatedUsd + budget.perCaseReservedUsd <= budget.totalReservedUsd;
}

export function recordCaseSpend(state: CohortBudgetState, estimatedCostUsd: number | undefined, perCaseReservedUsd: number): CohortBudgetState {
  // A case with no measured cost is charged its FULL reservation: absence of
  // measurement must never create budget headroom.
  const charge = typeof estimatedCostUsd === 'number' && Number.isFinite(estimatedCostUsd) && estimatedCostUsd >= 0
    ? Math.max(estimatedCostUsd, 0)
    : perCaseReservedUsd;
  return {
    spentEstimatedUsd: state.spentEstimatedUsd + charge,
    attemptedCases: state.attemptedCases + 1,
  };
}
