'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'
import { Plus, X } from 'lucide-react'

interface IncomeEntry {
  id: string
  amount: number
  paid_on: string
  note: string | null
}

interface Props {
  initialEntries: IncomeEntry[]
  month: number
  year: number
  onEntriesChange?: (entries: IncomeEntry[]) => void
}

export default function IncomeWidget({ initialEntries, month, year, onEntriesChange }: Props) {
  const [entries, setEntries] = useState(initialEntries)

  function updateEntries(next: IncomeEntry[]) {
    setEntries(next)
    onEntriesChange?.(next)
  }
  const [adding, setAdding] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const total = entries.reduce((sum, e) => sum + Number(e.amount), 0)

  async function handleAdd() {
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0) return
    setSaving(true)
    const supabase = createClient()
    const today = new Date()
    const { data } = await supabase
      .from('income_log')
      .insert({ amount: val, paid_on: today.toISOString().split('T')[0], note: note || null })
      .select()
      .single()
    if (data) updateEntries([data, ...entries])
    setAmount('')
    setNote('')
    setAdding(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('income_log').delete().eq('id', id)
    updateEntries(entries.filter(e => e.id !== id))
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Income This Month
          </h3>
          <p className="text-2xl font-semibold mt-0.5" style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-green)' }}>
            {formatCurrency(total)}
          </p>
        </div>
        <button
          onClick={() => setAdding(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
          style={{ backgroundColor: '#eef4fb', color: 'var(--color-navy)' }}
        >
          <Plus size={14} />
          Log paycheck
        </button>
      </div>

      {adding && (
        <div className="px-5 pb-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex gap-2 pt-3">
            <input
              type="number"
              inputMode="decimal"
              placeholder="Amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              autoFocus
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: '1px solid var(--color-navy)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
            />
            <input
              type="text"
              placeholder="Note (optional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-navy)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
            />
            <button
              onClick={handleAdd}
              disabled={saving || !amount}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-green)' }}
            >
              {saving ? '…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className="flex items-center justify-between px-5 py-2.5"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDate(entry.paid_on)}
                </span>
                {entry.note && (
                  <span className="text-sm" style={{ color: 'var(--color-text)' }}>{entry.note}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium" style={{ color: 'var(--color-green)' }}>
                  +{formatCurrency(entry.amount)}
                </span>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-1 rounded cursor-pointer"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && !adding && (
        <div className="px-5 pb-4 text-sm" style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
          No paychecks logged yet this month.
        </div>
      )}
    </div>
  )
}
