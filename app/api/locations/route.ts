import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-static'
/** ISR: regenera el catálogo en background una vez por día. */
export const revalidate = 86_400

type RestCountriesEntry = {
  cca2?: string
  name?: { common?: string }
  translations?: Record<string, { common?: string; official?: string }>
}

type CountriesNowState = { name?: string }
type CountriesNowCountry = {
  name?: string
  iso2?: string
  iso3?: string
  states?: CountriesNowState[]
}
type CountriesNowResponse = { error?: boolean; data?: CountriesNowCountry[] }

export type LocationsCatalog = {
  countries: { label: string; hints: string[] }[]
  states: { label: string; hints: string[] }[]
  /** Timestamp ISO de cuándo se generó el catálogo (debug). */
  generatedAt: string
}

/** Caché en módulo: vive lo que viva el proceso Node. ISR ya hace lo demás. */
let inMemoryCatalog: LocationsCatalog | null = null

/** Países hispanohablantes + EE.UU. al frente (orden de relevancia para el negocio). */
const PRIORITY_ISO2 = new Set<string>([
  'ES',
  'MX',
  'US',
  'AR',
  'CL',
  'CO',
  'PE',
  'EC',
  'VE',
  'UY',
  'PY',
  'BO',
  'CR',
  'NI',
  'GT',
  'HN',
  'SV',
  'PA',
  'CU',
  'DO',
  'PR',
])

async function fetchRestCountries(): Promise<RestCountriesEntry[]> {
  const res = await fetch(
    'https://restcountries.com/v3.1/all?fields=cca2,name,translations',
    { signal: AbortSignal.timeout(15_000), next: { revalidate: 86_400 } },
  )
  if (!res.ok) throw new Error(`REST Countries HTTP ${res.status}`)
  return (await res.json()) as RestCountriesEntry[]
}

async function fetchCountriesNowStates(): Promise<CountriesNowCountry[]> {
  const res = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
    signal: AbortSignal.timeout(20_000),
    next: { revalidate: 86_400 },
  })
  if (!res.ok) throw new Error(`CountriesNow HTTP ${res.status}`)
  const data = (await res.json()) as CountriesNowResponse
  if (data.error || !Array.isArray(data.data)) throw new Error('CountriesNow payload inválido')
  return data.data
}

function uniqueHints(...sources: (string | undefined | null)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of sources) {
    const t = (s ?? '').trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

async function buildCatalog(): Promise<LocationsCatalog> {
  const [rest, now] = await Promise.all([
    fetchRestCountries().catch(err => {
      console.warn('[api/locations] REST Countries fallback vacío:', err instanceof Error ? err.message : err)
      return [] as RestCountriesEntry[]
    }),
    fetchCountriesNowStates().catch(err => {
      console.warn('[api/locations] CountriesNow fallback vacío:', err instanceof Error ? err.message : err)
      return [] as CountriesNowCountry[]
    }),
  ])

  /** Mapa iso2 → nombre en español (vía REST Countries). */
  const spanishByIso = new Map<string, string>()
  const englishByIso = new Map<string, string>()
  for (const c of rest) {
    const iso = (c.cca2 ?? '').toUpperCase()
    if (!iso) continue
    const spa = c.translations?.spa?.common?.trim() || c.name?.common?.trim() || ''
    const eng = c.name?.common?.trim() ?? ''
    if (spa) spanishByIso.set(iso, spa)
    if (eng) englishByIso.set(iso, eng)
  }

  const countries: { label: string; hints: string[]; iso: string }[] = []
  const states: { label: string; hints: string[]; iso: string }[] = []

  for (const c of now) {
    const iso = (c.iso2 ?? '').toUpperCase()
    const englishName = c.name?.trim() ?? ''
    if (!englishName) continue
    const spanishName = (iso && spanishByIso.get(iso)) || englishName
    const englishCanonical = (iso && englishByIso.get(iso)) || englishName

    countries.push({
      label: spanishName,
      iso,
      hints: uniqueHints(englishName, englishCanonical, iso, c.iso3),
    })

    for (const st of c.states ?? []) {
      const stateName = st.name?.trim()
      if (!stateName) continue
      states.push({
        label: `${stateName}, ${spanishName}`,
        iso,
        hints: uniqueHints(stateName, `${stateName}, ${englishCanonical}`, iso),
      })
    }
  }

  /** Países hispanohablantes + USA primero; el resto alfabético. */
  countries.sort((a, b) => {
    const pa = PRIORITY_ISO2.has(a.iso) ? 0 : 1
    const pb = PRIORITY_ISO2.has(b.iso) ? 0 : 1
    if (pa !== pb) return pa - pb
    return a.label.localeCompare(b.label, 'es')
  })
  states.sort((a, b) => {
    const pa = PRIORITY_ISO2.has(a.iso) ? 0 : 1
    const pb = PRIORITY_ISO2.has(b.iso) ? 0 : 1
    if (pa !== pb) return pa - pb
    return a.label.localeCompare(b.label, 'es')
  })

  return {
    generatedAt: new Date().toISOString(),
    countries: countries.map(({ label, hints }) => ({ label, hints })),
    states: states.map(({ label, hints }) => ({ label, hints })),
  }
}

export async function GET(): Promise<NextResponse<LocationsCatalog>> {
  if (inMemoryCatalog) return NextResponse.json(inMemoryCatalog)
  try {
    inMemoryCatalog = await buildCatalog()
  } catch (err) {
    console.error('[api/locations] error al construir catálogo:', err instanceof Error ? err.message : err)
    /** Aún en error devolvemos algo vacío; el cliente cae al fallback estático. */
    inMemoryCatalog = { generatedAt: new Date().toISOString(), countries: [], states: [] }
  }
  return NextResponse.json(inMemoryCatalog, {
    headers: {
      /** Cache-Control para CDN y browser: 1 día, revalidate stale-while-revalidate. */
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
