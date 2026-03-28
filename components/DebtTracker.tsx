'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/formatters'
import DebtCard from './DebtCard'

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
  sort_order: number
}

const TIMELINE = [
  { name: 'Apple Card', date: 'April 2026' },
  { name: 'Alaska Airlines BofA', date: 'November 2027' },
  { name: 'Chase Southwest Card 1', date: 'February 2028' },
  { name: 'Chase Southwest Card 2', date: 'May 2028' },
  { name: 'Tesla Auto Loan', date: 'August 2028' },
]

export default function DebtTracker({ initialDebts }: { initialDebts: Debt[] }) {
  const [debts, setDebts] = useState(initialDebts)

  function handleUpdate(id: string, newBalance: number) {
    setDebts(prev =>
      prev.map(d => d.id === id ? { ...d, current_balance: newBalance } : d)
    )
  }

  const totalDebt = debts.reduce((sum, d) => sum + Number(d.current_balance), 0)
  const totalMonthlyInterest = debts.reduce(
    (sum, d) => sum + (Number(d.current_balance) * (Number(d.apr) / 100)) / 12, 0
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      <h2
        className="text-2xl"
        style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-text)' }}
      >
        Debt Tracker
      </h2>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Total Debt Remaining
          </p>
          <p
            className="text-2xl font-semibold mt-1"
            style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-red)' }}
          >
            {formatCurrency(totalDebt)}
          </p>
        </div>
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Est. Monthly Interest
          </p>
          <p
            className="text-2xl font-semibold mt-1"
            style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-amber)' }}
          >
            {formatCurrency(totalMonthlyInterest)}
          </p>
        </div>
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Debt-Free Target
          </p>
          <p
            className="text-2xl font-semibold mt-1"
            style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-green)' }}
          >
            August 2028
          </p>
        </div>
      </div>

      {/* Debt cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {debts.map(debt => (
          <DebtCard key={debt.id} debt={debt} onUpdate={handleUpdate} />
        ))}
      </div>

      {/* Payoff timeline */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
      >
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Payoff Timeline
        </h3>
        <div className="flex flex-col gap-3">
          {TIMELINE.map(({ name, date }, i) => (
            <div key={name} className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                style={{ backgroundColor: 'var(--color-navy)' }}
              >
                {i + 1}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {name}
                </span>
              </div>
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {date}
              </span>
            </div>
          ))}
        </div>
        <div
          className="mt-4 pt-4 text-sm font-medium text-center"
          style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-green)' }}
        >
          All non-mortgage debt gone by August 2028
        </div>
      </div>
    </div>
  )
}
