'use client'

import { useState } from 'react'
import { Check, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'

interface Category {
  id: string
  name: string
  budgeted_amount: number
  due_day: number | null
  due_month: number | null
  frequency: string | null
  payment_method: string | null
  linked_debt_id: string | null
  group_name: string
  is_variable: boolean
}

interface Actual {
  id?: string
  category_id: string
  actual_amount: number
  month: number
  year: number
}

interface Debt {
  id: string
  name: string
  current_balance: number
  card_payment_method: string | null
}

interface DebtGroup {
  dueDay: number
  categories: Category[]
  total: number
}

interface Props {
  categories: Category[]
  initialActuals: Actual[]
  initialDebts: Debt[]
  receivedIncome: number
  month: number
  year: number
}

function ordinal(n: number) {
  if (n >= 11 && n <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

const CARD_META: Record<string, { label: string; note: string }> = {
  alaska_card: { label: 'Alaska Card — charges this month', note: 'Auto-charged. Pay the Alaska Card bill by the 20th.' },
  apple_card:  { label: 'Apple Card — charges this month',  note: 'Auto-charged. Pay the Apple Card bill by the 30th.' },
}

export default function PayQueueWidget({
  categories, initialActuals, initialDebts, receivedIncome, month, year,
}: Props) {
  const [actuals, setActuals] = useState(initialActuals)
  const [debts, setDebts]     = useState(initialDebts)
  const [marking, setMarking] = useState<string | null>(null)

  function isPaid(categoryId: string) {
    return actuals.some(
      a => a.category_id === categoryId && a.month === month && a.year === year && Number(a.actual_amount) > 0
    )
  }

  function isGroupPaid(group: DebtGroup) {
    return group.categories.every(c => isPaid(c.id))
  }

  // Returns the amount to use for a category on a card (actual if entered, budgeted as fallback)
  function cardAmount(cat: Category): { amount: number; estimated: boolean } {
    if (!cat.is_variable) return { amount: Number(cat.budgeted_amount), estimated: false }
    const actual = actuals.find(
      a => a.category_id === cat.id && a.month === month && a.year === year
    )
    if (actual && Number(actual.actual_amount) > 0)
      return { amount: Number(actual.actual_amount), estimated: false }
    return { amount: Number(cat.budgeted_amount), estimated: true }
  }

  async function upsertActual(categoryId: string, amount: number) {
    const supabase = createClient()
    const { data } = await supabase
      .from('monthly_actuals')
      .upsert(
        { category_id: categoryId, month, year, actual_amount: amount, updated_at: new Date().toISOString() },
        { onConflict: 'category_id,month,year' }
      )
      .select()
      .single()
    return data as Actual | null
  }

  function applyActual(data: Actual) {
    setActuals(prev => {
      const idx = prev.findIndex(
        a => a.category_id === data.category_id && a.month === month && a.year === year
      )
      if (idx >= 0) { const u = [...prev]; u[idx] = data; return u }
      return [...prev, data]
    })
  }

  async function togglePaid(cat: Category) {
    if (marking) return
    setMarking(cat.id)
    const data = await upsertActual(cat.id, isPaid(cat.id) ? 0 : Number(cat.budgeted_amount))
    if (data) applyActual(data)
    setMarking(null)
  }

  async function toggleGroupPaid(group: DebtGroup) {
    if (marking) return
    setMarking(group.categories[0].id)

    const wasAllPaid = isGroupPaid(group)
    const newAmount  = wasAllPaid ? 0 : undefined // per-cat below

    // Mark/unmark each payment category
    const results = await Promise.all(
      group.categories.map(cat =>
        upsertActual(cat.id, newAmount !== undefined ? newAmount : Number(cat.budgeted_amount))
      )
    )
    results.forEach(d => { if (d) applyActual(d) })

    // Update the linked debt balance
    const linkedDebtId = group.categories.find(c => c.linked_debt_id)?.linked_debt_id
    if (linkedDebtId) {
      const debt = debts.find(d => d.id === linkedDebtId)
      if (debt) {
        const sign = wasAllPaid ? -1 : 1 // -1 reverses the change when unmarking

        let netChange: number
        if (debt.card_payment_method) {
          // Credit card: new charges accumulate, payment reduces balance
          const chargeCategories = categories.filter(c => c.payment_method === debt.card_payment_method)
          const totalCharges = chargeCategories.reduce((sum, cat) => {
            // Skip annual bills not due this month
            if (cat.frequency === 'annual' && cat.due_month !== month) return sum
            return sum + cardAmount(cat).amount
          }, 0)
          netChange = totalCharges - group.total // positive = balance grows, negative = shrinks
        } else {
          // Direct loan: payment just reduces balance
          netChange = -group.total
        }

        const newBalance = Math.max(0, Number(debt.current_balance) + sign * netChange)
        const supabase = createClient()
        await supabase
          .from('debts')
          .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
          .eq('id', linkedDebtId)
        setDebts(prev => prev.map(d => d.id === linkedDebtId ? { ...d, current_balance: newBalance } : d))
      }
    }

    setMarking(null)
  }

  // Queue: fixed bills with due_day, not variable. Annual only in their due month.
  const queueCategories = categories.filter(c => {
    if (!c.due_day || c.is_variable) return false
    if (c.frequency === 'annual') return c.due_month === month
    return true
  })

  // Card sections: fixed queue bills + variable spending on each card
  const cardGroups = Object.entries(CARD_META)
    .map(([method, meta]) => {
      const fixedBills    = queueCategories.filter(c => c.payment_method === method)
      const variableBills = categories.filter(c => c.payment_method === method && c.is_variable)
      return { method, meta, fixedBills, variableBills }
    })
    .filter(g => g.fixedBills.length + g.variableBills.length > 0)

  // Direct bills (not on a card)
  const allDirectBills = queueCategories.filter(c => !c.payment_method || c.payment_method === 'direct')

  // Group Debts by due_day (min + extra together)
  const debtsByDay = new Map<number, Category[]>()
  for (const cat of allDirectBills.filter(c => c.group_name === 'Debts')) {
    const day = cat.due_day!
    if (!debtsByDay.has(day)) debtsByDay.set(day, [])
    debtsByDay.get(day)!.push(cat)
  }
  const debtGroups: DebtGroup[] = Array.from(debtsByDay.entries())
    .map(([dueDay, cats]) => ({
      dueDay,
      categories: cats,
      total: cats.reduce((s, c) => s + Number(c.budgeted_amount), 0),
    }))
    .sort((a, b) => a.dueDay - b.dueDay)

  const nonDebtDirect = allDirectBills
    .filter(c => c.group_name !== 'Debts')
    .sort((a, b) => (a.due_day ?? 31) - (b.due_day ?? 31))

  type QueueItem =
    | { type: 'bill';       dueDay: number; cat: Category }
    | { type: 'debt-group'; dueDay: number; group: DebtGroup }

  const queueItems: QueueItem[] = [
    ...nonDebtDirect.map(cat   => ({ type: 'bill'       as const, dueDay: cat.due_day!,  cat })),
    ...debtGroups.map(group    => ({ type: 'debt-group' as const, dueDay: group.dueDay,  group })),
  ].sort((a, b) => a.dueDay - b.dueDay)

  // Coverage dots: running unpaid cost vs received income
  let runningCost = 0
  const coverageMap = new Map<string, boolean>()
  for (const item of queueItems) {
    if (item.type === 'bill') {
      if (!isPaid(item.cat.id)) {
        runningCost += Number(item.cat.budgeted_amount)
        coverageMap.set(item.cat.id, runningCost <= receivedIncome)
      }
    } else {
      if (!isGroupPaid(item.group)) {
        runningCost += item.group.total
        coverageMap.set(`group-${item.group.dueDay}`, runningCost <= receivedIncome)
      }
    }
  }

  const totalPaid = queueCategories.filter(c => isPaid(c.id)).reduce((s, c) => s + Number(c.budgeted_amount), 0)

  if (queueCategories.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <h3
        className="text-base font-semibold"
        style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-text)' }}
      >
        Pay Queue
      </h3>

      {/* Received / Paid / Remaining summary */}
      <div
        className="rounded-xl grid grid-cols-3 divide-x overflow-hidden"
        style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderColor: 'var(--color-border)' }}
      >
        {[
          { label: 'Received',  value: receivedIncome,               color: 'var(--color-green)' },
          { label: 'Paid out',  value: totalPaid,                    color: totalPaid > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' },
          { label: 'Remaining', value: receivedIncome - totalPaid,   color: (receivedIncome - totalPaid) >= 0 ? 'var(--color-navy)' : 'var(--color-red)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-4 py-3 flex flex-col gap-0.5" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
            <p className="text-sm font-semibold" style={{ color: receivedIncome === 0 ? 'var(--color-text-muted)' : color }}>
              {receivedIncome === 0 && label === 'Received' ? '—' : formatCurrency(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Card sections */}
      {cardGroups.map(({ method, meta, fixedBills, variableBills }) => {
        const total = [...fixedBills, ...variableBills].reduce((s, c) => s + cardAmount(c).amount, 0)
        const hasEstimates = variableBills.some(c => cardAmount(c).estimated)

        // Show linked debt's updated balance if applicable
        const linkedDebt = debts.find(d => d.card_payment_method === method)

        return (
          <div
            key={method}
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <CreditCard size={14} style={{ color: 'var(--color-navy)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{meta.label}</span>
                {hasEstimates && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#fffbeb', color: 'var(--color-amber)' }}>
                    est.
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatCurrency(total)}</span>
            </div>

            {/* Fixed bills */}
            {fixedBills.map((cat, i) => (
              <div
                key={cat.id}
                className="flex items-center justify-between px-5 py-2.5"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}
              >
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>{cat.name}</span>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{formatCurrency(cat.budgeted_amount)}</span>
              </div>
            ))}

            {/* Variable spending on this card */}
            {variableBills.map((cat, i) => {
              const { amount, estimated } = cardAmount(cat)
              return (
                <div
                  key={cat.id}
                  className="flex items-center justify-between px-5 py-2.5"
                  style={{ borderTop: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--color-text)' }}>{cat.name}</span>
                    {estimated && (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>budgeted</span>
                    )}
                  </div>
                  <span className="text-sm" style={{ color: estimated ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                    {formatCurrency(amount)}
                  </span>
                </div>
              )
            })}

            {/* Footer: note + current debt balance */}
            <div
              className="px-5 py-2.5 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--color-border)', backgroundColor: '#f9f9f8' }}
            >
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{meta.note}</p>
              {linkedDebt && (
                <span className="text-xs font-medium ml-3 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                  balance {formatCurrency(linkedDebt.current_balance)}
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* Direct bills + debt groups */}
      {queueItems.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          {queueItems.map((item, i) => {
            const isLast = i === queueItems.length - 1
            const border = isLast ? 'none' : '1px solid var(--color-border)'

            if (item.type === 'bill') {
              const { cat } = item
              const paid      = isPaid(cat.id)
              const covered   = coverageMap.get(cat.id) ?? false
              const isMarking = marking === cat.id

              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer active:opacity-60 transition-opacity"
                  style={{ borderBottom: border, backgroundColor: paid ? '#f0faf5' : 'transparent', opacity: isMarking ? 0.6 : 1 }}
                  onClick={() => togglePaid(cat)}
                >
                  <div
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150"
                    style={{
                      backgroundColor: paid ? 'var(--color-green)' : 'transparent',
                      border: paid ? 'none' : `2px solid ${isMarking ? 'var(--color-green)' : 'var(--color-border)'}`,
                    }}
                  >
                    {paid && <Check size={11} color="white" strokeWidth={3} />}
                  </div>
                  <span className="text-xs w-9 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    {ordinal(cat.due_day!)}
                  </span>
                  <span
                    className="flex-1 text-sm"
                    style={{ color: paid ? 'var(--color-text-muted)' : 'var(--color-text)', textDecoration: paid ? 'line-through' : 'none' }}
                  >
                    {cat.name}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!paid && receivedIncome > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: covered ? 'var(--color-green)' : '#d1d5db' }} />
                    )}
                    <span className="text-sm font-medium" style={{ color: paid ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                      {formatCurrency(cat.budgeted_amount)}
                    </span>
                  </div>
                </div>
              )
            }

            // Debt group (min + extra stacked)
            const { group }  = item
            const groupPaid  = isGroupPaid(group)
            const covered    = coverageMap.get(`group-${group.dueDay}`) ?? false
            const isMarking  = marking === group.categories[0].id
            const linkedDebt = debts.find(d => d.id === group.categories.find(c => c.linked_debt_id)?.linked_debt_id)

            return (
              <div
                key={`group-${group.dueDay}`}
                className="cursor-pointer active:opacity-60 transition-opacity"
                style={{ borderBottom: border, backgroundColor: groupPaid ? '#f0faf5' : 'transparent', opacity: isMarking ? 0.6 : 1 }}
                onClick={() => toggleGroupPaid(group)}
              >
                {group.categories.map((cat, ci) => {
                  const isFirst       = ci === 0
                  const isLastInGroup = ci === group.categories.length - 1
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 px-4"
                      style={{ paddingTop: isFirst ? 14 : 4, paddingBottom: isLastInGroup ? 6 : 4 }}
                    >
                      <div
                        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150"
                        style={{
                          backgroundColor: isFirst ? (groupPaid ? 'var(--color-green)' : 'transparent') : 'transparent',
                          border: isFirst
                            ? groupPaid ? 'none' : `2px solid ${isMarking ? 'var(--color-green)' : 'var(--color-border)'}`
                            : 'none',
                          visibility: isFirst ? 'visible' : 'hidden',
                        }}
                      >
                        {isFirst && groupPaid && <Check size={11} color="white" strokeWidth={3} />}
                      </div>
                      <span className="text-xs w-9 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                        {isFirst ? ordinal(group.dueDay) : ''}
                      </span>
                      <span
                        className="flex-1 text-sm"
                        style={{
                          color: groupPaid ? 'var(--color-text-muted)' : isFirst ? 'var(--color-text)' : 'var(--color-text-muted)',
                          textDecoration: groupPaid ? 'line-through' : 'none',
                          fontSize: isFirst ? undefined : '0.8rem',
                        }}
                      >
                        {cat.name}
                      </span>
                      <span className="text-sm flex-shrink-0" style={{ color: groupPaid ? 'var(--color-text-muted)' : isFirst ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                        {formatCurrency(cat.budgeted_amount)}
                      </span>
                    </div>
                  )
                })}

                {/* Total row */}
                <div className="flex items-center gap-3 px-4 pb-3" style={{ paddingLeft: '3.25rem' }}>
                  <span className="w-9 flex-shrink-0" />
                  <div className="flex-1 flex items-center justify-between pt-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Total</span>
                      {linkedDebt && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          · balance {formatCurrency(linkedDebt.current_balance)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!groupPaid && receivedIncome > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: covered ? 'var(--color-green)' : '#d1d5db' }} />
                      )}
                      <span className="text-sm font-semibold" style={{ color: groupPaid ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                        {formatCurrency(group.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs px-1" style={{ color: 'var(--color-text-muted)' }}>
        {receivedIncome > 0 ? '• green dot = covered by received income · ' : ''}tap to mark paid
      </p>
    </div>
  )
}
