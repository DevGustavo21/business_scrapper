'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Building2 } from 'lucide-react'

export function BrandLogo({ href = '/' }: { href?: '/' }) {
  const t = useTranslations('brand')
  return (
    <Link href={href} className="group flex items-center gap-2.5 min-w-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_24px_rgba(99,102,241,0.5)] transition-transform group-hover:scale-105">
        <Building2 size={16} className="text-white" />
      </div>
      <div className="leading-tight min-w-0">
        <div className="truncate text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Business Prospector
        </div>
        <div className="hidden text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:block dark:text-neutral-500">
          {t('tagline')}
        </div>
      </div>
    </Link>
  )
}
