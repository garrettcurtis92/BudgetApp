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

function getPriorityLabel(rank: number): { label: string; color: string } {
  if (rank === 1) return { label: 'Pay off now', color: 'var(--color-red)' }
  if (rank === 2) return { label: 'Primary target', color: 'var(--color-amber)' }
  return { label: 'Up next', color: 'var(--color-navy)' }
}

interface Props {
  debt: Debt
  rank: number
  onUpdate: (id: string, newBalance: number, isPaidOff: boolean) => void
}

export default function DebtCard({ debt, rank, onUpdate }: Props) {
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [applying, setApplying] = useState(false)
  const [appliedBreakdown, setAppliedBreakdown] = useState<{ interest: number; principal: number } | null>(null)

  const pctPaid = Math.round(
    ((debt.original_balance - debt.current_balance) / debt.original_balance) * 100
  )
  const monthlyInterest = (debt.current_balance * (debt.apr / 100)) / 12
  const totalPayment = debt.min_payment + debt.extra_payment
  const principalPaid = Math.max(0, totalPayment - monthlyInterest)
  const priority = getPriorityLabel(rank)

  async function handleUpdate() {
    const newBalance = parseFloat(input)
    if (isNaN(newBalance) || newBalance < 0) return
    setSaving(true)

    const isPaidOff = newBalance === 0
    const supabase = createClient()
    await supabase
      .from('debts')
      .update({
        current_balance: newBalance,
        is_paid_off: isPaidOff,
        updated_at: new Date().toISOString(),
      })
      .eq('id', debt.id)

    onUpdate(debt.id, newBalance, isPaidOff)
    setInput('')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleApplyPayment() {
    setApplying(true)
    const newBalance = Math.max(0, Math.round((debt.current_balance - principalPaid) * 100) / 100)
    const isPaidOff = newBalance === 0

    const supabase = createClient()
    await supabase
      .from('debts')
      .update({
        current_balance: newBalance,
        is_paid_off: isPaidOff,
        updated_at: new Date().toISOString(),
      })
      .eq('id', debt.id)

    onUpdate(debt.id, newBalance, isPaidOff)
    setApplying(false)
    setAppliedBreakdown({ interest: monthlyInterest, principal: principalPaid })
    setTimeout(() => setAppliedBreakdown(null), 4000)
  }

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>
            {debt.name}
          </h3>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: '#f5f5f3', color: 'var(--color-text-muted)' }}
          >
            {debt.apr_is_estimate ? '~' : ''}{debt.apr}% APR
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${priority.color}18`, color: priority.color }}
          >
            {priority.label}
          </span>
          {debt.payoff_target_date && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Target: {debt.payoff_target_date}
            </span>
          )}
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
          { label: 'To principal', value: formatCurrency(principalPaid) },
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

      {/* Apply payment feedback */}
      {appliedBreakdown && (
        <div
          className="rounded-lg px-3 py-2 text-xs flex gap-3"
          style={{ backgroundColor: '#f0faf5', color: 'var(--color-green)' }}
        >
          <span>Payment applied</span>
          <span style={{ color: 'var(--color-text-muted)' }}>
            {formatCurrency(appliedBreakdown.interest)} interest · {formatCurrency(appliedBreakdown.principal)} principal
          </span>
        </div>
      )}

      {/* Apply payment button */}
      <button
        onClick={handleApplyPayment}
        disabled={applying || totalPayment === 0}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50"
        style={{
          backgroundColor: '#eef4fb',
          color: 'var(--color-navy)',
        }}
      >
        {applying ? 'Applying…' : `Apply payment (${formatCurrency(totalPayment)})`}
      </button>

      {/* Manual balance update */}
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="Override balance"
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
          {saving ? '…' : saved ? 'Saved!' : 'Set'}
        </button>
      </div>
    </div>
  )
}
