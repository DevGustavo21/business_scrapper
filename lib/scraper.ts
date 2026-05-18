import { chromium, type Browser, type Page } from 'playwright-core'
import { stableBusinessFingerprint } from '@/lib/businessDedupe'
import { type Negocio, SCRAPE_MAX_MS } from '@/types/business'

/** SPAs como Maps casi nunca llegan a "networkidle". */
const NAV_WAIT: 'domcontentloaded' = 'domcontentloaded'
const NAV_TIMEOUT_MS = 24_000

/** Auditorías web: pocas en profundidad; el resto placeholder (más filas en el mismo tiempo). */
function auditBudgetForRun(requested: number): number {
  return Math.max(1, Math.min(4, Math.ceil(requested / 4)))
}

function placeholderAuditPendiente(): {
  correo: string
  problemasDetectados: string
  oportunidades: string
} {
  return {
    correo: '',
    problemasDetectados:
      'Auditoría web omitida en esta extracción masiva; abre el sitio del negocio para revisar UX, rendimiento y SEO manualmente.',
    oportunidades:
      'Priorizar propuesta de valor arriba del fold, datos de contacto claros (NAP), velocidad móvil y SEO local (Google Business Profile + schema).',
  }
}

const delay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min))

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type DireccionSplit = { direccion: string; ciudad: string; pais: string }

/** Ciudad/país inferidos del campo «ubicación» de la búsqueda cuando Maps no los separa. */
function parseUbicacionFallback(ubicacion: string): { ciudad: string; pais: string } {
  const parts = ubicacion
    .replace(/\s+/g, ' ')
    .trim()
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
  if (parts.length >= 2) return { ciudad: parts[0], pais: parts[parts.length - 1] }
  if (parts.length === 1) return { ciudad: parts[0], pais: parts[0] }
  return { ciudad: '', pais: '' }
}

/**
 * Separa el texto de dirección típico de Maps/directorio (segmentos por comas)
 * en calle / ciudad / país. Heurística: con 3+ partes, última = país, penúltima = ciudad.
 */
function splitDireccionResultado(raw: string, ubicacionFallback = ''): DireccionSplit {
  const t = raw.replace(/\s+/g, ' ').trim()
  const fb = parseUbicacionFallback(ubicacionFallback)
  if (!t) return { direccion: '', ciudad: fb.ciudad, pais: fb.pais }
  const parts = t.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length === 1) {
    return { direccion: parts[0], ciudad: fb.ciudad, pais: fb.pais }
  }
  if (parts.length === 2) {
    return {
      direccion: parts[0],
      ciudad: parts[1] || fb.ciudad,
      pais: fb.pais,
    }
  }
  const pais = parts[parts.length - 1] ?? fb.pais
  const ciudad = parts[parts.length - 2] ?? fb.ciudad
  const direccion = parts.slice(0, -2).join(', ')
  return { direccion, ciudad: ciudad || fb.ciudad, pais: pais || fb.pais }
}

function normalizePhoneText(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim()
  const digits = t.replace(/\D/g, '')
  if (digits.length < 7) return ''
  return t.slice(0, 48)
}

function isGoogleOwnedUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(google\.|g\.page|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url.trim())
}

function extractPlaceIdFromMapsUrl(href: string): string | null {
  try {
    const u = new URL(href)
    for (const key of ['place_id', 'query_place_id']) {
      const v = u.searchParams.get(key)?.trim()
      if (v && /^ChIJ/i.test(v)) return v
    }
    const fromData = u.href.match(/[!/]1s(ChIJ[A-Za-z0-9_-]+)/i)
    if (fromData?.[1]) return fromData[1]
  } catch {
    /* ignore */
  }
  return null
}

type ContactFields = {
  direccion: string
  ciudad: string
  pais: string
  telefono: string
  sitioWeb: string
  correo: string
}

function mergeContactFields(base: ContactFields, patch: Partial<ContactFields>): ContactFields {
  const pick = (a: string, b?: string) => (a.trim() ? a.trim() : (b ?? '').trim())
  const sitio = pick(base.sitioWeb, patch.sitioWeb)
  const sitioClean = sitio && !isGoogleOwnedUrl(sitio) ? sitio : pick('', patch.sitioWeb)
  return {
    direccion: pick(base.direccion, patch.direccion),
    ciudad: pick(base.ciudad, patch.ciudad),
    pais: pick(base.pais, patch.pais),
    telefono: pick(base.telefono, patch.telefono),
    sitioWeb: sitioClean,
    correo: pick(base.correo, patch.correo),
  }
}

/** Completa teléfono, web, dirección y correo vía Places Details cuando el DOM de Maps falla. */
async function enrichContactFromPlacesApi(
  input: {
    mapsUrl?: string
    nombre: string
    ubicacion: string
    direccionMaps?: string
  },
  partial: ContactFields,
): Promise<ContactFields> {
  if (!placesApiUsableCached()) return partial
  const key = placesServerApiKey()
  if (!key) return partial

  let pid = input.mapsUrl ? extractPlaceIdFromMapsUrl(input.mapsUrl) : null
  if (!pid) {
    const q = [input.nombre, partial.direccion || input.direccionMaps, input.ubicacion]
      .filter(Boolean)
      .join(', ')
    pid = await findPlaceIdByTextQuery(q, key)
  }
  if (!pid) return partial

  const det = await fetchGooglePlaceDetailsResult(pid, key)
  if (!det) return partial

  const addr = (det.formatted_address ?? '').trim()
  const addrSplit = addr ? splitDireccionResultado(addr, input.ubicacion) : { direccion: '', ciudad: '', pais: '' }
  const web = (det.website ?? '').trim()
  const sitioWeb =
    web && !isGoogleOwnedUrl(web) ? web : partial.sitioWeb && !isGoogleOwnedUrl(partial.sitioWeb) ? partial.sitioWeb : ''

  let correo = partial.correo
  if (!correo.trim() && sitioWeb && scrapeWantsFetchEmailFromWeb()) {
    correo = await scrapeFetchEmailFromUrl(sitioWeb)
  }

  return mergeContactFields(partial, {
    direccion: addrSplit.direccion || partial.direccion,
    ciudad: addrSplit.ciudad || partial.ciudad,
    pais: addrSplit.pais || partial.pais,
    telefono: (det.international_phone_number ?? det.formatted_phone_number ?? '').trim(),
    sitioWeb,
    correo,
  })
}

/** Teléfono y fragmentos de dirección en el aria-label de la tarjeta del listado. */
function parseFeedHintExtras(hint: string): { telefono: string; rawAddr: string } {
  const parts = hint.split('·').map(s => s.trim()).filter(Boolean)
  let telefono = ''
  let rawAddr = ''
  for (const p of parts) {
    if (!telefono && /(?:\+?\d[\d\s().\-]{6,}\d)/.test(p) && !p.includes('@')) {
      const m = p.match(/(?:\+?\d[\d\s().\-]{6,}\d)/)
      if (m) telefono = normalizePhoneText(m[0])
    }
    if (!rawAddr && p.length >= 6 && (p.includes(',') || /\d{2,}/.test(p)) && !/^\$/.test(p) && !/reseñas|reviews/i.test(p)) {
      if (!/^(restaurant|cafe|bar|hotel|store)$/i.test(p)) rawAddr = p
    }
  }
  if (!rawAddr) rawAddr = direccionLiteFromHint(hint)
  return { telefono, rawAddr }
}

