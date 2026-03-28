'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'
import ProgressBar from './ProgressBar'

interface Goal {
  id: string
  name: string
  description: string | null
  target_amount: number
  current_balance: number
  monthly_contribution: number
  color: string
  sort_order: number
}

const COLOR_MAP: Record<string, string> = {
  amber: 'var(--color-amber)',
  blue: 'var(--color-navy)',
  green: 'var(--color-green)',
}

interface Props {
  goal: Goal
  onUpdate: (id: string, newBalance: number) => void
}

export default function GoalCard({ goal, onUpdate }: Props) {
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const pct = Math.round((goal.current_balance / goal.target_amount) * 100)
  const remaining = goal.target_amount - goal.current_balance
  const monthsLeft = goal.monthly_contribution > 0
    ? Math.ceil(remaining / goal.monthly_contribution)
    : null
  const color = COLOR_MAP[goal.color] ?? 'var(--color-navy)'

  async function handleUpdate() {
    const newBalance = parseFloat(input)
    if (isNaN(newBalance) || newBalance < 0) return
    setSaving(true)

    const supabase = createClient()
    await supabase
      .from('savings_goals')
      .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', goal.id)

    onUpdate(goal.id, newBalance)
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
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>
            {goal.name}
          </h3>
          {goal.description && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {goal.description}
            </p>
          )}
        </div>
        <span
          className="text-2xl font-semibold"
          style={{ fontFamily: 'var(--font-dm-serif), serif', color }}
        >
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <ProgressBar pct={pct} color={color} height={8} />

      {/* Balance */}
      <div className="flex justify-between items-end">
        <div>
          <p className="text-xl font-semibold" style={{ fontFamily: 'var(--font-dm-serif), serif', color }}>
            {formatCurrency(goal.current_balance)}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            of {formatCurrency(goal.target_amount)} goal
          </p>
        </div>
        <div className="text-right">
          {goal.monthly_contribution > 0 && (
            <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              {formatCurrency(goal.monthly_contribution)}/mo
            </p>
          )}
          {monthsLeft !== null && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              ~{monthsLeft} months to go
            </p>
          )}
        </div>
      </div>

      {/* Update balance */}
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="Update balance"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-all duration-200"
          style={{
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
          }}
          onFocus={e => (e.target.style.borderColor = color)}
          onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
          onKeyDown={e => e.key === 'Enter' && handleUpdate()}
        />
        <button
          onClick={handleUpdate}
          disabled={saving || !input}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200 cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: saved ? 'var(--color-green)' : color }}
        >
          {saving ? '…' : saved ? 'Saved!' : 'Update'}
        </button>
      </div>
    </div>
  )
}
