'use client'

import { useState } from 'react'
import IncomeWidget from './IncomeWidget'
import { formatCurrency } from '@/lib/formatters'

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
  expectedTotal: number
  totalBudgeted: number
}

export default function IncomeDashboardSection({ initialEntries, month, year, expectedTotal, totalBudgeted }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const received = entries.reduce((sum, e) => sum + Number(e.amount), 0)
  const remaining = received - totalBudgeted

  return (
    <div className="flex flex-col gap-4">
      {/* Live metric row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="rounded-xl p-5 flex flex-col gap-1"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Received This Month
          </p>
          <p className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-green)' }}>
            {formatCurrency(received)}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            of {formatCurrency(expectedTotal)} expected
          </p>
        </div>

        <div
          className="rounded-xl p-5 flex flex-col gap-1"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Total Budgeted
          </p>
          <p className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-text)' }}>
            {formatCurrency(totalBudgeted)}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bills + debt + savings</p>
        </div>

        <div
          className="rounded-xl p-5 flex flex-col gap-1"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Buffer (Received − Budgeted)
          </p>
          <p
            className="text-2xl font-semibold"
            style={{
              fontFamily: 'var(--font-dm-serif), serif',
              color: received === 0 ? 'var(--color-text-muted)' : remaining >= 0 ? 'var(--color-green)' : 'var(--color-red)',
            }}
          >
            {received === 0 ? '—' : formatCurrency(remaining)}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {received === 0 ? 'Log a paycheck to see buffer' : remaining >= 0 ? 'Available to allocate' : 'Shortfall so far'}
          </p>
        </div>
      </div>

      <IncomeWidget
        initialEntries={initialEntries}
        month={month}
        year={year}
        onEntriesChange={setEntries}
      />
    </div>
  )
}
