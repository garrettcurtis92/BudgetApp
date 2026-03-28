import { createClient } from '@/lib/supabase-server'
import QuickAdd from '@/components/QuickAdd'

const QUICK_ADD_CATEGORIES = ['Groceries', 'Fuel', 'Dining Out', 'Discretionary / fun money', 'Blessing Fund']

export default async function QuickAddPage() {
  const supabase = await createClient()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [{ data: categories }, { data: actuals }, { data: rollovers }, { data: recentEntries }] =
    await Promise.all([
      supabase
        .from('budget_categories')
        .select('*')
        .in('name', QUICK_ADD_CATEGORIES)
        .eq('is_active', true),
      supabase
        .from('monthly_actuals')
        .select('*')
        .in('month', [month])
        .eq('year', year),
      supabase
        .from('rollovers')
        .select('*')
        .eq('month', month)
        .eq('year', year),
      supabase
        .from('entry_log')
        .select('*, budget_categories(name, group_name)')
        .eq('month', month)
        .eq('year', year)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  return (
    <QuickAdd
      categories={categories ?? []}
      actuals={actuals ?? []}
      rollovers={rollovers ?? []}
      recentEntries={recentEntries ?? []}
      month={month}
      year={year}
    />
  )
}
