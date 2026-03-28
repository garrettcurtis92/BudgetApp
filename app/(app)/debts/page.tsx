import { createClient } from '@/lib/supabase-server'
import DebtTracker from '@/components/DebtTracker'

export default async function DebtsPage() {
  const supabase = await createClient()
  const [{ data: debts }, { data: paymentLog }] = await Promise.all([
    supabase.from('debts').select('*').order('sort_order'),
    supabase.from('debt_payment_log').select('*').order('created_at', { ascending: false }).limit(20),
  ])

  return <DebtTracker initialDebts={debts ?? []} initialPaymentLog={paymentLog ?? []} />
}
