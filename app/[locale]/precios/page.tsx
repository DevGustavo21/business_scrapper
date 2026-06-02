'use client'

import { useTranslations } from 'next-intl'
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  Clock,
  Crown,
  Download,
  History,
  Infinity as InfinityIcon,
  ListTodo,
  MessageSquare,
  ShieldBan,
  Sparkles,
  User,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { LandingHeader } from '@/components/LandingHeader'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/**
 * Página de precios pública. Sólo presentación: los pagos y el gating
 * real se conectarán más adelante (ver checkout/webhook en `app/api/stripe/*`).
 *
 * Los precios viven en `PLANS` como placeholders fáciles de cambiar.
 */

type PlanId = 'free' | 'pro' | 'premium'

type FeatureRow = {
  /** Clave i18n de la fila, relativa al namespace de su plan: `plans.${planId}.features.${key}` o `notIncluded.${key}`. */
  key: string
  /** Icono opcional para acentuar (solo features incluidas). */
  icon?: React.ComponentType<{ size?: number; className?: string }>
  /** Si la traducción incluye un sufijo "— hint", se inyecta como mensaje aparte (`*.${key}Hint`). */
  hintKey?: string
}

type Plan = {
  id: PlanId
  /** Precio en USD/mes (placeholder editable). Usa null para "Gratis". */
  monthlyUsd: number | null
  /** Si destacar como recomendado */
  featured?: boolean
  /** Icono lateral del plan. */
  icon: React.ComponentType<{ size?: number; className?: string }>
  /** Cosas que SÍ incluye este plan */
  features: FeatureRow[]
  /** Lo que NO incluye (se muestra atenuado para reforzar diferencia) */
  notIncluded?: FeatureRow[]
}

/**
 * Estructura de los planes (sin copy). El copy vive en `messages/{locale}.json`
 * bajo `pricing.plans.<id>.*`.
 */
const PLANS: Plan[] = [
  {
    id: 'free',
    monthlyUsd: 0,
    icon: Sparkles,
    features: [
      { key: 'weekly', icon: Zap },
      { key: 'monthly', icon: Zap },
      { key: 'limit', icon: Zap },
      { key: 'history', icon: History },
      { key: 'profile', icon: User },
    ],
    notIncluded: [
      { key: 'export' },
      { key: 'collab' },
      { key: 'blacklist' },
      { key: 'notifications' },
      { key: 'messaging' },
    ],
  },
  {
    id: 'pro',
    monthlyUsd: 19,
    featured: true,
    icon: Zap,
    features: [
      { key: 'weekly', icon: Zap },
      { key: 'monthly', icon: Zap },
      { key: 'limit', icon: Zap },
      { key: 'export', icon: Download },
      { key: 'invite', icon: UserPlus },
      { key: 'blacklist', icon: ShieldBan },
      { key: 'notifications', icon: Bell },
      { key: 'history', icon: History },
      { key: 'profile', icon: User },
    ],
    notIncluded: [
      { key: 'messaging' },
      { key: 'timeline' },
      { key: 'tasks' },
      { key: 'manual' },
    ],
  },
  {
    id: 'premium',
    monthlyUsd: 49,
    icon: Crown,
    features: [
      { key: 'unlimited', icon: InfinityIcon, hintKey: 'unlimitedHint' },
      { key: 'limit', icon: Zap },
      { key: 'proIncluded', icon: Check },
      { key: 'messaging', icon: MessageSquare },
      { key: 'timeline', icon: Clock },
      { key: 'tasks', icon: ListTodo },
      { key: 'manual', icon: UserPlus, hintKey: 'manualHint' },
    ],
  },
]

const FAQ_KEYS = ['card', 'switch', 'what', 'rollover', 'team', 'payments'] as const

const COMPARISON_ROW_KEYS = [
  'weekly',
  'monthly',
  'limit',
  'history',
  'profile',
  'export',
  'folders',
  'lists',
  'blacklist',
  'notifications',
  'messaging',
  'timeline',
  'tasks',
  'manual',
] as const

/**
 * Cuáles filas son numéricas (cada plan tiene su valor textual `pricing.comparison.values.*`)
 * y cuáles son booleanas (check vs raya).
 */
