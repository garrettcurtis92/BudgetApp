import BudgetTable from '@/components/BudgetTable'
import { createClient } from '@/lib/supabase-server'

export default async function BudgetPage() {
  const supabase = await createClient()

  const [{ data: categories }, { data: actuals }, { data: rollovers }, { data: overrides }] = await Promise.all([
    supabase.from('budget_categories').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('monthly_actuals').select('*'),
    supabase.from('rollovers').select('*'),
    supabase.from('budget_overrides').select('*'),
  ])

  return (
    <BudgetTable
      initialCategories={categories ?? []}
      initialActuals={actuals ?? []}
      initialRollovers={rollovers ?? []}
      initialOverrides={overrides ?? []}
    />
  )
}
