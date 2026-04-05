import { createClient } from '@/lib/supabase-server'
import MetricCard from '@/components/MetricCard'
import IncomeDashboardSection from '@/components/IncomeDashboardSection'
import ComingUpWidget from '@/components/ComingUpWidget'
import PayQueueWidget from '@/components/PayQueueWidget'
import { formatCurrency } from '@/lib/formatters'

const INCOME = {
  w2: 4297.00,
  va: 2802.30,
  hsa: 289.00,
  total: 7099.30,
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const [{ data: categories }, { data: actuals }, { data: debts }, { data: goals }, { data: incomeEntries }] =
    await Promise.all([
      supabase.from('budget_categories').select('*').eq('is_active', true),
      supabase.from('monthly_actuals').select('*').eq('month', month).eq('year', year),
      supabase.from('debts').select('*').eq('is_paid_off', false),
      supabase.from('savings_goals').select('*').order('sort_order'),
      supabase.from('income_log').select('*').gte('paid_on', monthStart).lt('paid_on', monthEnd).order('paid_on', { ascending: false }),
    ])

  const totalBudgeted = (categories ?? []).reduce(
    (sum: number, c: { budgeted_amount: number }) => sum + Number(c.budgeted_amount),
    0
  )
  const totalActual = (actuals ?? []).reduce(
    (sum: number, a: { actual_amount: number }) => sum + Number(a.actual_amount),
    0
  )

  const totalDebt = (debts ?? []).reduce(
    (sum: number, d: { current_balance: number }) => sum + Number(d.current_balance),
    0
  )

  const totalSavings401k = (goals ?? []).find((g: { name: string }) => g.name === '401k Balance')
  const emergencyFund = (goals ?? []).find((g: { name: string }) => g.name === 'Emergency Fund')
  const savingsContrib = 500 + 423.80
  const savingsRate = Math.round((savingsContrib / INCOME.total) * 100)

  const fixedGroups = ['Fixed Expenses', 'Insurance & Giving', 'Subscriptions']
  const fixedTotal = (categories ?? [])
    .filter((c: { group_name: string }) => fixedGroups.includes(c.group_name))
    .reduce((sum: number, c: { budgeted_amount: number }) => sum + Number(c.budgeted_amount), 0)

  const debtBudget = (categories ?? [])
    .filter((c: { group_name: string }) => c.group_name === 'Debts')
    .reduce((sum: number, c: { budgeted_amount: number }) => sum + Number(c.budgeted_amount), 0)

  const variableBudget = (categories ?? [])
    .filter((c: { group_name: string }) => c.group_name === 'Variable')
    .reduce((sum: number, c: { budgeted_amount: number }) => sum + Number(c.budgeted_amount), 0)

  const savingsBudget = (categories ?? [])
    .filter((c: { group_name: string }) => c.group_name === 'Savings')
    .reduce((sum: number, c: { budgeted_amount: number }) => sum + Number(c.budgeted_amount), 0)

  const netRemaining = INCOME.total - totalActual
  const receivedIncome = (incomeEntries ?? []).reduce((sum: number, e: { amount: number }) => sum + Number(e.amount), 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      <h2
        className="text-2xl"
        style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-text)' }}
      >
        Dashboard
      </h2>

      <IncomeDashboardSection
        initialEntries={incomeEntries ?? []}
        month={month}
        year={year}
        expectedTotal={INCOME.total}
        totalBudgeted={totalBudgeted}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Income Breakdown */}
        <div
          className="rounded-xl p-5 flex flex-col gap-3"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Income Breakdown
          </h3>
          <div className="flex flex-col gap-2">
            {[
              { label: 'W2 take-home (monthly avg)', value: INCOME.w2 },
              { label: 'VA disability', value: INCOME.va },
              { label: 'Employer HSA benefit', value: INCOME.hsa },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {formatCurrency(value)}
                </span>
              </div>
            ))}
            <div
              className="flex justify-between items-center pt-2 mt-1"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              <span className="text-sm font-semibold">Total</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-green)' }}>
                {formatCurrency(INCOME.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Expense Summary */}
        <div
          className="rounded-xl p-5 flex flex-col gap-3"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Expense Summary
          </h3>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Fixed bills', value: fixedTotal },
              { label: 'Debts (min + extra)', value: debtBudget },
              { label: 'Variable spending', value: variableBudget },
              { label: '401k + emergency savings', value: savingsBudget },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {formatCurrency(value)}
                </span>
              </div>
            ))}
            <div
              className="flex justify-between items-center pt-2 mt-1"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              <span className="text-sm font-semibold">Net remaining</span>
              <span
                className="text-sm font-semibold"
                style={{ color: netRemaining >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}
              >
                {formatCurrency(netRemaining)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ComingUpWidget categories={categories ?? []} today={now} />

      <PayQueueWidget
        categories={categories ?? []}
        initialActuals={actuals ?? []}
        initialDebts={debts ?? []}
        receivedIncome={receivedIncome}
        month={month}
        year={year}
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Savings Rate"
          value={`${savingsRate}%`}
          sublabel="401k + emergency fund"
          valueColor="var(--color-navy)"
        />
        <MetricCard
          label="Total Non-Mortgage Debt"
          value={formatCurrency(totalDebt)}
          sublabel="All tracked debts"
          valueColor="var(--color-red)"
        />
        <MetricCard
          label="Debt-Free Target"
          value="August 2028"
          sublabel="All non-mortgage debt"
          valueColor="var(--color-green)"
        />
      </div>
    </div>
  )
}