const COMPARISON_TABLE: Record<
  (typeof COMPARISON_ROW_KEYS)[number],
  | { kind: 'text'; freeKey: string; proKey: string; premiumKey: string }
  | { kind: 'bool'; free: boolean; pro: boolean; premium: boolean }
> = {
  weekly: { kind: 'text', freeKey: 'freeWeekly', proKey: 'proWeekly', premiumKey: 'premiumWeekly' },
  monthly: { kind: 'text', freeKey: 'freeMonthly', proKey: 'proMonthly', premiumKey: 'premiumMonthly' },
  limit: { kind: 'text', freeKey: 'freeLimit', proKey: 'proLimit', premiumKey: 'premiumLimit' },
  history: { kind: 'bool', free: true, pro: true, premium: true },
  profile: { kind: 'bool', free: true, pro: true, premium: true },
  export: { kind: 'bool', free: false, pro: true, premium: true },
  folders: { kind: 'bool', free: false, pro: true, premium: true },
  lists: { kind: 'bool', free: false, pro: true, premium: true },
  blacklist: { kind: 'bool', free: false, pro: true, premium: true },
  notifications: { kind: 'bool', free: false, pro: true, premium: true },
  messaging: { kind: 'bool', free: false, pro: false, premium: true },
  timeline: { kind: 'bool', free: false, pro: false, premium: true },
  tasks: { kind: 'bool', free: false, pro: false, premium: true },
  manual: { kind: 'bool', free: false, pro: false, premium: true },
}

export default function PreciosPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-neutral-50 text-neutral-900 dark:bg-[#06070a] dark:text-neutral-100 selection:bg-indigo-500/30 selection:text-neutral-900 dark:selection:text-white">
      <BackgroundGlow />
      <LandingHeader />

      <main className="relative">
        <PricingHero />
        <PricingCards />
        <ComparisonTable />
        <FAQ />
        <FinalCTA />
      </main>

      <PricingFooter />
    </div>
  )
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] overflow-hidden">
      <div className="absolute left-1/2 top-[-220px] h-[760px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.14),transparent_70%)] dark:bg-[radial-gradient(closest-side,rgba(99,102,241,0.2),transparent_70%)]" />
    </div>
  )
}

function PricingHero() {
  const t = useTranslations('pricing.hero')
  return (
    <section className="relative isolate overflow-hidden px-4 pt-20 pb-12 sm:px-6 sm:pt-28 sm:pb-16">
      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white/60 px-3.5 py-1.5 text-xs font-medium text-neutral-600 backdrop-blur dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-300">
          <Sparkles size={12} className="text-indigo-500" />
          {t('badge')}
        </span>

        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-neutral-900 sm:text-6xl md:text-7xl dark:text-neutral-50">
          {t('titleLead')}{' '}
          <span className="bg-gradient-to-r from-white via-violet-400 to-violet-600 bg-clip-text italic text-transparent">
            {t('titleAccent')}
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-base text-neutral-600 sm:text-lg dark:text-neutral-400">
          {t('subtitle')}
        </p>

        <p className="mt-5 text-xs text-neutral-500 dark:text-neutral-500">{t('disclaimer')}</p>
      </div>
    </section>
  )
}