// Bloqueo de assets por URL (evita globs complejos en page.route).
const ASSET_URL = /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot)(\?|#|$)/i

async function newPage(browser: Browser, opts?: { locale?: string }): Promise<Page> {
  const ctx = await browser.newContext({
    userAgent: USER_AGENT,
    locale: opts?.locale ?? 'es-ES',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' },
  })
  const page = await ctx.newPage()
  await page.route(ASSET_URL, r => r.abort())
  return page
}

/**
 * Clave de dedupe por URL de ficha Maps.
 * Antes solo se usaba `origin + pathname`; en el listado actual muchos enlaces comparten el mismo
 * pathname y difieren en `search`, `hash` o en el segmento `/data=...` — eso colapsaba todo en 1 clave
 * y solo se emitía un negocio aunque el feed mostrara muchas filas.
 */
function mapsPlaceDedupeKey(href: string): string {
  const chij = href.match(/[!/]1s(ChIJ[A-Za-z0-9_-]+)/i)?.[1]
  if (chij) return `chij|${chij.toLowerCase()}`
  const hex = href.match(/[!/]1s(0x[a-f0-9]+:0x[a-f0-9]+)/i)?.[1]
  if (hex) return `hex|${hex.toLowerCase()}`
  try {
    const u = new URL(href)
    const host = u.hostname.toLowerCase()
    const onGoogleMaps =
      (host.includes('google.') && (u.pathname.includes('/maps') || u.href.includes('/maps'))) ||
      host === 'maps.google.com'
    const looksLikeFicha =
      /\/maps\/place\//i.test(u.pathname) ||
      /[?&]cid=/i.test(u.search) ||
      /[?&]ftid=/i.test(u.search) ||
      /[?&]place_id=/i.test(u.search)
    if (!onGoogleMaps || !looksLikeFicha) return href.trim().replace(/\s+/g, ' ').toLowerCase()
    return `${u.origin}${u.pathname}${u.search}${u.hash}`.replace(/\s+/g, '').toLowerCase()
  } catch {
    return href.trim().toLowerCase()
  }
}

/**
 * Si el panel de la ficha no hidrata el H1, Maps suele llevar el nombre codificado en la ruta
 * `/maps/place/Nombre+Negocio/...`.
 */
function fallbackNombreFromMapsUrl(href: string): string {
  try {
    const u = new URL(href)
    const m = u.pathname.match(/\/maps\/place\/([^/@]+)/i)
    if (!m?.[1]) return ''
    let s = m[1].replace(/\+/g, ' ')
    try {
      s = decodeURIComponent(s)
    } catch {
      /* segmento ya decodificado o caracteres raros */
    }
    const t = s.replace(/\s+/g, ' ').trim()
    return t.length >= 2 ? t : ''
  } catch {
    return ''
  }
}

/** Auditar sitio web en cada ficha Maps (lento). Por defecto desactivado para cumplir el cupo de resultados. */
function mapsWantsDeepWebAudit(): boolean {
  return process.env.SCRAPE_MAPS_WEB_AUDIT === '1'
}

/** Cierre de consentimiento / diálogos que tapan el listado de resultados. */
async function dismissMapsOverlays(page: Page, log: (m: string) => void): Promise<void> {
  const candidates = [
    'button:has-text("Aceptar todo")',
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Rechazar todo")',
    'button:has-text("Reject all")',
    'button:has-text("Tout accepter")',
    '[aria-label="Aceptar todo"]',
    '[aria-label="Accept all"]',
    'form[action*="consent"] button',
    'button:has-text("Aceptar")',
    'div[role="dialog"] button:has-text("Aceptar todo")',
  ]
  for (const sel of candidates) {
    const loc = page.locator(sel).first()
    const vis = await loc.isVisible({ timeout: 400 }).catch(() => false)
    if (vis) {
      await loc.click({ timeout: 1500 }).catch(() => {})
      await delay(400, 900)
      log(`[scraper] Maps: clic en overlay (${sel.slice(0, 48)}…)`)
    }
  }
  await page.keyboard.press('Escape').catch(() => {})
  await delay(200, 400)
}

type FeedPlaceHint = { href: string; hint: string }

const MAPS_LITE_PROBLEMAS =
  'Listado rápido de Maps (la ficha no se abrió en el servidor): teléfono, web o correo pueden faltar o no estar verificados. Sin auditoría automática del sitio del negocio.'
const MAPS_LITE_OPORTUNIDADES =
  'Confirma el contacto en Google Maps o en la web oficial; mejora NAP y presencia local (Google Business Profile, schema).'

type PlacesDetailFields = {
  name?: string
  formatted_address?: string
  formatted_phone_number?: string
  international_phone_number?: string
  website?: string
  url?: string
}

async function findPlaceIdByTextQuery(bq: string, key: string): Promise<string | null> {
  const u = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json')
  u.searchParams.set('input', bq)
  u.searchParams.set('inputtype', 'textquery')
  u.searchParams.set('fields', 'place_id,name')
  u.searchParams.set('key', key)
  try {
    const res = await fetch(u.toString(), { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    const data = (await res.json()) as { status: string; candidates?: { place_id: string }[] }
    if (data.status !== 'OK' || !data.candidates?.[0]?.place_id) return null
    return data.candidates[0].place_id
  } catch {
    return null
  }
}

async function fetchGooglePlaceDetailsResult(
  placeId: string,
  key: string,
): Promise<PlacesDetailFields | null> {
  const u = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  u.searchParams.set('place_id', placeId)
  u.searchParams.set(
    'fields',
    'name,formatted_address,formatted_phone_number,international_phone_number,website,url',
  )
  u.searchParams.set('key', key)
  try {
    const res = await fetch(u.toString(), { signal: AbortSignal.timeout(14_000) })
    if (!res.ok) return null
    const data = (await res.json()) as { status: string; result?: PlacesDetailFields; error_message?: string }
    if (data.status !== 'OK' || !data.result) return null
    return data.result
  } catch {
    return null
  }
}

/** Respaldo: solo negocios que no se emitieron tras abrir la ficha en Maps. */
async function tryEmitLiteFromMapsFeed(
  emit: ScrapeEmit,
  feedHints: FeedPlaceHint[],
  ubicacion: string,
  log: (m: string) => void,
): Promise<number> {
  let added = 0
  for (const { href, hint } of feedHints) {
    if (emit.timeUp() || emit.full()) break
    const placeKey = mapsPlaceDedupeKey(href)
    if (emit.hasEmitted(placeKey)) continue
    const nombre = cleanFeedHintName(hint)
    if (!nombre) continue

    const extras = parseFeedHintExtras(hint)
    const rawAddr = extras.rawAddr || direccionLiteFromHint(hint)
    let contact = splitDireccionResultado(rawAddr, ubicacion) as ContactFields
    contact.telefono = extras.telefono
    contact.sitioWeb = ''
    contact.correo = ''

    contact = await enrichContactFromPlacesApi(
      { mapsUrl: href, nombre, ubicacion, direccionMaps: rawAddr },
      contact,
    )

    let problemasDetectados = MAPS_LITE_PROBLEMAS
    let oportunidades = MAPS_LITE_OPORTUNIDADES
    const tieneWebNegocio = !!(contact.sitioWeb && !isGoogleOwnedUrl(contact.sitioWeb))
    if (contact.telefono || tieneWebNegocio || contact.correo) {
      problemasDetectados =
        'Datos desde listado de Maps y/o Google Places; conviene validar en la ficha. Sin auditoría automática del sitio web.'
      oportunidades = MAPS_LITE_OPORTUNIDADES
    }

    const ok = emit.tryEmit(placeKey, {
      nombre,
      direccion: contact.direccion,
      ciudad: contact.ciudad,
      pais: contact.pais,
      telefono: contact.telefono,
      correo: contact.correo,
      sitioWeb: contact.sitioWeb,
      problemasDetectados,
      oportunidades,
      estado: 'Sin contactar',
    })
    if (ok) added++
  }
  if (added > 0) log(`[scraper] Maps: respaldo listado/API sin ficha completa=${added}`)
  return added
}

function cleanFeedHintName(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim()
  if (t.length < 2 || /^google maps$/i.test(t)) return ''
  const head = t.split('·')[0]?.split('|')[0]?.trim() ?? t
  if (head.length < 2) return ''
  if (/^resultados de búsqueda$/i.test(head)) return ''
  return head.slice(0, 180)
}

/** Fragmento de dirección dentro del aria-label / tarjeta del listado (separadores ·). */
function direccionLiteFromHint(hint: string): string {
  const parts = hint.split('·').map(s => s.trim()).filter(Boolean)
  for (const p of parts) {
    if (p.length < 6) continue
    if (/^\$+$/.test(p)) continue
    if (/^\d+[,.]\d+\s*\(/.test(p)) continue
    if (/^\d+\s*(?:reseñas|reviews)$/i.test(p)) continue
    if (/^(restaurant|cafe|bar|hotel|store|comida|restaurante)$/i.test(p) && !p.includes(',')) continue
    if (p.includes(',') || /\d/.test(p)) return p
  }
  const last = parts[parts.length - 1] ?? ''
  if (last.length >= 10 && /\s/.test(last)) return last
  return ''
}

/** Parámetros en URL de búsqueda Maps (`?gl=…`) para resultados locales fuera de España. */
function mapsSearchExtraParams(ubicacion: string): string {
  const u = ubicacion.toLowerCase()
  if (/nicaragua|managua|granada|le[oó]n|matagalpa|chinandega|estel[ií]/i.test(u))
    return '?gl=ni&hl=es-419'
  if (/costa\s*rica|san\s*jos[eé]|escaz[uú]|cartago|heredia|alajuela|lim[oó]n|guanacaste|puntarenas/i.test(u))
    return '?gl=cr&hl=es-419'
  if (/guatemala|guate|quetzaltenango|antigua\s+guatemala/i.test(u)) return '?gl=gt&hl=es-419'
  if (/honduras|tegucigalpa|san\s+pedro\s+sula/i.test(u)) return '?gl=hn&hl=es-419'
  if (/el\s+salvador|san\s+salvador/i.test(u)) return '?gl=sv&hl=es-419'
  if (/panam[aá]|ciudad\s+de\s+panam/i.test(u)) return '?gl=pa&hl=es-419'
  if (/m[eé]xico|mexico|cdmx|guadalajara|monterrey|canc[uú]n|tijuana|puebla/i.test(u)) return '?gl=mx&hl=es-419'
  if (/colombia|bogot[aá]|medell[ií]n|cali|cartagena/i.test(u)) return '?gl=co&hl=es-419'
  return ''
}

/** Pistas de nombre desde tarjetas del feed (la ficha a veces no hidrata el H1 a tiempo). */
async function collectFeedPlaceHints(page: Page): Promise<FeedPlaceHint[]> {
  return page.evaluate(() => {
    const out: FeedPlaceHint[] = []
    const seen = new Set<string>()
    const push = (href: string, hintRaw: string) => {
      const h = href.trim()
      if (!h || seen.has(h)) return
      if (!/google\./i.test(h) && !/maps\.google\./i.test(h)) return
      if (!/\/maps\/place\/|[?&]cid=|[?&]ftid=/i.test(h)) return
      seen.add(h)
      const hint = (hintRaw || '').replace(/\s+/g, ' ').trim()
      if (hint.length < 2) return
      out.push({ href, hint })
    }
    const feed = document.querySelector('[role="feed"]')
    const roots: Element[] = []
    if (feed) roots.push(feed)
    if (document.body) roots.push(document.body)
    for (const root of roots) {
      root.querySelectorAll('[role="article"]').forEach(card => {
        const a = card.querySelector(
          'a[href*="/maps/place/"], a[href*="maps.google.com"], a[href*="cid="], a[href*="ftid="]',
        ) as HTMLAnchorElement | null
        if (!a?.href) return
        let hint = (card.getAttribute('aria-label') || '').trim()
        if (hint.length < 3) {
          const el = card.querySelector(
            '.fontHeadlineSmall, [class*="fontHeadlineSmall"], .qBF1Pd.fontHeadlineSmall, h3, .NrDZNb',
          )
          hint = (el?.textContent || a.textContent || '').trim()
        }
        push(a.href, hint)
        if (out.length >= 90) return out
      })
      root.querySelectorAll('a[href*="/maps/place/"], a[href*="cid="], a[href*="ftid="]').forEach(a => {
        const el = a as HTMLAnchorElement
        const card = el.closest('[role="article"]') || el.parentElement
        const hint =
          card?.getAttribute('aria-label')?.trim() ||
          card?.querySelector('.fontHeadlineSmall, [class*="fontHeadlineSmall"]')?.textContent?.trim() ||
          el.textContent?.trim() ||
          ''
        push(el.href, hint)
        if (out.length >= 90) return out
      })
    }
    return out
  })
}

/** Enlaces a fichas de negocio en el panel de resultados (DOM cambia con frecuencia). */
async function collectMapsPlaceLinks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const seen = new Set<string>()
    const push = (raw: string) => {
      if (out.length >= 420) return
      const h = raw.trim()
      if (!h) return
      let u: URL
      try {
        u = new URL(h)
      } catch {
        return
      }
      const host = u.hostname.toLowerCase()
      const href = u.href
      if (seen.has(href)) return
      const onGoogleMaps =
        (host.includes('google.') && (u.pathname.includes('/maps') || href.includes('/maps'))) ||
        host === 'maps.google.com'
      if (!onGoogleMaps) return
      const isFicha =
        /\/maps\/place\//i.test(u.pathname) ||
        /[?&]cid=/i.test(u.search) ||
        /[?&]ftid=/i.test(u.search) ||
        /[?&]place_id=/i.test(u.search)
      if (!isFicha) return
      seen.add(href)
      out.push(href)
    }
    const feed = document.querySelector('[role="feed"]')
    const scanRoots: Element[] = []
    if (feed) scanRoots.push(feed)
    if (document.body) scanRoots.push(document.body)
    for (const root of scanRoots) {
      root.querySelectorAll('a[href]').forEach(a => push((a as HTMLAnchorElement).href))
    }
    for (const a of document.querySelectorAll('[role="article"] a[href]')) {
      push((a as HTMLAnchorElement).href)
    }
    return out
  })
}

/** Maps hidrata el título con retraso; varios selectores por cambios de DOM. */
async function extractMapsPlaceTitle(page: Page): Promise<string> {
  const junk = (s: string) => {
    const t = s.trim()
    return t.length < 2 || /resultados de búsqueda|^google maps$/i.test(t)
  }
  const selectors = [
    'h1.DUwDvf',
    'h1[class*="DUwDvf"]',
    'div[role="main"] h1',
    '[role="main"] h1',
    'header h1',
    'h1',
  ]
  for (const sel of selectors) {
    const raw = await page.locator(sel).first().innerText({ timeout: 2800 }).catch(() => '')
    const trimmed = raw?.trim() ?? ''
    if (trimmed && !junk(trimmed)) return trimmed
  }
  await delay(350, 700)
  const raw = await page.locator('h1').first().innerText({ timeout: 3200 }).catch(() => '')
  const trimmed = raw?.trim() ?? ''
  return junk(trimmed) ? '' : trimmed
}

/** NAP en ficha Maps: varios selectores + texto en panel (DOM cambia con frecuencia). */
async function extractMapsPlaceNap(page: Page): Promise<{ direccionMaps: string; telefono: string; sitioWeb: string }> {
  await page
    .locator('button[data-item-id="address"], button[data-item-id^="phone"], a[data-item-id="authority"]')
    .first()
    .waitFor({ state: 'attached', timeout: 3500 })
    .catch(() => {})
  await delay(280, 520)

  const nap = await page.evaluate(() => {
    const txt = (el: Element | null | undefined) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    let direccionMaps = txt(document.querySelector('[data-item-id="address"]'))
    if (!direccionMaps) direccionMaps = txt(document.querySelector('button[data-item-id="address"]'))
    if (!direccionMaps) {
      const b = document.querySelector(
        'button[aria-label*="Dirección" i], button[aria-label*="Address" i], [data-item-id="address"]',
      ) as HTMLElement | null
      const al = (b?.getAttribute('aria-label') || '').trim()
      direccionMaps = al.replace(/^(?:dirección|address)\s*[:\u2013\-]\s*/i, '').trim() || txt(b)
    }
    let telefono = txt(document.querySelector('[data-item-id^="phone"]'))
    if (!telefono) telefono = txt(document.querySelector('button[data-item-id^="phone"]'))
    if (!telefono) {
      const pb = document.querySelector(
        'button[aria-label*="phone" i], button[aria-label*="Phone" i], button[aria-label*="Teléfono" i], button[aria-label*="Telefono" i]',
      )
      const al = (pb?.getAttribute('aria-label') || '').trim()
      telefono = al.replace(/^(?:teléfono|telefono|phone)\s*[:\u2013\-]\s*/i, '').trim() || txt(pb)
    }
    let sitioWeb = ''
    const auth = document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement | null
    if (auth?.href && !/^https?:\/\/[^/]*\.google\./i.test(auth.href)) sitioWeb = auth.href.trim()
    if (!sitioWeb) {
      document.querySelectorAll('a[href^="http"]').forEach(a => {
        const el = a as HTMLAnchorElement
        const h = el.href
        if (!h || /google\.(com|co|es)|gstatic\.com|googleusercontent\.com|schema\.org|w3\.org|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(h))
          return
        const lab = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).toLowerCase()
        if (
          el.getAttribute('data-item-id') === 'authority' ||
          /\b(website|web site|sitio web|página web|homepage)\b/i.test(lab)
        ) {
          sitioWeb = h
        }
      })
    }
    if (!telefono) {
      const body = document.body?.innerText || ''
      const pm = body.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/)
      if (pm) telefono = pm[0].trim()
    }
    return { direccionMaps, telefono, sitioWeb }
  })
  let direccionMaps = nap.direccionMaps.trim()
  let telefono = nap.telefono.trim()
  let sitioWeb = nap.sitioWeb.trim()
  if (!direccionMaps) {
    direccionMaps =
      (await page.locator('[data-item-id="address"]').first().innerText({ timeout: 1800 }).catch(() => '')) ||
      (await page.locator('button[data-item-id="address"]').first().innerText({ timeout: 1200 }).catch(() => ''))
    direccionMaps = direccionMaps.trim()
  }
  if (!telefono) {
    telefono =
      (await page.locator('[data-item-id^="phone"]').first().innerText({ timeout: 1800 }).catch(() => '')) ||
      (await page.locator('button[data-item-id^="phone"]').first().innerText({ timeout: 1200 }).catch(() => ''))
    telefono = telefono.trim()
  }
  if (!sitioWeb) {
    const href = await page.locator('a[data-item-id="authority"]').first().getAttribute('href').catch(() => null)
    if (href && !/^https?:\/\/[^/]*\.google\./i.test(href)) sitioWeb = href.trim()
  }
  return { direccionMaps, telefono, sitioWeb }
}

