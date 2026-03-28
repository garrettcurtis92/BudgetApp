import { createClient } from '@/lib/supabase-server'
import DebtTracker from '@/components/DebtTracker'

export default async function DebtsPage() {
  const supabase = await createClient()
  const { data: debts } = await supabase
    .from('debts')
    .select('*')
    .order('sort_order')

  return <DebtTracker initialDebts={debts ?? []} />
}
