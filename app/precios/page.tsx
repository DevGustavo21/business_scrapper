'use client'

import Link from 'next/link'
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
import { cn } from '@/lib/utils'

/**
 * Página de precios pública. Sólo presentación: los pagos y el gating
 * real se conectarán más adelante (ver checkout/webhook en `app/api/stripe/*`).
 *
 * Los precios viven en `PLANS` como placeholders fáciles de cambiar.
 */

type PlanId = 'free' | 'pro' | 'premium'

type FeatureRow = {
  /** Texto corto de la fila */
  label: string
  /** Icono opcional para acentuar */
  icon?: React.ComponentType<{ size?: number; className?: string }>
  /** Nota inline (no negrita) */
  hint?: string
}

type Plan = {
  id: PlanId
  name: string
  /** Resumen breve mostrado bajo el nombre */
  pitch: string
  /** Precio en USD/mes (placeholder editable). Usa null para "Gratis". */
  monthlyUsd: number | null
  /** Tagline del CTA */
  ctaLabel: string
  /** Si destacar como recomendado */
  featured?: boolean
  /** Frase de acento sobre el precio (p. ej. "Para empezar") */
  badge?: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  /** Cosas que SÍ incluye este plan */
  features: FeatureRow[]
  /** Lo que NO incluye (se muestra atenuado para reforzar diferencia) */
  notIncluded?: FeatureRow[]
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Gratis',
    pitch: 'Para probar el motor de prospección sin compromiso.',
    monthlyUsd: 0,
    ctaLabel: 'Empezar gratis',
    badge: 'Para empezar',
    icon: Sparkles,
    features: [
      { label: '5 búsquedas por semana', icon: Zap },
      { label: '20 búsquedas al mes', icon: Zap },
      { label: 'Hasta 24 resultados por búsqueda', icon: Zap },
      { label: 'Historial guardado de tus búsquedas', icon: History },
      { label: 'Perfil personalizable', icon: User },
    ],
    notIncluded: [
      { label: 'Exportar a Excel' },
      { label: 'Carpetas y listas compartidas con tu equipo' },
      { label: 'Lista negra de negocios' },
      { label: 'Notificaciones de colaboración' },
      { label: 'Mensajería, cronología y tareas' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    pitch: 'Para freelancers y equipos pequeños que prospectan en serio.',
    monthlyUsd: 19,
    ctaLabel: 'Probar Pro',
    featured: true,
    badge: 'Más popular',
    icon: Zap,
    features: [
      { label: '50 búsquedas por semana', icon: Zap },
      { label: '200 búsquedas al mes', icon: Zap },
      { label: 'Hasta 48 resultados por búsqueda', icon: Zap },
      { label: 'Exportar a Excel', icon: Download },
      { label: 'Invita miembros a carpetas y listas', icon: UserPlus },
      { label: 'Lista negra para excluir negocios', icon: ShieldBan },
      { label: 'Notificaciones de colaboración', icon: Bell },
      { label: 'Historial guardado de tus búsquedas', icon: History },
      { label: 'Perfil personalizable', icon: User },
    ],
    notIncluded: [
      { label: 'Mensajería interna por prospecto' },
      { label: 'Cronología de actividad' },
      { label: 'Tareas asignadas al equipo' },
      { label: 'Carga manual de prospectos' },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    pitch: 'Para equipos que cierran cuentas y trabajan el pipeline completo.',
    monthlyUsd: 49,
    ctaLabel: 'Probar Premium',
    badge: 'Para escalar',
    icon: Crown,
    features: [
      { label: 'Búsquedas ilimitadas', icon: InfinityIcon, hint: 'sin tope mensual ni semanal' },
      { label: 'Hasta 100 resultados por búsqueda', icon: Zap },
      { label: 'Todo lo del plan Pro', icon: Check },
      { label: 'Mensajería interna por prospecto', icon: MessageSquare },
      { label: 'Cronología de actividad', icon: Clock },
      { label: 'Tareas asignadas al equipo', icon: ListTodo },
      { label: 'Carga manual de prospectos', icon: UserPlus, hint: 'desde /agregar-prospectos' },
    ],
  },
]

const FAQS: { q: string; a: string }[] = [
  {
    q: '¿Necesito tarjeta para el plan Gratis?',
    a: 'No. Inicias sesión con Google y empiezas a usar Business Prospector con 5 búsquedas semanales sin introducir ningún dato de pago.',
  },
  {
    q: '¿Puedo cambiar de plan o cancelar cuando quiera?',
    a: 'Sí. Puedes subir, bajar o cancelar tu suscripción en cualquier momento desde tu panel de facturación. Mantienes el acceso hasta el final del período pagado.',
  },
  {
    q: '¿Qué cuenta como “una búsqueda”?',
    a: 'Cada vez que lanzas el botón de Buscar con un par categoría + ubicación se descuenta una búsqueda, sin importar cuántos resultados devuelva.',
  },
  {
    q: '¿Las búsquedas no usadas se acumulan?',
    a: 'No. El conteo semanal y mensual se reinicia automáticamente; las búsquedas no consumidas no pasan al siguiente período.',
  },
  {
    q: '¿Los planes Pro y Premium soportan equipo?',
    a: 'Sí. Desde Pro puedes invitar miembros a carpetas y listas compartidas. Premium añade mensajería interna, tareas y cronología para coordinar el trabajo.',
  },
  {
    q: '¿Qué métodos de pago aceptan?',
    a: 'Estamos finalizando la integración de pagos. Cuando se active, aceptaremos tarjetas internacionales y los principales métodos locales de cada región.',
  },
]

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
  return (
    <section className="relative isolate overflow-hidden px-4 pt-20 pb-12 sm:px-6 sm:pt-28 sm:pb-16">
      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white/60 px-3.5 py-1.5 text-xs font-medium text-neutral-600 backdrop-blur dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-300">
          <Sparkles size={12} className="text-indigo-500" />
          Planes y precios
        </span>

        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-neutral-900 sm:text-6xl md:text-7xl dark:text-neutral-50">
          Elige el plan que{' '}
          <span className="bg-gradient-to-r from-white via-violet-400 to-violet-600 bg-clip-text italic text-transparent">
            mueve tu pipeline
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-pretty text-base text-neutral-600 sm:text-lg dark:text-neutral-400">
          Empieza gratis y sube cuando quieras desbloquear exportaciones, colaboración y herramientas
          de equipo. Sin permanencia, sin sorpresas.
        </p>

        <p className="mt-5 text-xs text-neutral-500 dark:text-neutral-500">
          Precios en USD · Facturación mensual · IVA / impuestos calculados al pagar
        </p>
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
  const PlanIcon = plan.icon
  const isFree = plan.monthlyUsd === 0 || plan.monthlyUsd === null
  const featured = Boolean(plan.featured)

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-3xl border p-8 transition-all',
        featured
          ? 'border-indigo-500/60 bg-white shadow-2xl shadow-indigo-500/10 ring-1 ring-indigo-500/40 md:scale-[1.02] dark:bg-white/[0.04]'
          : 'border-neutral-200/80 bg-white hover:border-neutral-300 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/[0.15]',
      )}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-md shadow-indigo-600/20">
            <Sparkles size={11} />
            {plan.badge ?? 'Recomendado'}
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
            {plan.name}
          </h3>
          {plan.badge && !featured && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {plan.badge}
            </span>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{plan.pitch}</p>

      <div className="mt-7 flex items-end gap-2">
        {isFree ? (
          <span className="text-5xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">$0</span>
        ) : (
          <>
            <span className="text-5xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              ${plan.monthlyUsd}
            </span>
            <span className="pb-2 text-sm text-neutral-500 dark:text-neutral-400">USD / mes</span>
          </>
        )}
      </div>
      {isFree && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">Para siempre · Sin tarjeta</p>
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
        {plan.ctaLabel}
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </Link>

      <div className="mt-8 h-px w-full bg-neutral-200/80 dark:bg-white/[0.06]" />

      <ul className="mt-6 flex flex-col gap-3">
        {plan.features.map(f => (
          <FeatureItem key={f.label} feature={f} variant="included" />
        ))}
        {plan.notIncluded?.map(f => (
          <FeatureItem key={f.label} feature={f} variant="excluded" />
        ))}
      </ul>
    </div>
  )
}

function FeatureItem({ feature, variant }: { feature: FeatureRow; variant: 'included' | 'excluded' }) {
  const Icon = feature.icon ?? Check
  if (variant === 'excluded') {
    return (
      <li className="flex items-start gap-2.5 text-sm text-neutral-400 line-through decoration-neutral-300/70 dark:text-neutral-600 dark:decoration-white/10">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-200/60 dark:bg-white/[0.04]">
          <span className="h-px w-1.5 bg-neutral-400 dark:bg-neutral-600" />
        </span>
        <span className="leading-snug">{feature.label}</span>
      </li>
    )
  }
  return (
    <li className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-200">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
        <Icon size={11} />
      </span>
      <span className="leading-snug">
        {feature.label}
        {feature.hint && (
          <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-500">— {feature.hint}</span>
        )}
      </span>
    </li>
  )
}

function ComparisonTable() {
  const rows: { label: string; values: [string | boolean, string | boolean, string | boolean] }[] = [
    { label: 'Búsquedas por semana', values: ['5', '50', 'Ilimitadas'] },
    { label: 'Búsquedas por mes', values: ['20', '200', 'Ilimitadas'] },
    { label: 'Resultados por búsqueda', values: ['Hasta 24', 'Hasta 48', 'Hasta 100'] },
    { label: 'Historial de búsquedas', values: [true, true, true] },
    { label: 'Perfil personalizable', values: [true, true, true] },
    { label: 'Exportar a Excel', values: [false, true, true] },
    { label: 'Carpetas compartidas', values: [false, true, true] },
    { label: 'Listas de prospectos compartidas', values: [false, true, true] },
    { label: 'Lista negra de negocios', values: [false, true, true] },
    { label: 'Notificaciones de colaboración', values: [false, true, true] },
    { label: 'Mensajería interna por prospecto', values: [false, false, true] },
    { label: 'Cronología de actividad', values: [false, false, true] },
    { label: 'Tareas asignadas al equipo', values: [false, false, true] },
    { label: 'Agregar prospectos manualmente', values: [false, false, true] },
  ]

  return (
    <section
      id="comparativa"
      className="border-t border-neutral-200/70 px-4 py-20 sm:px-6 sm:py-24 dark:border-white/[0.06]"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            <span className="h-px w-6 bg-indigo-500/60" />
            Comparativa
          </div>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
            Todo lo que incluye cada plan
          </h2>
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            Compara funcionalidades de un vistazo y elige el plan que necesitas hoy. Puedes mejorarlo
            cuando crezca tu equipo.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200/80 text-left dark:border-white/[0.06]">
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Funcionalidad
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
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.label}
                  className={cn(
                    'border-b border-neutral-100 last:border-0 dark:border-white/[0.04]',
                    i % 2 === 1 && 'bg-neutral-50/60 dark:bg-white/[0.015]',
                  )}
                >
                  <td className="px-5 py-3.5 text-neutral-700 dark:text-neutral-200">{row.label}</td>
                  {row.values.map((v, idx) => (
                    <td
                      key={idx}
                      className={cn(
                        'px-5 py-3.5 text-center',
                        PLANS[idx].featured && 'bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06]',
                      )}
                    >
                      <CellValue value={v} />
                    </td>
                  ))}
                </tr>
              ))}
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
  return (
    <section className="border-t border-neutral-200/70 px-4 py-20 sm:px-6 sm:py-24 dark:border-white/[0.06]">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            <span className="h-px w-6 bg-indigo-500/60" />
            Preguntas frecuentes
          </div>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
            Lo que la gente nos suele preguntar
          </h2>
        </div>

        <div className="mt-12 grid gap-3">
          {FAQS.map(faq => (
            <details
              key={faq.q}
              className="group rounded-2xl border border-neutral-200/80 bg-white p-5 transition-colors hover:border-neutral-300 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/[0.15]"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-neutral-900 list-none dark:text-neutral-100 [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-transform group-open:rotate-45 dark:bg-white/[0.06] dark:text-neutral-300">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="border-t border-neutral-200/70 px-4 py-24 sm:px-6 dark:border-white/[0.06]">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-neutral-900/10 bg-neutral-900 px-6 py-14 text-center text-white shadow-2xl shadow-neutral-900/20 sm:px-12 sm:py-20 dark:border-white/10 dark:bg-gradient-to-br dark:from-[#0c0d12] dark:to-[#15161c]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.25),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300">
          <Users size={12} />
          Empieza hoy
        </span>
        <h2 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Prueba Business Prospector{' '}
          <span className="bg-gradient-to-r from-white via-violet-400 to-violet-600 bg-clip-text italic text-transparent">
            sin riesgo
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-neutral-400 sm:text-base">
          Crea tu cuenta con Google y arranca con el plan gratis. Cuando necesites más volumen o
          colaboración, mejoras a Pro o Premium en un par de clics.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-neutral-900 transition-all hover:translate-y-[-1px] hover:shadow-lg"
          >
            Empezar gratis
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-neutral-200 transition-colors hover:bg-white/10"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </section>
  )
}

function PricingFooter() {
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
          © {new Date().getFullYear()} Business Prospector · Precios sujetos a cambios sin previo aviso
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
        >
          Iniciar sesión <ArrowUpRight size={12} />
        </Link>
      </div>
    </footer>
  )
}