/** Maps en inglés suele hidratar mejor resultados en EE.UU. */
function browserLocaleForUbicacion(ubicacion: string): string {
  const u = ubicacion.toLowerCase()
  if (
    /\b(miami|orlando|tampa|florida|\bfl\b|usa|united states|new york|brooklyn|manhattan|los angeles|san diego|houston|dallas|chicago|phoenix|philadelphia|boston|atlanta|seattle|denver|austin)\b/i.test(
      u,
    )
  ) {
    return 'en-US'
  }
  if (
    /\b(nicaragua|managua|costa rica|honduras|guatemala|el salvador|panam|belice|belize|m[eé]xico|mexico|colombia|ecuador|per[uú]|chile|argentina|uruguay|paraguay|bolivia|venezuela)\b/i.test(
      u,
    )
  ) {
    return 'es-419'
  }
  return 'es-ES'
}

async function extractEmail(page: Page): Promise<string> {
  const text = await page.content()
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)
  if (!match) return ''
  return match.filter(e =>
    !e.includes('example') && !e.includes('sentry') &&
    !e.includes('@2x') && !e.endsWith('.png')
  )[0] ?? ''
}

function pickEmailFromHtml(html: string): string {
  const m = html.match(/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g)
  if (!m) return ''
  const ok = (e: string) =>
    !e.includes('example') && !e.includes('sentry') && !e.includes('@2x') && !e.endsWith('.png') &&
    !/\.(png|jpe?g|gif|webp)(\b|$)/i.test(e)
  return m.find(ok) ?? ''
}

