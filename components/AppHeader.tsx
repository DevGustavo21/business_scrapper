'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuthNav } from '@/components/AuthNav'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NotificationsPopover } from '@/components/NotificationsPopover'

const links = [
  { href: '/', label: 'Inicio' },
  { href: '/carpetas', label: 'Carpetas' },
  { href: '/agregar-prospectos', label: 'Agregar prospectos' },
  { href: '/clientes-prospectos', label: 'Clientes prospectos' },
]

export function AppHeader({
  showMobileHistoryTrigger,
  onOpenMobileHistory,
}: {
  showMobileHistoryTrigger?: boolean
  onOpenMobileHistory?: () => void
}) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-[--color-background]/80 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 min-h-14 flex flex-wrap items-center justify-between gap-y-2 py-2 sm:py-0 sm:h-14">
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
          {showMobileHistoryTrigger && (
            <button
              type="button"
              aria-label="Abrir historial de búsquedas"
              className="sm:hidden shrink-0 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={onOpenMobileHistory}
            >
              <Menu size={20} />
            </button>
          )}
          <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-700 transition-colors">
              <Building2 size={14} className="text-white" />
            </div>
            <span className="font-semibold text-sm sm:text-base tracking-tight text-neutral-900 dark:text-neutral-100 truncate">
              Business Prospector
            </span>
          </Link>
        </div>

        <nav className="order-3 sm:order-none w-full sm:w-auto flex items-center gap-0.5 sm:gap-1 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0 border-t border-neutral-100 dark:border-neutral-800/80 sm:border-0 pt-2 sm:pt-0">
          {links.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors',
                  active
                    ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/80',
                )}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NotificationsPopover />
          <AuthNav />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
