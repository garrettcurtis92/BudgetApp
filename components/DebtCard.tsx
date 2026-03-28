'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'
import ProgressBar from './ProgressBar'
import { X } from 'lucide-react'

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

interface PaymentLog {
  id: string
  debt_id: string
  previous_balance: number
  new_balance: number
  created_at: string
}

function getPriorityLabel(rank: number): { label: string; color: string } {
  if (rank === 1) return { label: 'Pay off now', color: 'var(--color-red)' }
  if (rank === 2) return { label: 'Primary target', color: 'var(--color-amber)' }
  return { label: 'Up next', color: 'var(--color-navy)' }
}

interface Props {
  debt: Debt
  rank: number
  recentPayments: PaymentLog[]
  onUpdate: (id: string, newBalance: number, isPaidOff: boolean) => void
  onPaymentLogged: (entry: PaymentLog) => void
  onUndo: (entry: PaymentLog) => void
}

export default function DebtCard({ debt, rank, recentPayments, onUpdate, onPaymentLogged, onUndo }: Props) {
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [applying, setApplying] = useState(false)
  const [undoing, setUndoing] = useState<string | null>(null)

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
      .update({ current_balance: newBalance, is_paid_off: isPaidOff, updated_at: new Date().toISOString() })
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
    const previousBalance = debt.current_balance

    const supabase = createClient()
    const [, { data: logEntry }] = await Promise.all([
      supabase.from('debts').update({
        current_balance: newBalance,
        is_paid_off: isPaidOff,
        updated_at: new Date().toISOString(),
      }).eq('id', debt.id),
      supabase.from('debt_payment_log').insert({
        debt_id: debt.id,
        previous_balance: previousBalance,
        new_balance: newBalance,
      }).select().single(),
    ])

    onUpdate(debt.id, newBalance, isPaidOff)
    if (logEntry) onPaymentLogged(logEntry)
    setApplying(false)
  }

  async function handleUndo(entry: PaymentLog) {
    setUndoing(entry.id)
    const supabase = createClient()
    await Promise.all([
      supabase.from('debts').update({
        current_balance: entry.previous_balance,
        is_paid_off: false,
        updated_at: new Date().toISOString(),
      }).eq('id', debt.id),
      supabase.from('debt_payment_log').delete().eq('id', entry.id),
    ])
    onUndo(entry)
    setUndoing(null)
  }

  function formatTime(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
          <div key={label} className="rounded-lg p-3 text-center" style={{ backgroundColor: '#f5f5f3' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Apply payment button */}
      <button
        onClick={handleApplyPayment}
        disabled={applying || totalPayment === 0}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50"
        style={{ backgroundColor: '#eef4fb', color: 'var(--color-navy)' }}
      >
        {applying ? 'Applying…' : `Apply payment (${formatCurrency(totalPayment)})`}
      </button>

      {/* Payment history + undo */}
      {recentPayments.length > 0 && (
        <div className="flex flex-col gap-1">
          {recentPayments.map(entry => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
              style={{ backgroundColor: '#f5f5f3' }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>
                {formatCurrency(entry.previous_balance)} → {formatCurrency(entry.new_balance)}
              </span>
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--color-text-muted)' }}>{formatTime(entry.created_at)}</span>
                <button
                  onClick={() => handleUndo(entry)}
                  disabled={undoing === entry.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded font-medium cursor-pointer transition-all duration-200 disabled:opacity-50"
                  style={{ color: 'var(--color-red)', backgroundColor: '#fef2f2' }}
                >
                  <X size={11} />
                  {undoing === entry.id ? '…' : 'Undo'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual balance override */}
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
