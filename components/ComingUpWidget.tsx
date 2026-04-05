import { formatCurrency } from '@/lib/formatters'

interface Category {
  id: string
  name: string
  budgeted_amount: number
  due_day: number | null
  due_month: number | null
  frequency: string
  group_name: string
}

interface BillDue {
  category: Category
  daysUntil: number
  dueDay: number
}

function getBillsDueSoon(categories: Category[], today: Date): BillDue[] {
  const todayMonth = today.getMonth() + 1
  const todayYear = today.getFullYear()
  const todayMidnight = new Date(todayYear, today.getMonth(), today.getDate())

  return categories
    .filter(c => c.due_day)
    .filter(c => c.frequency === 'monthly' || (c.frequency === 'annual' && c.due_month === todayMonth))
    .map(c => {
      let dueDate = new Date(todayYear, today.getMonth(), c.due_day!)
      if (dueDate < todayMidnight) {
        dueDate = new Date(todayYear, today.getMonth() + 1, c.due_day!)
      }
      const daysUntil = Math.round((dueDate.getTime() - todayMidnight.getTime()) / 86400000)
      return { category: c, daysUntil, dueDay: c.due_day! }
    })
    .filter(b => b.daysUntil >= 0 && b.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}

function dueBadge(daysUntil: number): { label: string; color: string; bg: string } {
  if (daysUntil === 0) return { label: 'Today', color: 'var(--color-red)', bg: '#fef2f2' }
  if (daysUntil === 1) return { label: 'Tomorrow', color: 'var(--color-red)', bg: '#fef2f2' }
  if (daysUntil <= 3) return { label: `${daysUntil} days`, color: 'var(--color-amber)', bg: '#fffbeb' }
  return { label: `${daysUntil} days`, color: 'var(--color-text-muted)', bg: '#f5f5f3' }
}

export default function ComingUpWidget({ categories, today }: { categories: Category[], today: Date }) {
  const bills = getBillsDueSoon(categories, today)

  if (bills.length === 0) return null

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          Due in the next 7 days
        </h3>
      </div>
      <div>
        {bills.map(({ category, daysUntil }, i) => {
          const badge = dueBadge(daysUntil)
          return (
            <div
              key={category.id}
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ color: badge.color, backgroundColor: badge.bg }}
                >
                  {badge.label}
                </span>
                <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                  {category.name}
                </span>
                {category.frequency === 'annual' && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#f5f5f3', color: 'var(--color-text-muted)' }}>
                    Annual
                  </span>
                )}
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                {formatCurrency(category.budgeted_amount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
