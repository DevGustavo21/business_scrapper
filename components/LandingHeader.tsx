'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'

export function LandingHeader() {
  const user = useSupabaseUser()
  const showLogin = !user

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/60 bg-white/70 backdrop-blur-xl dark:border-white/5 dark:bg-[#06070a]/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandLogo />

        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/precios"
            className="hidden text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 sm:inline-flex dark:text-neutral-300 dark:hover:text-white"
          >
            Precios
          </Link>
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