/** Intenta sacar un correo público de la portada (fetch HTTP, sin Playwright). */
async function scrapeFetchEmailFromUrl(url: string): Promise<string> {
  let u = url.trim()
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  if (/^https?:\/\/(www\.)?google\./i.test(u)) return ''
  try {
    const res = await fetch(u, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6500),
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
    })
    if (!res.ok) return ''
    const text = await res.text()
    const fromBody = pickEmailFromHtml(text)
    if (fromBody) return fromBody
    const mailto = text.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i)
    return mailto?.[1] ?? ''
  } catch {
    return ''
  }
}

function scrapeWantsFetchEmailFromWeb(): boolean {
  return process.env.SCRAPE_FETCH_EMAIL !== '0'
}

function placesServerApiKey(): string {
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    ''
  )
}

let placesApiServerUsableCache: boolean | null = null

/** La clave debe permitir llamadas desde el servidor (IP o sin restricción), no solo Referer web. */
async function placesApiWorksOnServer(key: string, log: (m: string) => void): Promise<boolean> {
  if (placesApiServerUsableCache !== null) return placesApiServerUsableCache
  const u = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
  u.searchParams.set('query', 'restaurant')
  u.searchParams.set('key', key)
  try {
    const res = await fetch(u.toString(), { signal: AbortSignal.timeout(10_000) })
    const data = (await res.json()) as { status?: string; error_message?: string }
    const msg = data.error_message ?? ''
    if (data.status === 'REQUEST_DENIED' && /referer/i.test(msg)) {
      placesApiServerUsableCache = false
      log(
        '[scraper] GOOGLE_PLACES_API_KEY con restricción «Referer»: no funciona en el servidor. En Google Cloud → Credentials crea otra clave con restricción «IP» (o ninguna en desarrollo) y Places API activada.',
      )
      return false
    }
    placesApiServerUsableCache =
      data.status === 'OK' || data.status === 'ZERO_RESULTS' || data.status === 'OVER_QUERY_LIMIT'
    if (!placesApiServerUsableCache) {
      log(`[scraper] Places API no disponible: status=${data.status ?? '?'} ${msg}`.trim())
    }
    return placesApiServerUsableCache
  } catch (e) {
    placesApiServerUsableCache = false
    log(`[scraper] Places API: error de red (${e instanceof Error ? e.message : String(e)})`)
    return false
  }
}

