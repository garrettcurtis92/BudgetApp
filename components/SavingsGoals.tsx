'use client'

import { useState } from 'react'
import GoalCard from './GoalCard'

interface Goal {
  id: string
  name: string
  description: string | null
  target_amount: number
  current_balance: number
  monthly_contribution: number
  color: string
  sort_order: number
}

export default function SavingsGoals({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = useState(initialGoals)

  function handleUpdate(id: string, newBalance: number) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, current_balance: newBalance } : g))
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      <h2
        className="text-2xl"
        style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-text)' }}
      >
        Savings &amp; Goals
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map(goal => (
          <GoalCard key={goal.id} goal={goal} onUpdate={handleUpdate} />
        ))}
      </div>
    </div>
  )
}