function PricingCards() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3 md:items-stretch">
        {PLANS.map(plan => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </section>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  const tPlan = useTranslations(`pricing.plans.${plan.id}`)
  const tCommon = useTranslations('common')
  const tShared = useTranslations('pricing')
  const PlanIcon = plan.icon
  const isFree = plan.monthlyUsd === 0 || plan.monthlyUsd === null
  const featured = Boolean(plan.featured)
  /** Sólo `free` y `premium` tienen badge corto bajo el nombre del plan. `pro` usa el badge "destacado". */
  const hasInlineBadge = plan.id === 'free' || plan.id === 'premium'
  const featuredBadge = featured ? tShared('featuredBadge') : null

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-3xl border p-8 transition-all',
        featured
          ? 'border-indigo-500/60 bg-white shadow-2xl shadow-indigo-500/10 ring-1 ring-indigo-500/40 md:scale-[1.02] dark:bg-white/[0.04]'
          : 'border-neutral-200/80 bg-white hover:border-neutral-300 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/[0.15]',
      )}
    >
      {featuredBadge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-md shadow-indigo-600/20">
            <Sparkles size={11} />
            {featuredBadge}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            featured
              ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
              : 'bg-neutral-100 text-neutral-700 dark:bg-white/[0.06] dark:text-neutral-200',
          )}
        >
          <PlanIcon size={18} />
        </div>
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {tPlan('name')}
          </h3>
          {hasInlineBadge && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {tPlan('badge')}
            </span>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{tPlan('pitch')}</p>

      <div className="mt-7 flex items-end gap-2">
        {isFree ? (
          <span className="text-5xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {tCommon('free')}
          </span>
        ) : (
          <>
            <span className="text-5xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              ${plan.monthlyUsd}
            </span>
            <span className="pb-2 text-sm text-neutral-500 dark:text-neutral-400">{tCommon('perMonthUsd')}</span>
          </>
        )}
      </div>
      {isFree && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">{tCommon('foreverFree')}</p>
      )}

      <Link
        href="/login"
        className={cn(
          'group mt-7 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all',
          featured
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:translate-y-[-1px] hover:bg-indigo-500'
            : 'border border-neutral-900/10 bg-neutral-900 text-white hover:translate-y-[-1px] hover:bg-neutral-800 dark:border-white/10 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200',
        )}
      >
        {tPlan('ctaLabel')}
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </Link>

      <div className="mt-8 h-px w-full bg-neutral-200/80 dark:bg-white/[0.06]" />

      <ul className="mt-6 flex flex-col gap-3">
        {plan.features.map(f => (
          <FeatureItem key={f.key} planId={plan.id} feature={f} variant="included" />
        ))}
        {plan.notIncluded?.map(f => (
          <FeatureItem key={f.key} planId={plan.id} feature={f} variant="excluded" />
        ))}
      </ul>
    </div>
  )
}

