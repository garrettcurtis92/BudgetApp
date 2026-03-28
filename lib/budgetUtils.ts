export interface BudgetCategory {
  id: string
  name: string
  group_name: string
  budgeted_amount: number
  is_variable: boolean
  sort_order: number
  is_active: boolean
}

export interface MonthlyActual {
  id: string
  category_id: string
  month: number
  year: number
  actual_amount: number
}

export interface Rollover {
  id: string
  category_id: string
  month: number
  year: number
  rollover_amount: number
}

export interface BudgetOverride {
  id: string
  category_id: string
  month: number
  year: number
  budgeted_amount: number
}

export function getBaseBudget(
  category: BudgetCategory,
  overrides: BudgetOverride[],
  month: number,
  year: number
): number {
  const override = overrides.find(
    (o) => o.category_id === category.id && o.month === month && o.year === year
  )
  return override?.budgeted_amount ?? category.budgeted_amount
}

export function getEffectiveBudget(
  category: BudgetCategory,
  rollovers: Rollover[],
  month: number,
  year: number,
  overrides: BudgetOverride[] = []
): number {
  const base = getBaseBudget(category, overrides, month, year)
  const rollover = rollovers.find(
    (r) => r.category_id === category.id && r.month === month && r.year === year
  )
  return base + (rollover?.rollover_amount ?? 0)
}

export function getActualAmount(
  categoryId: string,
  actuals: MonthlyActual[],
  month: number,
  year: number
): number {
  const actual = actuals.find(
    (a) => a.category_id === categoryId && a.month === month && a.year === year
  )
  return actual?.actual_amount ?? 0
}

export function calculateVariance(effective: number, actual: number): number {
  return effective - actual
}

/**
 * Calculate rollover for a variable category.
 * Positive variance carries forward; negative is floored at 0.
 */
export function calculateRollover(effective: number, actual: number): number {
  const variance = effective - actual
  return Math.max(0, variance)
}

export function getRolloverAmount(
  categoryId: string,
  rollovers: Rollover[],
  month: number,
  year: number
): number {
  const rollover = rollovers.find(
    (r) => r.category_id === categoryId && r.month === month && r.year === year
  )
  return rollover?.rollover_amount ?? 0
}
