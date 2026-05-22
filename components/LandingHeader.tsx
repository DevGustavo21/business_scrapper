'use client'

import Link from 'next/link'
import { ArrowRight, Building2 } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'

export function LandingHeader() {
  const user = useSupabaseUser()
  const showLogin = !user

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/60 bg-white/70 backdrop-blur-xl dark:border-white/5 dark:bg-[#06070a]/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_24px_rgba(99,102,241,0.5)] transition-transform group-hover:scale-105">
            <Building2 size={16} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Business Prospector
            </div>
            <div className="hidden text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:block dark:text-neutral-500">
              AI scraping suite
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {showLogin && (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-900/10 bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:translate-y-[-1px] hover:shadow-md dark:border-white/10 dark:bg-white dark:text-neutral-900"
            >
              Iniciar sesión
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
