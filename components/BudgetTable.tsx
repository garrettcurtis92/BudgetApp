'use client'

import { useState, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Check, X } from 'lucide-react'
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
  const [categories, setCategories] = useState<BudgetCategory[]>(initialCategories)
  const [actuals, setActuals] = useState<MonthlyActual[]>(initialActuals)
  const [rollovers, setRollovers] = useState<Rollover[]>(initialRollovers)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  // Inline budget editing state
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null)
  const [budgetEditValue, setBudgetEditValue] = useState('')
  const budgetInputRef = useRef<HTMLInputElement>(null)

  // Autofill flash feedback
  const [autofilledId, setAutofilledId] = useState<string | null>(null)

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

  // Tap budget amount → autofill actual input
  function handleAutofill(cat: BudgetCategory) {
    const effective = getEffectiveBudget(cat, rollovers, month, year)
    setEdits(prev => ({ ...prev, [getEditKey(cat.id)]: String(effective) }))
    setAutofilledId(cat.id)
    setTimeout(() => setAutofilledId(null), 800)
  }

  // Start inline budget edit
  function startBudgetEdit(cat: BudgetCategory, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingBudgetId(cat.id)
    setBudgetEditValue(String(cat.budgeted_amount))
    setTimeout(() => budgetInputRef.current?.select(), 50)
  }

  async function saveBudgetEdit(cat: BudgetCategory) {
    const newAmount = parseFloat(budgetEditValue)
    if (isNaN(newAmount) || newAmount < 0) {
      cancelBudgetEdit()
      return
    }

    const supabase = createClient()
    await supabase
      .from('budget_categories')
      .update({ budgeted_amount: newAmount })
      .eq('id', cat.id)

    setCategories(prev =>
      prev.map(c => c.id === cat.id ? { ...c, budgeted_amount: newAmount } : c)
    )
    setEditingBudgetId(null)
  }

  function cancelBudgetEdit() {
    setEditingBudgetId(null)
    setBudgetEditValue('')
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    const supabase = createClient()

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

      setActuals(prev => {
        const updated = [...prev]
        for (const u of upserts) {
          const idx = updated.findIndex(
            a => a.category_id === u.category_id && a.month === u.month && a.year === u.year
          )
          if (idx >= 0) updated[idx] = { ...updated[idx], actual_amount: u.actual_amount }
          else updated.push({ id: '', ...u })
        }
        return updated
      })
    }

    const variableCategories = categories.filter(c => c.is_variable)
    const nextMonthNum = month === 12 ? 1 : month + 1
    const nextYearNum = month === 12 ? year + 1 : year

    const rolloverUpserts = variableCategories.map(cat => {
      const effective = getEffectiveBudget(cat, rollovers, month, year)
      const actual = parseFloat(edits[getEditKey(cat.id)] ?? '') ||
        getActualAmount(cat.id, actuals, month, year)
      return {
        category_id: cat.id,
        month: nextMonthNum,
        year: nextYearNum,
        rollover_amount: calculateRollover(effective, actual),
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
  }, [edits, month, year, actuals, rollovers, categories])

  const grouped = GROUP_ORDER.map(group => ({
    group,
    categories: categories.filter(c => c.group_name === group),
  })).filter(g => g.categories.length > 0)

  const totalActualEdited = categories.reduce((sum, c) => {
    const raw = edits[getEditKey(c.id)]
    const val = raw !== undefined ? (parseFloat(raw) || 0) : getActualAmount(c.id, actuals, month, year)
    return sum + val
  }, 0)
  const totalBudgeted = categories.reduce(
    (sum, c) => sum + getEffectiveBudget(c, rollovers, month, year), 0
  )

  // Reusable budget amount cell (shared by mobile + desktop)
  function BudgetAmount({ cat }: { cat: BudgetCategory }) {
    const effective = getEffectiveBudget(cat, rollovers, month, year)
    const rolloverAmt = getRolloverAmount(cat.id, rollovers, month, year)
    const isEditing = editingBudgetId === cat.id
    const isAutofilled = autofilledId === cat.id

    if (isEditing) {
      return (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>$</span>
          <input
            ref={budgetInputRef}
            type="number"
            inputMode="decimal"
            value={budgetEditValue}
            onChange={e => setBudgetEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveBudgetEdit(cat)
              if (e.key === 'Escape') cancelBudgetEdit()
            }}
            className="w-20 rounded px-1.5 py-0.5 text-sm outline-none"
            style={{
              border: '1px solid var(--color-navy)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
            }}
            autoFocus
          />
          <button onClick={() => saveBudgetEdit(cat)} className="cursor-pointer" style={{ color: 'var(--color-green)' }}>
            <Check size={13} strokeWidth={2.5} />
          </button>
          <button onClick={cancelBudgetEdit} className="cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-1.5 group">
        <button
          onClick={() => handleAutofill(cat)}
          className="text-left transition-all duration-200 cursor-pointer rounded px-1 -mx-1"
          style={{
            color: 'var(--color-text)',
            backgroundColor: isAutofilled ? '#eef4fb' : 'transparent',
          }}
          title="Tap to autofill actual"
        >
          <span className="text-sm font-medium">{formatCurrency(effective)}</span>
          {cat.is_variable && rolloverAmt > 0 && (
            <span className="block text-xs" style={{ color: 'var(--color-green)' }}>
              +{formatCurrency(rolloverAmt)} rollover
            </span>
          )}
        </button>
        <button
          onClick={e => startBudgetEdit(cat, e)}
          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 cursor-pointer"
          style={{ color: 'var(--color-text-muted)' }}
          title="Edit budget amount"
        >
          <Pencil size={11} strokeWidth={2} />
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2
          className="text-2xl"
          style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-text)' }}
        >
          Budget
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg transition-all duration-200 cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f5f3')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium w-28 text-center">
            {formatMonthYear(month, year)}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg transition-all duration-200 cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f5f5f3')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200 cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: savedMsg ? 'var(--color-green)' : 'var(--color-navy)' }}
          >
            {saving ? 'Saving…' : savedMsg ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Budget groups */}
      {grouped.map(({ group, categories: groupCats }) => (
        <div key={group} className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide px-1" style={{ color: 'var(--color-text-muted)' }}>
            {group}
          </p>

          {/* Desktop table header */}
          <div
            className="hidden md:grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase tracking-wide rounded-lg"
            style={{ backgroundColor: '#f5f5f3', color: 'var(--color-text-muted)' }}
          >
            <div className="col-span-5">Category</div>
            <div className="col-span-3">Budgeted</div>
            <div className="col-span-2 text-right">Actual</div>
            <div className="col-span-2 text-right">Variance</div>
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-border)' }}
          >
            {groupCats.map((cat, idx) => {
              const effective = getEffectiveBudget(cat, rollovers, month, year)
              const rawActual = edits[getEditKey(cat.id)]
              const actualVal = rawActual !== undefined
                ? (parseFloat(rawActual) || 0)
                : getActualAmount(cat.id, actuals, month, year)
              const variance = calculateVariance(effective, actualVal)
              const isLast = idx === groupCats.length - 1
              const isAutofilled = autofilledId === cat.id

              return (
                <div
                  key={cat.id}
                  style={{
                    backgroundColor: 'var(--color-card)',
                    borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  {/* Mobile layout */}
                  <div className="md:hidden px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {cat.name}
                      </span>
                      {cat.is_variable && (
                        <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: '#eef4fb', color: 'var(--color-navy)' }}>
                          rolls over
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-3">
                      {/* Budget amount — tap to autofill */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Budget</p>
                        <BudgetAmount cat={cat} />
                      </div>
                      {/* Actual input */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Actual</p>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={getCurrentActual(cat.id)}
                          onChange={e => handleActualChange(cat.id, e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all duration-200"
                          style={{
                            border: `1px solid ${isAutofilled ? 'var(--color-green)' : 'var(--color-border)'}`,
                            backgroundColor: isAutofilled ? '#f0faf5' : 'var(--color-bg)',
                            color: 'var(--color-text)',
                          }}
                          onFocus={e => (e.target.style.borderColor = 'var(--color-navy)')}
                          onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                        />
                      </div>
                      {/* Variance */}
                      <div className="flex-1 text-right min-w-0">
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Left</p>
                        <p
                          className="text-sm font-semibold pt-2"
                          style={{ color: variance >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}
                        >
                          {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:grid grid-cols-12 px-4 py-3 items-center">
                    <div className="col-span-5">
                      <span className="text-sm" style={{ color: 'var(--color-text)' }}>{cat.name}</span>
                    </div>
                    <div className="col-span-3">
                      <BudgetAmount cat={cat} />
                    </div>
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
                          border: `1px solid ${isAutofilled ? 'var(--color-green)' : 'var(--color-border)'}`,
                          backgroundColor: isAutofilled ? '#f0faf5' : 'var(--color-bg)',
                          color: 'var(--color-text)',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'var(--color-navy)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <span
                        className="text-sm font-medium"
                        style={{ color: variance >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}
                      >
                        {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Month Summary */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
      >
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
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
              style={{ color: INCOME_TOTAL - totalActualEdited >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}
            >
              {formatCurrency(INCOME_TOTAL - totalActualEdited)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