function FeatureItem({
  planId,
  feature,
  variant,
}: {
  planId: PlanId
  feature: FeatureRow
  variant: 'included' | 'excluded'
}) {
  const Icon = feature.icon ?? Check
  const tFeatures = useTranslations(
    variant === 'included' ? `pricing.plans.${planId}.features` : `pricing.plans.${planId}.notIncluded`,
  )
  const label = tFeatures(feature.key)
  const hint = feature.hintKey ? tFeatures(feature.hintKey) : null

  if (variant === 'excluded') {
    return (
      <li className="flex items-start gap-2.5 text-sm text-neutral-400 line-through decoration-neutral-300/70 dark:text-neutral-600 dark:decoration-white/10">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-200/60 dark:bg-white/[0.04]">
          <span className="h-px w-1.5 bg-neutral-400 dark:bg-neutral-600" />
        </span>
        <span className="leading-snug">{label}</span>
      </li>
    )
  }
  return (
    <li className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-200">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
        <Icon size={11} />
      </span>
      <span className="leading-snug">
        {label}
        {hint && <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-500">— {hint}</span>}
      </span>
    </li>
  )
}

function ComparisonTable() {
  const t = useTranslations('pricing.comparison')
  const tValues = useTranslations('pricing.comparison.values')
  const tPlans = useTranslations('pricing.plans')

  return (
    <section
      id="comparativa"
      className="border-t border-neutral-200/70 px-4 py-20 sm:px-6 sm:py-24 dark:border-white/[0.06]"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            <span className="h-px w-6 bg-indigo-500/60" />
            {t('eyebrow')}
          </div>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
            {t('title')}
          </h2>
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">{t('subtitle')}</p>
        </div>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200/80 text-left dark:border-white/[0.06]">
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {t('featureHeader')}
                </th>
                {PLANS.map(plan => (
                  <th
                    key={plan.id}
                    className={cn(
                      'px-5 py-4 text-center text-sm font-semibold',
                      plan.featured
                        ? 'text-indigo-700 dark:text-indigo-300'
                        : 'text-neutral-900 dark:text-neutral-100',
                    )}
                  >
                    {tPlans(`${plan.id}.name`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROW_KEYS.map((rowKey, i) => {
                const cfg = COMPARISON_TABLE[rowKey]
                return (
                  <tr
                    key={rowKey}
                    className={cn(
                      'border-b border-neutral-100 last:border-0 dark:border-white/[0.04]',
                      i % 2 === 1 && 'bg-neutral-50/60 dark:bg-white/[0.015]',
                    )}
                  >
                    <td className="px-5 py-3.5 text-neutral-700 dark:text-neutral-200">
                      {t(`rows.${rowKey}`)}
                    </td>
                    {PLANS.map(plan => {
                      const value =
                        cfg.kind === 'text'
                          ? tValues(
                              plan.id === 'free' ? cfg.freeKey : plan.id === 'pro' ? cfg.proKey : cfg.premiumKey,
                            )
                          : plan.id === 'free'
                            ? cfg.free
                            : plan.id === 'pro'
                              ? cfg.pro
                              : cfg.premium
                      return (
                        <td
                          key={plan.id}
                          className={cn(
                            'px-5 py-3.5 text-center',
                            plan.featured && 'bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06]',
                          )}
                        >
                          <CellValue value={value} />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
        <Check size={14} />
      </span>
    )
  }
  if (value === false) {
    return <span className="inline-block text-neutral-300 dark:text-neutral-700">—</span>
  }
  return (
    <span className="inline-flex items-center justify-center text-sm font-semibold text-neutral-900 dark:text-neutral-100">
      {value}
    </span>
  )
}

function FAQ() {
  const t = useTranslations('pricing.faq')
  return (
    <section className="border-t border-neutral-200/70 px-4 py-20 sm:px-6 sm:py-24 dark:border-white/[0.06]">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            <span className="h-px w-6 bg-indigo-500/60" />
            {t('eyebrow')}
          </div>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
            {t('title')}
          </h2>
        </div>

        <div className="mt-12 grid gap-3">
          {FAQ_KEYS.map(key => (
            <details
              key={key}
              className="group rounded-2xl border border-neutral-200/80 bg-white p-5 transition-colors hover:border-neutral-300 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/[0.15]"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-neutral-900 list-none dark:text-neutral-100 [&::-webkit-details-marker]:hidden">
                {t(`items.${key}.q`)}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-transform group-open:rotate-45 dark:bg-white/[0.06] dark:text-neutral-300">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {t(`items.${key}.a`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  const t = useTranslations('pricing.finalCta')
  return (
    <section className="border-t border-neutral-200/70 px-4 py-24 sm:px-6 dark:border-white/[0.06]">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-neutral-900/10 bg-neutral-900 px-6 py-14 text-center text-white shadow-2xl shadow-neutral-900/20 sm:px-12 sm:py-20 dark:border-white/10 dark:bg-gradient-to-br dark:from-[#0c0d12] dark:to-[#15161c]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.25),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300">
          <Users size={12} />
          {t('badge')}
        </span>
        <h2 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {t('titleLead')}{' '}
          <span className="bg-gradient-to-r from-white via-violet-400 to-violet-600 bg-clip-text italic text-transparent">
            {t('titleAccent')}
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-neutral-400 sm:text-base">{t('subtitle')}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-neutral-900 transition-all hover:translate-y-[-1px] hover:shadow-lg"
          >
            {t('ctaPrimary')}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-neutral-200 transition-colors hover:bg-white/10"
          >
            {t('ctaSecondary')}
          </Link>
        </div>
      </div>
    </section>
  )
}

function PricingFooter() {
  const t = useTranslations('pricing')
  const tFooter = useTranslations('footer')
  return (
    <footer className="border-t border-neutral-200/70 px-4 py-10 sm:px-6 dark:border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Building2 size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Business Prospector</span>
        </div>
        <p className="text-center text-xs text-neutral-500 dark:text-neutral-500">
          {t('footerNote', { year: new Date().getFullYear() })}
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
        >
          {tFooter('login')} <ArrowUpRight size={12} />
        </Link>
      </div>
    </footer>
  )
}
