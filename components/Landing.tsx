'use client'

import { useTranslations } from 'next-intl'
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Filter,
  FolderTree,
  Heart,
  Layers,
  MapPin,
  Phone,
  Quote,
  Radar,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'
import { DotWave } from '@/components/DotWave'
import { LandingHeader } from '@/components/LandingHeader'
import { Link } from '@/i18n/navigation'

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-neutral-50 text-neutral-900 dark:bg-[#06070a] dark:text-neutral-100 selection:bg-indigo-500/30 selection:text-neutral-900 dark:selection:text-white">
      <BackgroundGlow />
      <LandingHeader />

      <main className="relative">
        <Hero />
        <SocialProof />
        <Misiones />
        <Funcionalidades />
        <Detalles />
        <Beneficios />
        <FinalCTA />
      </main>

      <LandingFooter />
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

function Hero() {
  const t = useTranslations('landing.hero')
  return (
    <section className="relative isolate overflow-hidden px-4 pt-20 pb-24 sm:px-6 sm:pt-28 sm:pb-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <DotWave
          className="absolute inset-0 h-full w-full"
          amplitude={42}
          spacing={22}
          dotRadius={1.8}
          tilt={1.15}
          speed={0.00025}
          opacity={0.45}
        />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-[linear-gradient(to_bottom,transparent,var(--color-background)_90%)]" />
        <div className="absolute inset-y-0 left-0 w-24 bg-[linear-gradient(to_right,var(--color-background),transparent)]" />
        <div className="absolute inset-y-0 right-0 w-24 bg-[linear-gradient(to_left,var(--color-background),transparent)]" />
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white/60 px-3.5 py-1.5 text-xs font-medium text-neutral-600 backdrop-blur dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
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

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neutral-900/10 transition-all hover:translate-y-[-1px] hover:shadow-xl dark:bg-white dark:text-neutral-900 dark:shadow-white/10"
          >
            {t('ctaPrimary')}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#funcionalidades"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/60 px-6 py-3 text-sm font-semibold text-neutral-700 backdrop-blur transition-colors hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-200 dark:hover:bg-white/[0.06]"
          >
            {t('ctaSecondary')}
          </a>
        </div>

        <p className="mt-5 text-xs text-neutral-500 dark:text-neutral-500">{t('disclaimer')}</p>
      </div>

      <div className="relative mx-auto mt-16 max-w-5xl">
        <div className="absolute -inset-x-12 -top-10 -bottom-10 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,rgba(99,102,241,0.2),transparent_75%)] blur-2xl" />
        <DashboardMockup />
      </div>
    </section>
  )
}

function DashboardMockup() {
  const t = useTranslations('landing.mockup')
  const statusStyle = {
    Interested: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300',
    Interesado: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300',
    Contacted: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
    Contactado: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
    Pending: 'bg-neutral-500/10 text-neutral-600 ring-neutral-500/20 dark:text-neutral-300',
    Pendiente: 'bg-neutral-500/10 text-neutral-600 ring-neutral-500/20 dark:text-neutral-300',
    Customer: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300',
    Cliente: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300',
  } as const

  const rowKeys = ['first', 'second', 'third', 'fourth'] as const
  const rows = rowKeys.map(k => ({
    name: t(`rows.${k}.name`),
    city: t(`rows.${k}.city`),
    phone: t(`rows.${k}.phone`),
    status: t(`rows.${k}.status`) as keyof typeof statusStyle,
  }))
  const historyKeys = ['first', 'second', 'third', 'fourth'] as const
  const history = historyKeys.map(k => t(`historyItems.${k}`))

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-2xl shadow-neutral-900/10 ring-1 ring-black/5 dark:border-white/10 dark:bg-[#0b0c10] dark:shadow-indigo-500/10 dark:ring-white/5">
      <div className="flex items-center gap-2 border-b border-neutral-200/80 bg-neutral-50/80 px-4 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          <div className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          <div className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>
        <div className="mx-auto rounded-md bg-white px-3 py-1 text-[11px] font-mono text-neutral-500 ring-1 ring-neutral-200 dark:bg-white/[0.04] dark:text-neutral-500 dark:ring-white/10">
          {t('url')}
        </div>
        <div className="w-8" />
      </div>

      <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-[260px_minmax(0,1fr)] md:gap-6">
        <aside className="hidden flex-col gap-1 rounded-xl border border-neutral-200/70 bg-neutral-50/50 p-3 md:flex dark:border-white/5 dark:bg-white/[0.015]">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            {t('historyEyebrow')}
          </div>
          {history.map((label, i) => (
            <div
              key={label}
              className={
                'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium ' +
                (i === 0
                  ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-200'
                  : 'text-neutral-600 hover:bg-neutral-100/70 dark:text-neutral-400 dark:hover:bg-white/[0.03]')
              }
            >
              <span className="truncate">{label}</span>
              <span className="shrink-0 rounded-md bg-neutral-200/60 px-1.5 text-[10px] text-neutral-600 dark:bg-white/5 dark:text-neutral-400">
                {12 + i * 6}
              </span>
            </div>
          ))}
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <FieldMock label={t('categoryLabel')} value={t('categoryValue')} icon={<Filter size={14} />} />
            <FieldMock label={t('locationLabel')} value={t('locationValue')} icon={<MapPin size={14} />} />
            <button className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/30">
              <Radar size={14} /> {t('search')}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-neutral-200/70 dark:border-white/5">
            <div className="grid grid-cols-[1fr_120px_120px] items-center gap-3 border-b border-neutral-200/70 bg-neutral-50/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 sm:grid-cols-[1fr_140px_140px_110px] dark:border-white/5 dark:bg-white/[0.02]">
              <span>{t('tableBusiness')}</span>
              <span className="hidden sm:block">{t('tablePhone')}</span>
              <span>{t('tableCity')}</span>
              <span className="text-right">{t('tableStatus')}</span>
            </div>
            {rows.map(r => (
              <div
                key={r.name}
                className="grid grid-cols-[1fr_120px_120px] items-center gap-3 border-b border-neutral-100/80 px-4 py-3 text-xs last:border-0 sm:grid-cols-[1fr_140px_140px_110px] dark:border-white/[0.04]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Heart size={14} className="shrink-0 fill-rose-500 text-rose-500" />
                  <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">{r.name}</span>
                </div>
                <span className="hidden truncate font-mono text-[11px] text-neutral-500 sm:block">{r.phone}</span>
                <span className="truncate text-neutral-500">{r.city}</span>
                <span className="flex justify-end">
                  <span
                    className={
                      'rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ' +
                      (statusStyle[r.status] ?? statusStyle.Pending)
                    }
                  >
                    {r.status}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {t('liveStatus')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Download size={12} /> {t('exportLabel')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldMock({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-neutral-200/70 bg-neutral-50/40 px-3 py-2 dark:border-white/5 dark:bg-white/[0.015]">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-800 dark:text-neutral-100">
        {icon}
        {value}
      </span>
    </div>
  )
}

function SocialProof() {
  const t = useTranslations('landing.socialProof')
  const testimonialKeys = ['first', 'second', 'third'] as const
  const statKeys = ['first', 'second', 'third'] as const

  return (
    <section className="border-t border-neutral-200/70 px-4 py-20 sm:px-6 dark:border-white/[0.06]">
      <div className="mx-auto max-w-6xl">
        <SectionLabel eyebrow={t('eyebrow')} title={t('title')} />

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {testimonialKeys.map(k => (
            <Testimonial
              key={k}
              quote={t(`testimonials.${k}.quote`)}
              author={t(`testimonials.${k}.author`)}
              role={t(`testimonials.${k}.role`)}
            />
          ))}
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-neutral-200/70 bg-neutral-200/70 sm:grid-cols-3 dark:border-white/5 dark:bg-white/5">
          {statKeys.map(k => (
            <StatCard key={k} value={t(`stats.${k}.value`)} label={t(`stats.${k}.label`)} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonial({ quote, author, role }: { quote: string; author: string; role: string }) {
  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-6 transition-all hover:border-indigo-500/40 hover:shadow-lg dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]">
      <Quote size={20} className="text-indigo-500/60" />
      <p className="mt-4 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{quote}</p>
      <div className="mt-6 flex items-center gap-3 border-t border-neutral-200/70 pt-4 dark:border-white/[0.05]">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
          {author
            .split(' ')
            .map(w => w[0])
            .slice(0, 2)
            .join('')}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{author}</div>
          <div className="text-xs text-neutral-500">{role}</div>
        </div>
        <div className="ml-auto flex gap-0.5 text-amber-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={12} className="fill-current" />
          ))}
        </div>
      </div>
    </article>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-neutral-50 px-6 py-8 dark:bg-[#0b0c10]">
      <div className="font-mono text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl dark:text-neutral-50">
        {value}
      </div>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{label}</p>
    </div>
  )
}

function SectionLabel({ eyebrow, title, align = 'left' }: { eyebrow: string; title: string; align?: 'left' | 'center' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
        <span className="h-px w-6 bg-indigo-500/60" />
        {eyebrow}
      </div>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl md:text-5xl dark:text-neutral-50">
        {title}
      </h2>
    </div>
  )
}

function Misiones() {
  const t = useTranslations('landing.missions')
  const missions: { key: 'competition' | 'publicData' | 'team'; icon: React.ReactNode }[] = [
    { key: 'competition', icon: <Target size={22} /> },
    { key: 'publicData', icon: <ShieldCheck size={22} /> },
    { key: 'team', icon: <Users size={22} /> },
  ]
  return (
    <section id="misiones" className="border-t border-neutral-200/70 px-4 py-24 sm:px-6 dark:border-white/[0.06]">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionLabel eyebrow={t('eyebrow')} title={t('title')} />
          <p className="max-w-md text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {t('description')}
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {missions.map(m => (
            <article
              key={m.key}
              className="group relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-7 transition-all hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/5 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
            >
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-500/[0.06] blur-2xl transition-all group-hover:bg-indigo-500/10" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-300">
                {m.icon}
              </div>
              <h3 className="relative mt-5 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                {t(`items.${m.key}.title`)}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {t(`items.${m.key}.body`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

type Feature = {
  icon: React.ReactNode
  title: string
  body: string
  tag?: string
  span?: string
  preview?: React.ReactNode
}

function Funcionalidades() {
  const t = useTranslations('landing.features')
  const features: Feature[] = [
    {
      icon: <Radar size={20} />,
      title: t('items.streaming.title'),
      body: t('items.streaming.body'),
      tag: t('items.streaming.tag'),
      span: 'md:col-span-2 md:row-span-1',
      preview: <StreamingPreview />,
    },
    {
      icon: <Layers size={20} />,
      title: t('items.sources.title'),
      body: t('items.sources.body'),
      tag: t('items.sources.tag'),
    },
    {
      icon: <Heart size={20} />,
      title: t('items.prospects.title'),
      body: t('items.prospects.body'),
      tag: t('items.prospects.tag'),
    },
    {
      icon: <FolderTree size={20} />,
      title: t('items.folders.title'),
      body: t('items.folders.body'),
      tag: t('items.folders.tag'),
      span: 'md:col-span-2',
      preview: <FoldersPreview />,
    },
    {
      icon: <FileSpreadsheet size={20} />,
      title: t('items.excel.title'),
      body: t('items.excel.body'),
      tag: t('items.excel.tag'),
    },
  ]

  return (
    <section
      id="funcionalidades"
      className="border-t border-neutral-200/70 px-4 py-24 sm:px-6 dark:border-white/[0.06]"
    >
      <div className="mx-auto max-w-6xl">
        <SectionLabel eyebrow={t('eyebrow')} title={t('title')} />

        <div className="mt-12 grid gap-4 md:grid-cols-3 md:auto-rows-[minmax(220px,auto)]">
          {features.map(f => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <article
      className={
        'group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-6 transition-all hover:border-indigo-500/40 hover:shadow-xl dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] ' +
        (feature.span ?? '')
      }
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 transition-colors group-hover:bg-indigo-500/10 group-hover:text-indigo-600 dark:bg-white/[0.04] dark:text-neutral-300 dark:group-hover:text-indigo-300">
          {feature.icon}
        </div>
        {feature.tag && (
          <span className="rounded-full border border-neutral-200/80 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-400">
            {feature.tag}
          </span>
        )}
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        {feature.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{feature.body}</p>
      {feature.preview && <div className="mt-5">{feature.preview}</div>}
    </article>
  )
}

function StreamingPreview() {
  const t = useTranslations('landing.features.streamingPreview')
  const items = ['first', 'second', 'third', 'fourth'] as const
  return (
    <div className="relative overflow-hidden rounded-xl border border-neutral-200/70 bg-neutral-50/70 p-3 dark:border-white/5 dark:bg-black/30">
      <div className="space-y-1.5">
        {items.map((k, i) => (
          <div
            key={k}
            className="flex items-center gap-2 rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-200/60 dark:bg-white/[0.03] dark:text-neutral-300 dark:ring-white/5"
            style={{
              animation: `landing-fade-in 600ms ${i * 150}ms both`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="truncate">{t(k)}</span>
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-neutral-500">
              <Phone size={10} /> +52
            </span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes landing-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function FoldersPreview() {
  const t = useTranslations('landing.features.foldersPreview')
  const folders: { key: 'first' | 'second' | 'third' | 'fourth'; count: number; color: string; shared?: boolean }[] = [
    { key: 'first', count: 14, color: 'bg-indigo-500' },
    { key: 'second', count: 32, color: 'bg-emerald-500' },
    { key: 'third', count: 21, color: 'bg-amber-500' },
    { key: 'fourth', count: 8, color: 'bg-rose-500', shared: true },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200/70 bg-neutral-50/70 p-3 sm:grid-cols-4 dark:border-white/5 dark:bg-black/30">
      {folders.map(f => (
        <div
          key={f.key}
          className="rounded-lg border border-neutral-200/60 bg-white px-2.5 py-2 dark:border-white/5 dark:bg-white/[0.02]"
        >
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${f.color}`} />
            <span className="truncate text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
              {t(`${f.key}.name`)}
            </span>
            {f.shared && <Share2 size={10} className="ml-auto text-neutral-400" />}
          </div>
          <div className="mt-1 text-[10px] font-mono text-neutral-500">
            {t(`${f.key}.searches`, { count: f.count })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Detalles() {
  const t = useTranslations('landing.steps')
  const steps: ('define' | 'stream' | 'tag' | 'export')[] = ['define', 'stream', 'tag', 'export']
  return (
    <section id="detalles" className="border-t border-neutral-200/70 px-4 py-24 sm:px-6 dark:border-white/[0.06]">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionLabel eyebrow={t('eyebrow')} title={t('title')} />
          <Link
            href="/login"
            className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {t('cta')} <ArrowUpRight size={16} />
          </Link>
        </div>

        <ol className="mt-12 grid gap-4 md:grid-cols-4">
          {steps.map((key, i) => (
            <li
              key={key}
              className="group relative flex flex-col rounded-2xl border border-neutral-200/80 bg-white p-6 transition-all hover:border-indigo-500/40 dark:border-white/[0.08] dark:bg-white/[0.02]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold tracking-wider text-indigo-600 dark:text-indigo-400">
                  {t(`items.${key}.step`)}
                </span>
                {i < steps.length - 1 && (
                  <ArrowRight size={14} className="text-neutral-300 dark:text-neutral-700" />
                )}
              </div>
              <h3 className="mt-6 text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {t(`items.${key}.body`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Beneficios() {
  const t = useTranslations('landing.benefits')
  const items: { key: 'speed' | 'consistent' | 'noScripts' | 'history'; icon: React.ReactNode }[] = [
    { key: 'speed', icon: <Zap size={18} /> },
    { key: 'consistent', icon: <CheckCircle2 size={18} /> },
    { key: 'noScripts', icon: <Workflow size={18} /> },
    { key: 'history', icon: <Sparkles size={18} /> },
  ]
  return (
    <section className="border-t border-neutral-200/70 px-4 py-24 sm:px-6 dark:border-white/[0.06]">
      <div className="mx-auto max-w-6xl">
        <SectionLabel eyebrow={t('eyebrow')} title={t('title')} />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-neutral-200/70 bg-neutral-200/70 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/5 dark:bg-white/5">
          {items.map(item => (
            <div
              key={item.key}
              className="group flex flex-col gap-3 bg-white p-6 transition-colors hover:bg-neutral-50 dark:bg-[#0b0c10] dark:hover:bg-white/[0.02]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                {item.icon}
              </div>
              <h3 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                {t(`items.${item.key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {t(`items.${item.key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  const t = useTranslations('landing.finalCta')
  return (
    <section className="border-t border-neutral-200/70 px-4 py-24 sm:px-6 dark:border-white/[0.06]">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-neutral-900/10 bg-neutral-900 px-6 py-14 text-center text-white shadow-2xl shadow-neutral-900/20 sm:px-12 sm:py-20 dark:border-white/10 dark:bg-gradient-to-br dark:from-[#0c0d12] dark:to-[#15161c]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.25),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />

        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300">
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
          <a
            href="#funcionalidades"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-neutral-200 transition-colors hover:bg-white/10"
          >
            {t('ctaSecondary')}
          </a>
        </div>
      </div>
    </section>
  )
}

function LandingFooter() {
  const t = useTranslations('footer')
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
          {t('copyright', { year: new Date().getFullYear() })}
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
        >
          {t('login')} <ArrowUpRight size={12} />
        </Link>
      </div>
    </footer>
  )
}
