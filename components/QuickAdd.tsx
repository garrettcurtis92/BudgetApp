'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingCart, Fuel, UtensilsCrossed, Star, X, Check } from 'lucide-react'
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
  icon: React.ReactNode
  accentColor: string
  displayName: string
}

const CARD_CONFIGS: CardConfig[] = [
  {
    name: 'Groceries',
    icon: <ShoppingCart size={28} strokeWidth={1.5} />,
    accentColor: 'var(--color-amber)',
    displayName: 'Groceries',
  },
  {
    name: 'Fuel',
    icon: <Fuel size={28} strokeWidth={1.5} />,
    accentColor: 'var(--color-navy)',
    displayName: 'Fuel',
  },
  {
    name: 'Dining Out',
    icon: <UtensilsCrossed size={28} strokeWidth={1.5} />,
    accentColor: 'var(--color-green)',
    displayName: 'Dining Out',
  },
  {
    name: 'Discretionary / fun money',
    icon: <Star size={28} strokeWidth={1.5} />,
    accentColor: 'var(--color-purple)',
    displayName: 'Discretionary',
  },
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
  const router = useRouter()
  const [actuals, setActuals] = useState(initialActuals)
  const [entries, setEntries] = useState(initialEntries)
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [panelVisible, setPanelVisible] = useState(false)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (panelVisible && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [panelVisible])

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

  function openPanel(cat: Category) {
    setActiveCategory(cat)
    setInputValue('')
    setPanelVisible(true)
  }

  function closePanel() {
    setPanelVisible(false)
    setActiveCategory(null)
    setInputValue('')
  }

  async function handleAdd() {
    if (!activeCategory || saving) return
    const amount = parseFloat(inputValue)
    if (isNaN(amount) || amount <= 0) return

    setSaving(true)
    const supabase = createClient()

    // Upsert monthly_actuals (add to existing)
    const existing = actuals.find(a => a.category_id === activeCategory.id)
    const newAmount = (existing?.actual_amount ?? 0) + amount

    await supabase
      .from('monthly_actuals')
      .upsert(
        { category_id: activeCategory.id, month, year, actual_amount: newAmount, updated_at: new Date().toISOString() },
        { onConflict: 'category_id,month,year' }
      )

    // Log to entry_log
    const { data: newEntry } = await supabase
      .from('entry_log')
      .insert({ category_id: activeCategory.id, amount, month, year })
      .select('*, budget_categories(name, group_name)')
      .single()

    // Update local state
    setActuals(prev => {
      const idx = prev.findIndex(a => a.category_id === activeCategory.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], actual_amount: newAmount }
        return updated
      }
      return [...prev, { id: '', category_id: activeCategory.id, month, year, actual_amount: newAmount }]
    })

    if (newEntry) {
      setEntries(prev => [newEntry, ...prev].slice(0, 5))
    }

    const catId = activeCategory.id
    setSaving(false)
    closePanel()
    setSuccessId(catId)
    setTimeout(() => setSuccessId(null), 1800)
  }

  async function handleUndo(entry: EntryLog) {
    const supabase = createClient()

    // Remove from entry_log
    await supabase.from('entry_log').delete().eq('id', entry.id)

    // Subtract from monthly_actuals, floor at 0
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
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) {
      return `Today ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-bg)', maxWidth: 480, margin: '0 auto' }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 h-14 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)' }}
      >
        <Link
          href="/dashboard"
          className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="text-center">
          <h1
            className="text-lg leading-none"
            style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-text)' }}
          >
            Ledger
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {formatMonthYear(month, year)}
          </p>
        </div>
        <div className="w-8" />
      </div>

      {/* Category cards */}
      <div className="flex-1 p-4 grid grid-cols-2 gap-3">
        {CARD_CONFIGS.map(config => {
          const cat = categories.find(c => c.name === config.name)
          if (!cat) return null

          const remaining = getRemaining(cat)
          const pct = getPctUsed(cat)
          const isOver = remaining < 0
          const isSuccess = successId === cat.id

          return (
            <button
              key={cat.id}
              onClick={() => openPanel(cat)}
              disabled={panelVisible}
              className="rounded-xl p-4 flex flex-col gap-3 text-left transition-all duration-200 cursor-pointer disabled:opacity-60 relative overflow-hidden"
              style={{
                backgroundColor: 'var(--color-card)',
                border: `1px solid ${isOver ? 'var(--color-red)' : isSuccess ? 'var(--color-green)' : 'var(--color-border)'}`,
                opacity: panelVisible && activeCategory?.id !== cat.id ? 0.5 : 1,
              }}
            >
              {/* Success overlay */}
              {isSuccess && (
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-xl"
                  style={{ backgroundColor: '#1a7a5218' }}
                >
                  <Check size={40} strokeWidth={2.5} style={{ color: 'var(--color-green)' }} />
                </div>
              )}

              <div style={{ color: config.accentColor }}>
                {config.icon}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  {config.displayName}
                </p>
                <p
                  className="text-lg font-semibold leading-tight"
                  style={{
                    fontFamily: 'var(--font-dm-serif), serif',
                    color: isOver ? 'var(--color-red)' : 'var(--color-text)',
                  }}
                >
                  {isOver ? `-${formatCurrency(Math.abs(remaining))}` : formatCurrency(remaining)}
                </p>
                <p className="text-xs" style={{ color: isOver ? 'var(--color-red)' : 'var(--color-text-muted)' }}>
                  {isOver ? 'over budget' : 'left'}
                </p>
              </div>

              {/* Progress bar */}
              <div
                className="h-1 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--color-border)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    backgroundColor: pct >= 100 ? 'var(--color-red)' : pct >= 90 ? 'var(--color-red)' : pct >= 70 ? 'var(--color-amber)' : config.accentColor,
                  }}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Recent entries */}
      {entries.length > 0 && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setHistoryOpen(p => !p)}
            className="w-full text-left text-xs font-medium py-2 flex justify-between items-center cursor-pointer transition-all duration-200"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Recent entries
            <span>{historyOpen ? '▲' : '▼'}</span>
          </button>
          {historyOpen && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--color-border)' }}
            >
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
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: config?.accentColor ?? 'var(--color-text-muted)' }}
                      />
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
                        className="p-1 rounded transition-all duration-200 cursor-pointer"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-red)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
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

      {/* PWA hint */}
      <p className="text-center text-xs py-3 px-4" style={{ color: 'var(--color-text-muted)' }}>
        Tap Share in Safari → Add to Home Screen
      </p>

      {/* Slide-up input panel */}
      {panelVisible && activeCategory && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
            onClick={closePanel}
          />

          {/* Panel */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl px-6 pt-6 pb-8"
            style={{
              backgroundColor: 'var(--color-card)',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
              maxWidth: 480,
              margin: '0 auto',
              animation: 'slideUp 200ms ease',
            }}
          >
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>

            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="text-lg font-semibold"
                  style={{ color: 'var(--color-text)' }}
                >
                  {CARD_CONFIGS.find(c => c.name === activeCategory.name)?.displayName ?? activeCategory.name}
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {formatCurrency(getRemaining(activeCategory))} remaining this month
                </p>
              </div>
              <button
                onClick={closePanel}
                className="p-2 rounded-lg cursor-pointer transition-all duration-200"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Amount display */}
            <div className="text-center my-6">
              <p
                className="text-5xl font-semibold"
                style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-text)' }}
              >
                ${inputValue || '0.00'}
              </p>
            </div>

            {/* Hidden input that triggers native keyboard */}
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="opacity-0 absolute h-0 w-0"
              aria-hidden="true"
            />

            {/* Visible input */}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="Enter amount"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="w-full text-center text-2xl rounded-xl px-4 py-4 outline-none transition-all duration-200 mb-4"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-dm-serif), serif',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-navy)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
              autoFocus
            />

            <button
              onClick={handleAdd}
              disabled={saving || !inputValue || parseFloat(inputValue) <= 0}
              className="w-full py-4 rounded-xl text-base font-semibold text-white transition-all duration-200 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-green)' }}
            >
              {saving ? 'Adding…' : 'Add'}
            </button>

            <button
              onClick={closePanel}
              className="w-full mt-3 text-sm cursor-pointer transition-all duration-200"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
