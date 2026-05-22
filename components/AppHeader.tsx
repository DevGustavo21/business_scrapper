'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Clock, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuthNav } from '@/components/AuthNav'
import { BrandLogo } from '@/components/BrandLogo'
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileNavOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileNavOpen])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-[--color-background]/95 backdrop-blur-md">
        <HeaderInner
          showMobileHistoryTrigger={showMobileHistoryTrigger}
          onOpenMobileHistory={onOpenMobileHistory}
          mobileNavOpen={mobileNavOpen}
          setMobileNavOpen={setMobileNavOpen}
          isActive={isActive}
        />
      </header>

      {mobileNavOpen && <MobileNavDrawer onClose={() => setMobileNavOpen(false)} isActive={isActive} />}
    </>
  )
}

function HeaderInner({
  showMobileHistoryTrigger,
  onOpenMobileHistory,
  mobileNavOpen,
  setMobileNavOpen,
  isActive,
}: {
  showMobileHistoryTrigger?: boolean
  onOpenMobileHistory?: () => void
  mobileNavOpen: boolean
  setMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>
  isActive: (href: string) => boolean
}) {
  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          aria-label={mobileNavOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
          aria-expanded={mobileNavOpen}
          className="sm:hidden shrink-0 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          onClick={() => setMobileNavOpen(v => !v)}
        >
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <BrandLogo />
      </div>

      <nav className="hidden sm:flex items-center gap-0.5" aria-label="Principal">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/80',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {showMobileHistoryTrigger && (
          <button
            type="button"
            aria-label="Abrir historial de búsquedas"
            title="Historial de búsquedas"
            className="sm:hidden shrink-0 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-indigo-600 dark:hover:text-indigo-400"
            onClick={onOpenMobileHistory}
          >
            <Clock size={20} />
          </button>
        )}
        <NotificationsPopover />
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <AuthNav />
      </div>
    </div>
  )
}

function MobileNavDrawer({
  onClose,
  isActive,
}: {
  onClose: () => void
  isActive: (href: string) => boolean
}) {
  return (
    <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" aria-label="Cerrar menú" onClick={onClose} />
      <nav className="absolute top-0 left-0 bottom-0 w-[min(88vw,300px)] bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Menú</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={onClose}
                className={cn(
                  'block rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                  isActive(href)
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <span className="text-xs text-neutral-500">Tema</span>
          <ThemeToggle />
        </div>
      </nav>
    </div>
  )
}
