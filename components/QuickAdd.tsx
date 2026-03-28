'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, X, ShoppingCart, Fuel, UtensilsCrossed, Star, Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { formatCurrency, formatMonthYear } from '@/lib/formatters'

interface Category {
  id: string
  name: string
  budgeted_amount: number
  is_variable: boolean
}

interface Actual {
  id: string
  category_id: string
  month: number
  year: number
  actual_amount: number
}

interface Rollover {
  id: string
  category_id: string
  month: number
  year: number
  rollover_amount: number
}

interface EntryLog {
  id: string
  category_id: string
  amount: number
  month: number
  year: number
  created_at: string
  budget_categories: { name: string; group_name: string } | null
}

interface CardConfig {
  name: string
  displayName: string
  icon: React.ReactNode
  accentColor: string
}

const CARD_CONFIGS: CardConfig[] = [
  { name: 'Groceries', displayName: 'Groceries', icon: <ShoppingCart size={14} strokeWidth={2} />, accentColor: 'var(--color-amber)' },
  { name: 'Fuel', displayName: 'Fuel', icon: <Fuel size={14} strokeWidth={2} />, accentColor: 'var(--color-navy)' },
  { name: 'Dining Out', displayName: 'Dining', icon: <UtensilsCrossed size={14} strokeWidth={2} />, accentColor: 'var(--color-green)' },
  { name: 'Discretionary / fun money', displayName: 'Discretionary', icon: <Star size={14} strokeWidth={2} />, accentColor: 'var(--color-purple)' },
  { name: 'Blessing Fund', displayName: 'Blessing Fund', icon: <Heart size={14} strokeWidth={2} />, accentColor: 'var(--color-green)' },
]

interface Props {
  categories: Category[]
  actuals: Actual[]
  rollovers: Rollover[]
  recentEntries: EntryLog[]
  month: number
  year: number
}