function placesApiUsableCached(): boolean {
  return placesApiServerUsableCache === true
}

const SIN_WEB_PROBLEMAS =
  'No hay sitio web enlazado o la URL está vacía: no se puede auditar rendimiento, accesibilidad ni SEO del dominio propio desde el listado.'
const SIN_WEB_OPORTUNIDADES =
  'Crear un sitio responsive con identidad de marca coherente, datos de contacto visibles (NAP), formulario o WhatsApp, y SEO on-page (título único, meta descripción, datos estructurados locales).'

async function auditFromWebsite(
  browser: Browser,
  sitioWeb: string,
): Promise<{ correo: string; problemasDetectados: string; oportunidades: string }> {
  if (!sitioWeb?.trim())
    return { correo: '', problemasDetectados: SIN_WEB_PROBLEMAS, oportunidades: SIN_WEB_OPORTUNIDADES }
  let url = sitioWeb.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  let page: Page | null = null
  try {
    page = await newPage(browser)
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8_500 })
    await delay(120, 260)
    const correo = await extractEmail(page)
    const status = res?.status() ?? 0
    const audit = await page.evaluate(() => {
      const problemas: string[] = []
      const oportunidades: string[] = []

      const title = (document.title || '').trim()
      if (title.length < 12) problemas.push('Título de página muy corto o poco descriptivo (SEO y branding).')
      if (title.length > 68) problemas.push('Título muy largo: puede truncarse en resultados de búsqueda.')

      const md = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? ''
      if (!md) problemas.push('Falta meta descripción (menor control del snippet en Google).')
      else if (md.length < 90) oportunidades.push('Ampliar la meta descripción con propuesta de valor y llamada a la acción.')

      const h1n = document.querySelectorAll('h1').length
      if (h1n === 0) problemas.push('No hay H1 claro (jerarquía de contenido y SEO).')
      if (h1n > 1) problemas.push('Varios H1 en la misma vista: conviene un único encabezado principal.')

      if (!document.querySelector('meta[name="viewport"]'))
        problemas.push('Sin meta viewport: la experiencia móvil puede verse rota (UX).')

      if (location.protocol === 'http:')
        problemas.push('Contenido servido por HTTP: conviene HTTPS (confianza y SEO).')

      const lang = document.documentElement.getAttribute('lang')
      if (!lang) problemas.push('Falta atributo lang en <html> (accesibilidad y lectores de pantalla).')

      const imgs = [...document.querySelectorAll('img')]
      const sinAlt = imgs.filter(i => !(i.getAttribute('alt') ?? '').trim()).length
      if (imgs.length > 0 && sinAlt >= Math.ceil(imgs.length * 0.4))
        problemas.push(`Muchas imágenes sin atributo alt (${sinAlt}/${imgs.length}) (accesibilidad).`)

      let blankUnsafe = 0
      document.querySelectorAll('a[target="_blank"]').forEach(a => {
        if (!/\bnoopener\b/i.test(a.getAttribute('rel') || '')) blankUnsafe++
      })
      if (blankUnsafe > 0)
        problemas.push('Enlaces con target="_blank" sin rel="noopener" (seguridad y buenas prácticas).')

      const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim()
      if (bodyText.length < 180)
        problemas.push('Poco texto visible en portada: refuerza oferta y palabras clave (SEO y claridad).')

      if (problemas.length === 0)
        problemas.push('No se detectaron incidencias graves automáticas en la portada cargada.')

      oportunidades.push('Revisar contraste de botones y enlaces (WCAG), espaciado y tipografía para legibilidad (UX).')
      oportunidades.push('Unificar tono visual (logo, colores, botones) y repetir la propuesta de valor arriba del fold (branding).')
      if (!document.querySelector('link[rel="canonical"]'))
        oportunidades.push('Valorar etiqueta canonical si existen URLs duplicadas o parámetros (SEO técnico).')
      if (!md) oportunidades.push('Añadir meta descripción única orientada a conversión local.')

      return { problemas, oportunidades }
    })

    const extra: string[] = []
    if (status >= 400) extra.push(`Respuesta HTTP ${status} al cargar la URL.`)
    const problemasDetectados = [...extra, ...audit.problemas].join(' ')
    const oportunidades = [...new Set(audit.oportunidades)].join(' ')
    return { correo, problemasDetectados, oportunidades }
  } catch {
    return {
      correo: '',
      problemasDetectados:
        'No se pudo cargar el sitio web (timeout, bloqueo o error de red). No se completó la auditoría automática.',
      oportunidades:
        'Verificar que la URL sea correcta, que el servidor permita bots y valorar una auditoría manual de UX/UI, rendimiento (Core Web Vitals) y SEO técnico.',
    }
  } finally {
    await page?.context().close().catch(() => {})
  }
}

// ── Emisión incremental + tope de tiempo ────────────────────────────────────

export type ScrapeEmit = {
  timeUp: () => boolean
  full: () => boolean
  count: () => number
  hasEmitted: (dedupeKey: string) => boolean
  /** Amplía el plazo (p. ej. fallback Places tras Maps). */
  extendDeadline: (extraMs: number) => void
  /** `dedupeKey` debe ser estable y único por negocio (p. ej. URL normalizada de Maps). */
  tryEmit: (dedupeKey: string, n: Negocio) => boolean
}

export function createScrapeEmit(
  cantidad: number,
  deadlineAt: number,
  onNegocio: (n: Negocio) => void,
  opts?: { excludeBusinessKeys?: Set<string> },
): ScrapeEmit {
  const excludeBiz = opts?.excludeBusinessKeys ?? new Set<string>()
  const seen = new Set<string>()
  let c = 0
  let deadline = deadlineAt
  return {
    timeUp: () => Date.now() >= deadline,
    full: () => c >= cantidad,
    count: () => c,
    hasEmitted(dedupeKey: string) {
      return seen.has(dedupeKey.trim().toLowerCase())
    },
    extendDeadline(extraMs: number) {
      const add = Math.max(0, Math.floor(extraMs))
      deadline = Math.max(deadline, Date.now() + add)
    },
    tryEmit(dedupeKey: string, b: Negocio) {
      const k = dedupeKey.trim().toLowerCase()
      if (!b.nombre.trim() || !k || seen.has(k)) return false
      const fp = stableBusinessFingerprint(b)
      if (excludeBiz.has(fp)) return false
      seen.add(k)
      c++
      onNegocio(b)
      return true
    },
  }
}

