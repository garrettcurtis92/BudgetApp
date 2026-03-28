import { createClient } from '@/lib/supabase-server'
import SavingsGoals from '@/components/SavingsGoals'

export default async function SavingsPage() {
  const supabase = await createClient()
  const { data: goals } = await supabase
    .from('savings_goals')
    .select('*')
    .order('sort_order')

  return <SavingsGoals initialGoals={goals ?? []} />
}
