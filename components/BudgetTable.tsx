'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, formatMonthYear } from '@/lib/formatters'
import {
  BudgetCategory,
  MonthlyActual,
  Rollover,
  getEffectiveBudget,
  getActualAmount,
  calculateVariance,
  calculateRollover,
  getRolloverAmount,
} from '@/lib/budgetUtils'

const INCOME_TOTAL = 7099.30

const GROUP_ORDER = [
  'Fixed Expenses',
  'Debts',
  'Insurance & Giving',
  'Subscriptions',
  'Variable',
  'Savings',
]

interface Props {
  initialCategories: BudgetCategory[]
  initialActuals: MonthlyActual[]
  initialRollovers: Rollover[]
}

export default function BudgetTable({ initialCategories, initialActuals, initialRollovers }: Props) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [actuals, setActuals] = useState<MonthlyActual[]>(initialActuals)
  const [rollovers, setRollovers] = useState<Rollover[]>(initialRollovers)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function getEditKey(categoryId: string) {
    return `${categoryId}-${month}-${year}`
  }

  function getCurrentActual(categoryId: string): string {
    const key = getEditKey(categoryId)
    if (edits[key] !== undefined) return edits[key]
    const val = getActualAmount(categoryId, actuals, month, year)
    return val > 0 ? String(val) : ''
  }

  function handleActualChange(categoryId: string, value: string) {
    setEdits(prev => ({ ...prev, [getEditKey(categoryId)]: value }))
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    const supabase = createClient()

    // Collect all edited actuals
    const upserts = Object.entries(edits)
      .filter(([key]) => key.endsWith(`-${month}-${year}`))
      .map(([key, value]) => {
        const categoryId = key.replace(`-${month}-${year}`, '')
        return {
          category_id: categoryId,
          month,
          year,
          actual_amount: parseFloat(value) || 0,
          updated_at: new Date().toISOString(),
        }
      })

    if (upserts.length > 0) {
      await supabase
        .from('monthly_actuals')
        .upsert(upserts, { onConflict: 'category_id,month,year' })

      // Update local actuals state
      setActuals(prev => {
        const updated = [...prev]
        for (const u of upserts) {
          const idx = updated.findIndex(
            a => a.category_id === u.category_id && a.month === u.month && a.year === u.year
          )
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], actual_amount: u.actual_amount }
          } else {
            updated.push({ id: '', ...u })
          }
        }
        return updated
      })
    }

    // Calculate and save rollovers for variable categories
    const variableCategories = initialCategories.filter(c => c.is_variable)
    const nextMonthNum = month === 12 ? 1 : month + 1
    const nextYearNum = month === 12 ? year + 1 : year

    const rolloverUpserts = variableCategories.map(cat => {
      const effective = getEffectiveBudget(cat, rollovers, month, year)
      const actual = parseFloat(edits[getEditKey(cat.id)] ?? '') ||
        getActualAmount(cat.id, actuals, month, year)
      const rolloverAmount = calculateRollover(effective, actual)

      return {
        category_id: cat.id,
        month: nextMonthNum,
        year: nextYearNum,
        rollover_amount: rolloverAmount,
      }
    })

    if (rolloverUpserts.length > 0) {
      const { data: newRollovers } = await supabase
        .from('rollovers')
        .upsert(rolloverUpserts, { onConflict: 'category_id,month,year' })
        .select()

      if (newRollovers) {
        setRollovers(prev => {
          const updated = [...prev]
          for (const r of newRollovers) {
            const idx = updated.findIndex(
              x => x.category_id === r.category_id && x.month === r.month && x.year === r.year
            )
            if (idx >= 0) updated[idx] = r
            else updated.push(r)
          }
          return updated
        })
      }
    }

    setEdits({})
    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }, [edits, month, year, actuals, rollovers, initialCategories])

  const grouped = GROUP_ORDER.map(group => ({
    group,
    categories: initialCategories.filter(c => c.group_name === group),
  })).filter(g => g.categories.length > 0)

  const totalBudgeted = initialCategories.reduce(
    (sum, c) => sum + getEffectiveBudget(c, rollovers, month, year), 0
  )
  const totalActual = initialCategories.reduce(
    (sum, c) => sum + getActualAmount(c.id, actuals, month, year), 0
  )
  const totalActualEdited = initialCategories.reduce((sum, c) => {
    const raw = edits[getEditKey(c.id)]
    const val = raw !== undefined ? (parseFloat(raw) || 0) : getActualAmount(c.id, actuals, month, year)
    return sum + val
  }, 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="text-2xl"
          style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-text)' }}
        >
          Monthly Budget
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f5f3')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium min-w-28 text-center">
            {formatMonthYear(month, year)}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f5f3')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: savedMsg ? 'var(--color-green)' : 'var(--color-navy)' }}
          >
            {saving ? 'Saving…' : savedMsg ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)' }}
      >
        {/* Column headers */}
        <div
          className="grid grid-cols-12 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: '#f5f5f3',
            color: 'var(--color-text-muted)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="col-span-5">Category</div>
          <div className="col-span-2 text-right">Budgeted</div>
          <div className="col-span-2 text-right">Actual</div>
          <div className="col-span-2 text-right">Variance</div>
          <div className="col-span-1 text-right">↩</div>
        </div>

        {grouped.map(({ group, categories }) => (
          <div key={group}>
            {/* Group header */}
            <div
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
              style={{
                backgroundColor: '#fafaf8',
                color: 'var(--color-text-muted)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              {group}
            </div>
            {/* Rows */}
            {categories.map((cat, idx) => {
              const effective = getEffectiveBudget(cat, rollovers, month, year)
              const rolloverAmt = getRolloverAmount(cat.id, rollovers, month, year)
              const rawActual = edits[getEditKey(cat.id)]
              const actualVal = rawActual !== undefined
                ? (parseFloat(rawActual) || 0)
                : getActualAmount(cat.id, actuals, month, year)
              const variance = calculateVariance(effective, actualVal)
              const isLast = idx === categories.length - 1

              return (
                <div
                  key={cat.id}
                  className="grid grid-cols-12 px-4 py-3 items-center"
                  style={{
                    backgroundColor: 'var(--color-card)',
                    borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  {/* Category name */}
                  <div className="col-span-5">
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                      {cat.name}
                    </span>
                  </div>

                  {/* Budgeted */}
                  <div className="col-span-2 text-right">
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                      {formatCurrency(effective)}
                    </span>
                    {cat.is_variable && rolloverAmt > 0 && (
                      <div className="text-xs" style={{ color: 'var(--color-green)' }}>
                        +{formatCurrency(rolloverAmt)} rollover
                      </div>
                    )}
                  </div>

                  {/* Actual input */}
                  <div className="col-span-2 flex justify-end">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={getCurrentActual(cat.id)}
                      onChange={e => handleActualChange(cat.id, e.target.value)}
                      className="w-24 text-right rounded px-2 py-1 text-sm outline-none transition-all duration-200"
                      style={{
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'var(--color-navy)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                    />
                  </div>

                  {/* Variance */}
                  <div className="col-span-2 text-right">
                    <span
                      className="text-sm font-medium"
                      style={{
                        color: variance >= 0 ? 'var(--color-green)' : 'var(--color-red)',
                      }}
                    >
                      {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                    </span>
                  </div>

                  {/* Rollover indicator */}
                  <div className="col-span-1 text-right">
                    {cat.is_variable && (
                      <span className="text-xs" style={{ color: 'var(--color-navy)' }}>
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Month Summary */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
      >
        <h3
          className="text-base font-semibold mb-4"
          style={{ color: 'var(--color-text)' }}
        >
          {formatMonthYear(month, year)} Summary
        </h3>
        <div className="flex flex-col gap-2">
          {[
            { label: 'Total income', value: INCOME_TOTAL, color: 'var(--color-green)' },
            { label: 'Total budgeted', value: totalBudgeted, color: 'var(--color-text)' },
            { label: 'Total actual spent', value: totalActualEdited, color: 'var(--color-text)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
              <span className="text-sm font-medium" style={{ color }}>{formatCurrency(value)}</span>
            </div>
          ))}
          <div
            className="flex justify-between pt-2 mt-1"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <span className="text-sm font-semibold">Net remaining</span>
            <span
              className="text-sm font-semibold"
              style={{
                color: INCOME_TOTAL - totalActualEdited >= 0 ? 'var(--color-green)' : 'var(--color-red)',
              }}
            >
              {formatCurrency(INCOME_TOTAL - totalActualEdited)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
