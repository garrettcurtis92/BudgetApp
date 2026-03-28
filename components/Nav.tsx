'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { LayoutDashboard, CalendarDays, CreditCard, PiggyBank, Plus, LogOut } from 'lucide-react'

const tabs = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Budget', href: '/budget', icon: CalendarDays },
  { label: 'Debts', href: '/debts', icon: CreditCard },
  { label: 'Savings', href: '/savings', icon: PiggyBank },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [tapped, setTapped] = useState<string | null>(null)

  function handleTap(href: string) {
    setTapped(href)
    setTimeout(() => setTapped(null), 300)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <>
      {/* Desktop top nav */}
      <nav
        className="sticky top-0 z-40 hidden md:flex items-center justify-between px-6 h-14"
        style={{
          backgroundColor: 'var(--color-card)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* Wordmark */}
        <Link
          href="/dashboard"
          className="text-xl tracking-tight select-none"
          style={{ fontFamily: 'var(--font-dm-serif), serif', color: 'var(--color-text)' }}
        >
          Ledger
        </Link>

        {/* Tabs */}
        <div className="flex items-center gap-1">
          {tabs.map(({ label, href }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  color: active ? 'var(--color-navy)' : 'var(--color-text-muted)',
                  backgroundColor: active ? '#eef4fb' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f3'
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                }}
              >
                {label}
              </Link>
            )
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link
            href="/quick-add"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 cursor-pointer"
            style={{ backgroundColor: 'var(--color-navy)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.88')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
          >
            <Plus size={14} strokeWidth={2.5} />
            Quick Add
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg transition-all duration-200 cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#f5f5f3')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around px-2"
        style={{
          backgroundColor: 'var(--color-card)',
          borderTop: '1px solid var(--color-border)',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
          paddingTop: '8px',
        }}
      >
        {[...tabs, { label: 'Add', href: '/quick-add', icon: Plus }].map(({ label, href, icon: Icon }) => {
          const active = pathname === href
          const isTapped = tapped === href
          return (
            <Link
              key={href}
              href={href}
              onClick={() => handleTap(href)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl cursor-pointer"
              style={{
                color: active || isTapped ? 'var(--color-navy)' : 'var(--color-text-muted)',
                backgroundColor: isTapped ? '#eef4fb' : 'transparent',
                transform: isTapped ? 'scale(0.88)' : 'scale(1)',
                transition: 'transform 150ms ease, background-color 150ms ease, color 150ms ease',
              }}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