// ── Source 1: Google Maps ─────────────────────────────────────────────────────
async function scrapeGoogleMaps(
  browser: Browser,
  categoria: string,
  ubicacion: string,
  cantidadSolicitada: number,
  emit: ScrapeEmit,
  log: (m: string) => void,
  visitedPlaceUrls: Set<string>,
  /** Intentos sin título por URL normalizada; evita bucles infinitos si Maps no hidrata. */
  placeTitleFailCounts: Map<string, number>,
  auditBudget: { n: number },
): Promise<void> {
  /** 3 pestañas en paralelo por defecto; `SCRAPE_MAPS_WORKERS=1` si Google limita mucho. */
  const workersHere = (() => {
    const raw = process.env.SCRAPE_MAPS_WORKERS?.trim()
    if (!raw) return 3
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? Math.min(4, Math.max(1, n)) : 3
  })()

  log('[scraper] Maps: nueva pestaña…')
  const listLocale = browserLocaleForUbicacion(ubicacion)
  const page = await newPage(browser, { locale: listLocale })
  try {
    const mapExtra = mapsSearchExtraParams(ubicacion)
    const listUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${categoria} en ${ubicacion}`)}${mapExtra}`
    log('[scraper] Maps: goto listado…')
    await page.goto(listUrl, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT_MS })
    if (emit.timeUp()) return
    await delay(1400, 2200)
    if (emit.timeUp()) return
    await dismissMapsOverlays(page, log)
    await delay(500, 900)
    if (emit.timeUp()) return

    const feedLoc = page.locator('[role="feed"]').first()
    const hintByPlaceKey = new Map<string, string>()
    let didAltListUrl = false
    const listUrlAltBase = `https://www.google.com/maps/search/${encodeURIComponent(`${categoria} ${ubicacion}`)}`
    const listUrlAlt = mapExtra
      ? `${listUrlAltBase}${mapExtra}`
      : `${listUrlAltBase}?hl=${listLocale.startsWith('en') ? 'en' : 'es-ES'}`

    const auditFallback = {
      correo: '',
      problemasDetectados:
        'Auditoría automática no disponible por tiempo o error; revisar el sitio manualmente.',
      oportunidades:
        'Completar revisión de UX/UI, jerarquía visual, copy y SEO on-page con herramientas externas.',
    }

    const processPlace = async (link: string) => {
      if (emit.timeUp() || emit.full()) return
      const placeKey = mapsPlaceDedupeKey(link)
      if (visitedPlaceUrls.has(placeKey)) return
      const dp = await newPage(browser, { locale: listLocale })
      try {
        const placeGotoMs = process.env.VERCEL ? 18_000 : 22_000
        await dp.goto(link, { waitUntil: NAV_WAIT, timeout: placeGotoMs })
        if (emit.timeUp()) return
        await dismissMapsOverlays(dp, log)
        await delay(process.env.VERCEL ? 700 : 550, process.env.VERCEL ? 1100 : 900)
        let nombre = (await extractMapsPlaceTitle(dp)).trim()
        if (!nombre) nombre = fallbackNombreFromMapsUrl(link)
        if (!nombre) {
          const fromFeed = cleanFeedHintName(hintByPlaceKey.get(placeKey) ?? '')
          if (fromFeed) nombre = fromFeed
        }
        if (!nombre) {
          const fails = (placeTitleFailCounts.get(placeKey) ?? 0) + 1
          placeTitleFailCounts.set(placeKey, fails)
          if (fails >= 2) visitedPlaceUrls.add(placeKey)
          log(`[scraper] Maps: sin nombre (intento ${fails}/2) ${placeKey.slice(0, 80)}`)
          return
        }
        const feedHint = hintByPlaceKey.get(placeKey) ?? ''
        const feedExtras = feedHint ? parseFeedHintExtras(feedHint) : { telefono: '', rawAddr: '' }

        const { direccionMaps, telefono, sitioWeb } = await extractMapsPlaceNap(dp)
        let contact = mergeContactFields(
          {
            ...splitDireccionResultado(direccionMaps || feedExtras.rawAddr, ubicacion),
            telefono: normalizePhoneText(telefono || feedExtras.telefono),
            sitioWeb: sitioWeb.trim(),
            correo: '',
          },
          {},
        )

        contact = await enrichContactFromPlacesApi(
          { mapsUrl: link, nombre, ubicacion, direccionMaps },
          contact,
        )

        const sw = contact.sitioWeb
        let correo = contact.correo
        let problemasDetectados: string
        let oportunidades: string
        if (mapsWantsDeepWebAudit() && sw && !isGoogleOwnedUrl(sw)) {
          if (auditBudget.n > 0) {
            auditBudget.n--
            const auditMs = process.env.VERCEL ? 4_800 : 6_500
            const r = await withTimeout(auditFromWebsite(browser, sw), auditMs, auditFallback)
            correo = r.correo || correo
            problemasDetectados = r.problemasDetectados
            oportunidades = r.oportunidades
          } else {
            const p = placeholderAuditPendiente()
            problemasDetectados = p.problemasDetectados
            oportunidades = p.oportunidades
          }
        } else {
          const p = placeholderAuditPendiente()
          problemasDetectados = p.problemasDetectados
          oportunidades = p.oportunidades
        }
        if (!correo.trim() && sw && scrapeWantsFetchEmailFromWeb() && !isGoogleOwnedUrl(sw)) {
          correo = await scrapeFetchEmailFromUrl(sw)
        }
        if (emit.timeUp()) return
        const emitted = emit.tryEmit(placeKey, {
          nombre: nombre.trim(),
          direccion: contact.direccion,
          ciudad: contact.ciudad,
          pais: contact.pais,
          telefono: contact.telefono,
          correo: correo.trim(),
          sitioWeb: sw,
          problemasDetectados,
          oportunidades,
          estado: 'Sin contactar',
        })
        if (emitted) visitedPlaceUrls.add(placeKey)
      } catch (e) {
        log(`[scraper] Maps: error ficha ${placeKey.slice(0, 80)} — ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        await dp.context().close().catch(() => {})
        await delay(120, 280)
      }
    }

    let stagnant = 0
    const stagnantLimit = () =>
      emit.count() < Math.max(4, Math.ceil(cantidadSolicitada * 0.45)) ? 36 : 22

    while (!emit.full() && !emit.timeUp() && stagnant < stagnantLimit()) {
      const hasFeed = (await page.locator('[role="feed"]').count()) > 0
      if (hasFeed) {
        await feedLoc.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
        await feedLoc.press('End').catch(() => {})
        await delay(280, 520)
        const scrollSteps = Math.min(56, Math.max(28, Math.ceil(cantidadSolicitada * 3.2)))
        for (let s = 0; s < scrollSteps && !emit.timeUp() && !emit.full(); s++) {
          await feedLoc.evaluate((el) => { (el as HTMLElement).scrollBy(0, 1600) }, { timeout: 3200 }).catch(() => {})
          await delay(180, 360)
        }
        await delay(500, 900)
      } else {
        log('[scraper] Maps: sin panel [role=feed]; scroll con rueda')
        for (let s = 0; s < 18 && !emit.timeUp(); s++) {
          await page.mouse.wheel(0, 1200)
          await delay(140, 300)
        }
      }

      const [links, feedHints] = await Promise.all([
        withTimeout(collectMapsPlaceLinks(page), 16_000, [] as string[]),
        withTimeout(collectFeedPlaceHints(page), 12_000, [] as FeedPlaceHint[]),
      ])
      for (const { href, hint } of feedHints) {
        const k = mapsPlaceDedupeKey(href)
        const cleaned = cleanFeedHintName(hint)
        if (cleaned && !hintByPlaceKey.has(k)) hintByPlaceKey.set(k, cleaned)
      }
      const linkSet = new Set<string>(links)
      for (const { href } of feedHints) {
        if (href.trim()) linkSet.add(href.trim())
      }
      const mergedLinks = [...linkSet]

      const fresh: string[] = []
      const seenInCycle = new Set<string>()
      for (const l of mergedLinks) {
        const k = mapsPlaceDedupeKey(l)
        if (visitedPlaceUrls.has(k) || seenInCycle.has(k)) continue
        seenInCycle.add(k)
        fresh.push(l)
      }

      log(
        `[scraper] Maps ciclo: crudos=${mergedLinks.length} hints=${feedHints.length} nuevos=${fresh.length} emitidos=${emit.count()}/${cantidadSolicitada} stagnant=${stagnant} workers=${workersHere}`,
      )

      if (fresh.length === 0) {
        stagnant++
        if (
          !didAltListUrl &&
          stagnant >= 8 &&
          emit.count() < Math.max(2, Math.ceil(cantidadSolicitada / 2))
        ) {
          didAltListUrl = true
          stagnant = 0
          log('[scraper] Maps: pocos enlaces; reintentando búsqueda alternativa…')
          await page.goto(listUrlAlt, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT_MS }).catch(() => {})
          await delay(1200, 2000)
          await dismissMapsOverlays(page, log)
        }
        await delay(700, 1300)
        continue
      }
      stagnant = 0

      let nextIdx = 0
      const runWorker = async () => {
        while (!emit.timeUp() && !emit.full()) {
          const i = nextIdx++
          if (i >= fresh.length) return
          await processPlace(fresh[i])
        }
      }
      const pool = Math.min(workersHere, Math.max(1, fresh.length))
      await Promise.all(
        Array.from({ length: pool }, (_, w) =>
          (async () => {
            if (w > 0) await delay(180 * w, 420 * w)
            await runWorker()
          })(),
        ),
      )

      if (!emit.full() && !emit.timeUp()) {
        await tryEmitLiteFromMapsFeed(emit, feedHints, ubicacion, log)
      }
    }
  } finally {
    await page.context().close().catch(() => {})
  }
}

/** Auditar web en Páginas Amarillas (lento). Igual que Maps, desactivado por defecto. */
function paWantsDeepWebAudit(): boolean {
  return process.env.SCRAPE_PA_WEB_AUDIT === '1'
}

// ── Source 2: directorio web (Páginas Amarillas) ─────────────────────────────
async function scrapePaginasAmarillas(
  browser: Browser,
  categoria: string,
  ubicacion: string,
  cantidad: number,
  emit: ScrapeEmit,
  log: (m: string) => void,
  auditBudget: { n: number },
): Promise<void> {
  log('[scraper] Páginas Amarillas: listado…')
  const page = await newPage(browser)
  try {
    await page.goto(`https://www.paginasamarillas.es/search/${encodeURIComponent(categoria)}/all-ma/all-pr/all-is/${encodeURIComponent(ubicacion)}/all-ba/all-pu/1`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT_MS })
    if (emit.timeUp()) return
    await delay(900, 1600)
    const listings = await page.$$('article.business-result-content, li.elem')
    const auditFallback = {
      correo: '',
      problemasDetectados:
        'Auditoría automática no disponible por tiempo o error; revisar el sitio manualmente.',
      oportunidades:
        'Completar revisión de UX/UI, jerarquía visual, copy y SEO on-page con herramientas externas.',
    }
    for (const listing of listings) {
      if (emit.timeUp() || emit.full()) break
      try {
        const nombre = await listing.$eval('a.business-result-title, h2 a, .title a', (el: Element) => el.textContent?.trim() ?? '').catch(() => '')
        const direccionListado = await listing.$eval('.address, address, .location', (el: Element) => el.textContent?.trim() ?? '').catch(() => '')
        const telefono = await listing.$eval('.phone, .telefonos, [class*="phone"]', (el: Element) => el.textContent?.trim() ?? '').catch(() => '')
        let sitioWeb = ''
        const webEl = await listing.$('a[href^="http"]:not([href*="paginasamarillas"])')
        if (webEl) sitioWeb = (await webEl.getAttribute('href')) ?? ''
        if (!nombre) continue
        const sw = sitioWeb.trim()
        let correo: string
        let problemasDetectados: string
        let oportunidades: string
        if (paWantsDeepWebAudit()) {
          if (!sw) {
            const r = await auditFromWebsite(browser, sitioWeb)
            correo = r.correo
            problemasDetectados = r.problemasDetectados
            oportunidades = r.oportunidades
          } else if (auditBudget.n > 0) {
            auditBudget.n--
            const r = await withTimeout(auditFromWebsite(browser, sitioWeb), 7_500, auditFallback)
            correo = r.correo
            problemasDetectados = r.problemasDetectados
            oportunidades = r.oportunidades
          } else {
            const p = placeholderAuditPendiente()
            correo = p.correo
            problemasDetectados = p.problemasDetectados
            oportunidades = p.oportunidades
          }
        } else {
          const p = placeholderAuditPendiente()
          correo = p.correo
          problemasDetectados = p.problemasDetectados
          oportunidades = p.oportunidades
        }
        if (
          !correo.trim() &&
          sw &&
          scrapeWantsFetchEmailFromWeb() &&
          !/^https?:\/\/(www\.)?google\./i.test(sw)
        ) {
          correo = await scrapeFetchEmailFromUrl(sw)
        }
        if (emit.timeUp()) break
        const { direccion, ciudad, pais } = splitDireccionResultado(direccionListado, ubicacion)
        const paKey = `pa|${nombre}|${telefono}|${sitioWeb}|${direccionListado}`.toLowerCase().slice(0, 400)
        emit.tryEmit(paKey, {
          nombre,
          direccion,
          ciudad,
          pais,
          telefono,
          correo,
          sitioWeb,
          problemasDetectados,
          oportunidades,
          estado: 'Sin contactar',
        })
      } catch { /* skip */ }
      await delay(180, 400)
    }
  } finally {
    await page.context().close().catch(() => {})
  }
}

/** Fallback cuando el scraping de Maps no devuelve filas (p. ej. anti-bot en Vercel). Requiere clave solo en servidor. */
async function scrapeGooglePlacesTextSearchApi(
  categoria: string,
  ubicacion: string,
  emit: ScrapeEmit,
  log: (m: string) => void,
): Promise<void> {
  const key =
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim()
  if (!key) return

  const query = `${categoria} ${ubicacion}`.replace(/\s+/g, ' ').trim()
  if (!query) return

  const before = emit.count()
  let nextPageToken: string | undefined

  for (let pageIdx = 0; pageIdx < 5 && !emit.full() && !emit.timeUp(); pageIdx++) {
    const u = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
    u.searchParams.set('query', query)
    u.searchParams.set('key', key)
    if (nextPageToken) u.searchParams.set('pagetoken', nextPageToken)

    let res: Response
    try {
      res = await fetch(u.toString(), { signal: AbortSignal.timeout(28_000) })
    } catch (e) {
      log(`[scraper] Places API: red ${e instanceof Error ? e.message : String(e)}`)
      return
    }
    if (!res.ok) {
      log(`[scraper] Places API HTTP ${res.status}`)
      return
    }
    const data = (await res.json()) as {
      status: string
      error_message?: string
      results?: { place_id?: string; name?: string; formatted_address?: string }[]
      next_page_token?: string
    }

    if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
      log(`[scraper] Places API ${data.status}: ${data.error_message ?? '(sin mensaje)'}`)
      return
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      await delay(2200, 2800)
      continue
    }
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      log(`[scraper] Places API status=${data.status}`)
      return
    }

    const rows = data.results ?? []
    for (const r of rows) {
      if (emit.timeUp() || emit.full()) return
      const pid = (r.place_id ?? '').trim()
      const name = (r.name ?? '').trim()
      if (!pid || !name) continue
      const dedupe = `gplaces|${pid}`
      const det = await fetchGooglePlaceDetailsResult(pid, key)
      const addrStr = (det?.formatted_address ?? r.formatted_address ?? '').trim()
      const { direccion, ciudad, pais } = splitDireccionResultado(addrStr, ubicacion)
      const telefono = (det?.international_phone_number ?? det?.formatted_phone_number ?? '').trim()
      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(pid)}`
      let sitioWeb = (det?.website ?? '').trim()
      if (!sitioWeb || isGoogleOwnedUrl(sitioWeb)) sitioWeb = mapsLink
      let correo = ''
      const webForMail = (det?.website ?? '').trim()
      if (webForMail && scrapeWantsFetchEmailFromWeb() && !/^https?:\/\/(www\.)?google\./i.test(webForMail))
        correo = await scrapeFetchEmailFromUrl(webForMail)
      const ph = placeholderAuditPendiente()
      emit.tryEmit(dedupe, {
        nombre: name,
        direccion,
        ciudad,
        pais,
        telefono,
        correo,
        sitioWeb,
        problemasDetectados: `Origen: Google Places (API). ${ph.problemasDetectados}`.trim(),
        oportunidades: ph.oportunidades,
        estado: 'Sin contactar',
      })
    }

    nextPageToken = data.next_page_token?.trim()
    if (!nextPageToken || rows.length === 0) break
    await delay(2100, 2600)
  }

  const gained = emit.count() - before
  if (gained > 0) log(`[scraper] Places API: +${gained} negocios (total ${emit.count()})`)
}

// ── Browser + orquestación ──────────────────────────────────────────────────

async function launchChromium(): Promise<Browser> {
  if (process.env.VERCEL) {
    // @sparticuz/chromium solo extrae al2/al2023 (libnss3, etc.) si cree que está en AWS Lambda.
    // En Vercel no hay AWS_* → hay que simularlo ANTES del primer import del paquete.
    const savedAws = process.env.AWS_EXECUTION_ENV
    const nodeMajor = Number(process.versions.node.split('.')[0])
    process.env.AWS_EXECUTION_ENV =
      nodeMajor >= 20 ? 'AWS_Lambda_nodejs20.x' : 'AWS_Lambda_nodejs18.x'
    try {
      const SpChromium = (await import('@sparticuz/chromium')).default
      const executablePath = await SpChromium.executablePath()
      const nssLib = nodeMajor >= 20 ? '/tmp/al2023/lib' : '/tmp/al2/lib'
      if (!process.env.LD_LIBRARY_PATH?.includes(nssLib)) {
        process.env.LD_LIBRARY_PATH = [nssLib, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')
      }
      return chromium.launch({
        args: [...SpChromium.args, '--disable-dev-shm-usage'],
        executablePath,
        headless: true,
        timeout: 60_000,
      })
    } finally {
      if (savedAws === undefined) delete process.env.AWS_EXECUTION_ENV
      else process.env.AWS_EXECUTION_ENV = savedAws
    }
  }
  return chromium.launch({
    headless: true,
    timeout: 60_000,
    args: ['--disable-dev-shm-usage', '--no-first-run', '--disable-extensions'],
  })
}

export type StreamScrapeReason = 'target_met' | 'timeout'

/**
 * Scrape con emisión incremental (`onNegocio`) y tope de tiempo `maxMs`.
 * Deja de añadir cuando se alcanza `cantidad` únicos o se cumple el plazo.
 */
export async function streamScrapeNegocios(
  categoria: string,
  ubicacion: string,
  cantidad: number,
  maxMs: number,
  onNegocio: (n: Negocio) => void,
  excludeBusinessKeys?: Set<string> | string[],
): Promise<{ reason: StreamScrapeReason; total: number; requested: number }> {
  const requested = Math.max(1, Math.min(100, cantidad))
  const deadline = Date.now() + maxMs
  const log = (m: string) => { console.log(m) }
  const excludeSet =
    excludeBusinessKeys == null
      ? undefined
      : excludeBusinessKeys instanceof Set
        ? excludeBusinessKeys
        : new Set(excludeBusinessKeys)
  const emit = createScrapeEmit(requested, deadline, onNegocio, {
    excludeBusinessKeys: excludeSet,
  })
  const visitedMapPlace = new Set<string>()
  const mapsPlaceTitleFails = new Map<string, number>()

  log(`[scraper] inicio — "${categoria}" / "${ubicacion}" (hasta ${requested}, máx ${Math.round(maxMs / 1000)}s)`)
  const tLaunch = Date.now()
  let browser: Browser
  try {
    browser = await Promise.race([
      launchChromium(),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('Chromium no arrancó en 60 s. Prueba: npx playwright install chromium')), 60_000)),
    ])
  } catch (e) {
    console.error('[scraper] fallo al lanzar Chromium:', e instanceof Error ? e.message : e)
    throw e
  }
  log(`[scraper] Chromium listo (+${Date.now() - tLaunch} ms)`)
  if (!mapsWantsDeepWebAudit()) {
    log(
      '[scraper] Modo rápido: sin auditoría web por negocio en Maps (ni PA). Más filas antes del timeout. Para auditar sitios: SCRAPE_MAPS_WEB_AUDIT=1 y/o SCRAPE_PA_WEB_AUDIT=1.',
    )
  }
  const placesKey = placesServerApiKey()
  let placesApiOk = false
  if (placesKey) {
    placesApiOk = await placesApiWorksOnServer(placesKey, log)
  } else {
    log(
      '[scraper] Sin GOOGLE_PLACES_API_KEY: teléfono, web y correo dependen del DOM de Maps. Añade la clave en .env.local.',
    )
  }

  try {
    const auditBudget = { n: auditBudgetForRun(requested) }

    if (placesApiOk && !emit.full()) {
      log('[scraper] Fase 1: Google Places API (datos completos)')
      await scrapeGooglePlacesTextSearchApi(categoria, ubicacion, emit, log).catch(err => {
        console.error('[scraper] Places API (fase 1) failed:', err instanceof Error ? err.message : err)
      })
      log(`[scraper] tras Places API → ${emit.count()}/${requested}`)
    }

    let round = 0
    while (!emit.full() && !emit.timeUp()) {
      round++
      log(`[scraper] ronda ${round} (hasta ${requested}, ${emit.count()} ya guardados)`)
      const before = emit.count()

      await scrapeGoogleMaps(
        browser,
        categoria,
        ubicacion,
        requested,
        emit,
        log,
        visitedMapPlace,
        mapsPlaceTitleFails,
        auditBudget,
      ).catch(err => {
        console.error('[scraper] Google Maps failed:', err instanceof Error ? err.message : err)
      })
      log(`[scraper] Maps → ${emit.count()} acumulado`)

      if (emit.full()) break

      if (emit.count() < requested) {
        log('[scraper] complemento: Páginas Amarillas (directorio web)')
        await scrapePaginasAmarillas(browser, categoria, ubicacion, requested - emit.count(), emit, log, auditBudget).catch(
          err => {
            console.error('[scraper] Páginas Amarillas failed:', err instanceof Error ? err.message : err)
          },
        )
      }
      log(`[scraper] tras directorio → ${emit.count()}`)

      const gained = emit.count() - before
      if (gained === 0) {
        log('[scraper] sin nuevos en esta ronda; pausa antes de repetir…')
        await delay(2000, 3800)
      } else {
        await delay(400, 900)
      }
    }

    if (placesApiOk && emit.count() < requested) {
      emit.extendDeadline(50_000)
      log('[scraper] Fase final: Google Places API (completar cupo)')
      await scrapeGooglePlacesTextSearchApi(categoria, ubicacion, emit, log).catch(err => {
        console.error('[scraper] Places API (fase final) failed:', err instanceof Error ? err.message : err)
      })
    }

    const total = emit.count()
    const reason: StreamScrapeReason = emit.full() ? 'target_met' : 'timeout'
    log(`[scraper] fin → ${total} negocios (${reason}, ${round} ronda(s))`)
    return { reason, total, requested }
  } finally {
    await browser.close().catch(() => {})
  }
}

/** Compatibilidad: acumula en memoria (mismo tope de tiempo que el streaming). */
export async function scrapeNegocios(categoria: string, ubicacion: string, cantidad: number): Promise<Negocio[]> {
  const acc: Negocio[] = []
  await streamScrapeNegocios(categoria, ubicacion, cantidad, SCRAPE_MAX_MS, n => acc.push(n))
  return acc
}
