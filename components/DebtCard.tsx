'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'
import ProgressBar from './ProgressBar'

interface Debt {
  id: string
  name: string
  original_balance: number
  current_balance: number
  apr: number
  apr_is_estimate: boolean
  min_payment: number
  extra_payment: number
  priority: number
  payoff_target_date: string | null
  is_paid_off: boolean
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Pay off immediately', color: 'var(--color-red)' },
  2: { label: 'Primary target', color: 'var(--color-amber)' },
  3: { label: 'After BofA', color: 'var(--color-navy)' },
  4: { label: 'After Card 1', color: 'var(--color-navy)' },
  5: { label: 'Parallel', color: 'var(--color-text-muted)' },
}

interface Props {
  debt: Debt
  onUpdate: (id: string, newBalance: number) => void
}

export default function DebtCard({ debt, onUpdate }: Props) {
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const pctPaid = Math.round(
    ((debt.original_balance - debt.current_balance) / debt.original_balance) * 100
  )
  const monthlyInterest = (debt.current_balance * (debt.apr / 100)) / 12
  const totalPayment = debt.min_payment + debt.extra_payment
  const priority = PRIORITY_LABELS[debt.priority] ?? { label: `Priority ${debt.priority}`, color: 'var(--color-text-muted)' }

  async function handleUpdate() {
    const newBalance = parseFloat(input)
    if (isNaN(newBalance) || newBalance < 0) return
    setSaving(true)

    const supabase = createClient()
    await supabase
      .from('debts')
      .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', debt.id)

    onUpdate(debt.id, newBalance)
    setInput('')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>
            {debt.name}
          </h3>
          {debt.payoff_target_date && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Target: {debt.payoff_target_date}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${priority.color}18`,
              color: priority.color,
            }}
          >
            {priority.label}
          </span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#f5f5f3', color: 'var(--color-text-muted)' }}
          >
            {debt.apr_is_estimate ? '~' : ''}{debt.apr}% APR
          </span>
        </div>
      </div>

      {/* Balance */}
      <div>
        <p
          className="text-3xl font-semibold"
          style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-red)' }}
        >
          {formatCurrency(debt.current_balance)}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {pctPaid}% paid off
        </p>
      </div>

      {/* Progress bar */}
      <ProgressBar pct={pctPaid} color="var(--color-navy)" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Monthly interest', value: formatCurrency(monthlyInterest) },
          { label: 'Total payment', value: formatCurrency(totalPayment) },
          { label: 'Extra payment', value: formatCurrency(debt.extra_payment) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg p-3 text-center"
            style={{ backgroundColor: '#f5f5f3' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Update balance */}
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="New balance"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-all duration-200"
          style={{
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--color-navy)')}
          onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
          onKeyDown={e => e.key === 'Enter' && handleUpdate()}
        />
        <button
          onClick={handleUpdate}
          disabled={saving || !input}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200 cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: saved ? 'var(--color-green)' : 'var(--color-navy)' }}
        >
          {saving ? '…' : saved ? 'Saved!' : 'Update'}
        </button>
      </div>
    </div>
  )
}