export default function QuickAdd({ categories, actuals: initialActuals, rollovers, recentEntries: initialEntries, month, year }: Props) {
  const [actuals, setActuals] = useState(initialActuals)
  const [entries, setEntries] = useState(initialEntries)
  const [selected, setSelected] = useState<Category | null>(null)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selected) inputRef.current?.focus()
  }, [selected])

  function getRemaining(category: Category): number {
    const rollover = rollovers.find(r => r.category_id === category.id)
    const effective = Number(category.budgeted_amount) + (rollover?.rollover_amount ?? 0)
    const actual = actuals.find(a => a.category_id === category.id)
    return effective - (actual?.actual_amount ?? 0)
  }

  function getPctUsed(category: Category): number {
    const rollover = rollovers.find(r => r.category_id === category.id)
    const effective = Number(category.budgeted_amount) + (rollover?.rollover_amount ?? 0)
    if (effective === 0) return 0
    const actual = actuals.find(a => a.category_id === category.id)
    return ((actual?.actual_amount ?? 0) / effective) * 100
  }

  async function handleAdd() {
    if (!selected || saving) return
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0) return

    setSaving(true)
    const supabase = createClient()

    const existing = actuals.find(a => a.category_id === selected.id)
    const newAmount = (existing?.actual_amount ?? 0) + val

    await supabase
      .from('monthly_actuals')
      .upsert(
        { category_id: selected.id, month, year, actual_amount: newAmount, updated_at: new Date().toISOString() },
        { onConflict: 'category_id,month,year' }
      )

    const { data: newEntry } = await supabase
      .from('entry_log')
      .insert({ category_id: selected.id, amount: val, month, year })
      .select('*, budget_categories(name, group_name)')
      .single()

    setActuals(prev => {
      const idx = prev.findIndex(a => a.category_id === selected.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], actual_amount: newAmount }
        return updated
      }
      return [...prev, { id: '', category_id: selected.id, month, year, actual_amount: newAmount }]
    })

    if (newEntry) setEntries(prev => [newEntry, ...prev].slice(0, 5))

    const catId = selected.id
    setAmount('')
    setSaving(false)
    setSuccessId(catId)
    setTimeout(() => setSuccessId(null), 1800)
  }

  async function handleUndo(entry: EntryLog) {
    const supabase = createClient()
    await supabase.from('entry_log').delete().eq('id', entry.id)

    const current = actuals.find(a => a.category_id === entry.category_id)
    const newAmount = Math.max(0, (current?.actual_amount ?? 0) - entry.amount)

    await supabase
      .from('monthly_actuals')
      .upsert(
        { category_id: entry.category_id, month, year, actual_amount: newAmount, updated_at: new Date().toISOString() },
        { onConflict: 'category_id,month,year' }
      )

    setActuals(prev =>
      prev.map(a => a.category_id === entry.category_id ? { ...a, actual_amount: newAmount } : a)
    )
    setEntries(prev => prev.filter(e => e.id !== entry.id))
  }

  function formatEntryTime(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const selectedConfig = CARD_CONFIGS.find(c => c.name === selected?.name)

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)', maxWidth: 480, margin: '0 auto' }}>

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 h-14 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)' }}
      >
        <Link href="/dashboard" className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft size={20} />
        </Link>
        <div className="text-center">
          <h1 className="text-lg leading-none" style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-text)' }}>
            Quick Add
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{formatMonthYear(month, year)}</p>
        </div>
        <div className="w-8" />
      </div>

      <div className="flex-1 flex flex-col px-4 pt-6 gap-5">

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          {CARD_CONFIGS.map(config => {
            const cat = categories.find(c => c.name === config.name)
            if (!cat) return null
            const isSelected = selected?.id === cat.id
            const isSuccess = successId === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelected(isSelected ? null : cat)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: isSuccess
                    ? '#f0faf5'
                    : isSelected
                    ? `${config.accentColor}18`
                    : 'var(--color-card)',
                  color: isSuccess
                    ? 'var(--color-green)'
                    : isSelected
                    ? config.accentColor
                    : 'var(--color-text-muted)',
                  border: `1.5px solid ${isSuccess ? 'var(--color-green)' : isSelected ? config.accentColor : 'var(--color-border)'}`,
                }}
              >
                {config.icon}
                {config.displayName}
              </button>
            )
          })}
        </div>

        {/* Selected category info */}
        <div
          className="rounded-xl px-4 py-3 transition-all duration-200"
          style={{
            backgroundColor: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            opacity: selected ? 1 : 0.4,
          }}
        >
          {selected && selectedConfig ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {selectedConfig.displayName}
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: getRemaining(selected) < 0 ? 'var(--color-red)' : 'var(--color-green)' }}
                >
                  {formatCurrency(Math.abs(getRemaining(selected)))} {getRemaining(selected) < 0 ? 'over' : 'left'}
                </span>
              </div>
              <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, getPctUsed(selected))}%`,
                    backgroundColor: getPctUsed(selected) >= 90 ? 'var(--color-red)' : getPctUsed(selected) >= 70 ? 'var(--color-amber)' : selectedConfig.accentColor,
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
              Select a category above
            </p>
          )}
        </div>

        {/* Amount input */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            disabled={!selected}
            className="flex-1 rounded-xl px-4 py-4 text-2xl outline-none transition-all duration-200 disabled:opacity-40"
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-card)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-dm-serif), serif',
            }}
            onFocus={e => (e.target.style.borderColor = selectedConfig?.accentColor ?? 'var(--color-navy)')}
            onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
          />
          <button
            onClick={handleAdd}
            disabled={saving || !selected || !amount || parseFloat(amount) <= 0}
            className="px-5 rounded-xl text-base font-semibold text-white transition-all duration-200 cursor-pointer disabled:opacity-40"
            style={{ backgroundColor: selectedConfig?.accentColor ?? 'var(--color-navy)' }}
          >
            {saving ? '…' : 'Add'}
          </button>
        </div>

        {/* Recent entries */}
        {entries.length > 0 && (
          <div>
            <button
              onClick={() => setHistoryOpen(p => !p)}
              className="w-full text-left text-xs font-medium py-2 flex justify-between items-center cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Recent entries
              <span>{historyOpen ? '▲' : '▼'}</span>
            </button>
            {historyOpen && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                {entries.map((entry, i) => {
                  const config = CARD_CONFIGS.find(c => {
                    const cat = categories.find(x => x.id === entry.category_id)
                    return cat && c.name === cat.name
                  })
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between px-4 py-3"
                      style={{
                        backgroundColor: 'var(--color-card)',
                        borderBottom: i < entries.length - 1 ? '1px solid var(--color-border)' : 'none',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: config?.accentColor ?? 'var(--color-text-muted)' }} />
                        <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                          {entry.budget_categories?.name ?? 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {formatCurrency(entry.amount)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {formatEntryTime(entry.created_at)}
                        </span>
                        <button
                          onClick={() => handleUndo(entry)}
                          className="p-1 rounded cursor-pointer"
                          style={{ color: 'var(--color-text-muted)' }}
                          aria-label="Undo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs pb-4" style={{ color: 'var(--color-text-muted)' }}>
          Tap Share in Safari → Add to Home Screen
        </p>
      </div>
    </div>
  )
}
