import { chromium, type Browser, type Page } from 'playwright-core'
import { type Negocio, SCRAPE_MAX_MS } from '@/types/business'

/** SPAs como Maps casi nunca llegan a "networkidle". */
const NAV_WAIT: 'domcontentloaded' = 'domcontentloaded'
const NAV_TIMEOUT_MS = 28_000

const delay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min))

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Separa el texto de dirección típico de Maps/directorio (segmentos por comas)
 * en calle / ciudad / país. Heurística: con 3+ partes, última = país, penúltima = ciudad.
 */
function splitDireccionResultado(raw: string): { direccion: string; ciudad: string; pais: string } {
  const t = raw.replace(/\s+/g, ' ').trim()
  if (!t) return { direccion: '', ciudad: '', pais: '' }
  const parts = t.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length === 1) return { direccion: parts[0], ciudad: '', pais: '' }
  if (parts.length === 2) return { direccion: parts[0], ciudad: parts[1], pais: '' }
  const pais = parts[parts.length - 1] ?? ''
  const ciudad = parts[parts.length - 2] ?? ''
  const direccion = parts.slice(0, -2).join(', ')
  return { direccion, ciudad, pais }
}

// Bloqueo de assets por URL (evita globs complejos en page.route).
const ASSET_URL = /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot)(\?|#|$)/i

async function newPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    userAgent: USER_AGENT,
    locale: 'es-ES',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' },
  })
  const page = await ctx.newPage()
  await page.route(ASSET_URL, r => r.abort())
  return page
}

/** Misma ficha con distintos query params cuenta una sola vez para visitas / dedupe. */
function normalizeMapsPlaceUrl(href: string): string {
  try {
    const u = new URL(href)
    if (!u.pathname.includes('/maps/place/')) return href
    return `${u.origin}${u.pathname}`
  } catch {
    return href
  }
}

async function collectMapsPlaceLinks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const hrefs = [...document.querySelectorAll('a[href*="/maps/place/"]')]
      .map(a => (a as HTMLAnchorElement).href)
    const seen = new Set<string>()
    const out: string[] = []
    for (const h of hrefs) {
      if (seen.has(h)) continue
      seen.add(h)
      out.push(h)
      if (out.length >= 120) break
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
    const raw = await page.locator(sel).first().innerText({ timeout: 4500 }).catch(() => '')
    const trimmed = raw?.trim() ?? ''
    if (trimmed && !junk(trimmed)) return trimmed
  }
  await delay(700, 1200)
  const raw = await page.locator('h1').first().innerText({ timeout: 5000 }).catch(() => '')
  const trimmed = raw?.trim() ?? ''
  return junk(trimmed) ? '' : trimmed
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
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12_000 })
    await delay(280, 520)
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
  tryEmit: (n: Negocio) => boolean
}

export function createScrapeEmit(
  cantidad: number,
  deadlineAt: number,
  onNegocio: (n: Negocio) => void,
): ScrapeEmit {
  const seen = new Set<string>()
  let c = 0
  return {
    timeUp: () => Date.now() >= deadlineAt,
    full: () => c >= cantidad,
    count: () => c,
    tryEmit(b: Negocio) {
      const k = b.nombre.trim().toLowerCase()
      if (!k || seen.has(k)) return false
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
): Promise<void> {
  log('[scraper] Maps: nueva pestaña…')
  const page = await newPage(browser)
  try {
    const listUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${categoria} en ${ubicacion}`)}`
    log('[scraper] Maps: goto listado…')
    await page.goto(listUrl, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT_MS })
    if (emit.timeUp()) return
    await delay(2200, 3600)
    if (emit.timeUp()) return
    const feedLoc = page.locator('[role="feed"]').first()
    if ((await page.locator('[role="feed"]').count()) > 0) {
      const scrolls = Math.min(Math.max(Math.ceil(cantidadSolicitada * 1.2), 10), 22)
      for (let i = 0; i < scrolls && !emit.timeUp(); i++) {
        await feedLoc.evaluate((el) => { (el as HTMLElement).scrollBy(0, 600) }, { timeout: 4000 }).catch(() => {})
        await delay(400, 750)
      }
    }
    log('[scraper] Maps: extrayendo enlaces /maps/place/…')
    const links = await withTimeout(collectMapsPlaceLinks(page), 15_000, [] as string[])
    const freshLinks = links.filter(l => !visitedPlaceUrls.has(normalizeMapsPlaceUrl(l)))
    log(`[scraper] Maps: ${links.length} enlaces, ${freshLinks.length} aún no visitados`)
    for (const link of freshLinks) {
      if (emit.timeUp() || emit.full()) break
      const placeKey = normalizeMapsPlaceUrl(link)
      if (visitedPlaceUrls.has(placeKey)) continue
      const dp = await newPage(browser)
      try {
        await dp.goto(link, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT_MS })
        if (emit.timeUp()) break
        await delay(900, 1600)
        const nombre = await extractMapsPlaceTitle(dp)
        const direccionMaps = await dp.locator('[data-item-id="address"]').innerText()
          .catch(async () => dp.locator('button[data-tooltip="Copy address"]').innerText().catch(() => ''))
        const telefono = await dp.locator('[data-item-id^="phone"]').innerText()
          .catch(async () => dp.locator('button[data-tooltip="Copy phone number"]').innerText().catch(() => ''))
        let sitioWeb = ''
        const webEl = await dp.$('a[data-item-id="authority"]')
        if (webEl) sitioWeb = (await webEl.getAttribute('href')) ?? ''
        if (!nombre) {
          const fails = (placeTitleFailCounts.get(placeKey) ?? 0) + 1
          placeTitleFailCounts.set(placeKey, fails)
          if (fails >= 2) visitedPlaceUrls.add(placeKey)
          log(`[scraper] Maps: sin nombre (intento ${fails}/2) ${placeKey.slice(0, 80)}`)
          continue
        }
        const auditFallback = {
          correo: '',
          problemasDetectados:
            'Auditoría automática no disponible por tiempo o error; revisar el sitio manualmente.',
          oportunidades:
            'Completar revisión de UX/UI, jerarquía visual, copy y SEO on-page con herramientas externas.',
        }
        const { correo, problemasDetectados, oportunidades } = await withTimeout(
          auditFromWebsite(browser, sitioWeb),
          14_000,
          auditFallback,
        )
        if (emit.timeUp()) break
        const { direccion, ciudad, pais } = splitDireccionResultado(direccionMaps)
        emit.tryEmit({
          nombre: nombre.trim(),
          direccion,
          ciudad,
          pais,
          telefono: telefono.trim(),
          correo,
          sitioWeb,
          problemasDetectados,
          oportunidades,
          estado: 'Sin contactar',
        })
        visitedPlaceUrls.add(placeKey)
      } catch (e) {
        log(`[scraper] Maps: error ficha ${placeKey.slice(0, 80)} — ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        await dp.context().close().catch(() => {})
        await delay(400, 800)
      }
    }
  } finally {
    await page.context().close().catch(() => {})
  }
}

// ── Source 2: directorio web (Páginas Amarillas) ─────────────────────────────
async function scrapePaginasAmarillas(
  browser: Browser,
  categoria: string,
  ubicacion: string,
  cantidad: number,
  emit: ScrapeEmit,
  log: (m: string) => void,
): Promise<void> {
  log('[scraper] Páginas Amarillas: listado…')
  const page = await newPage(browser)
  try {
    await page.goto(`https://www.paginasamarillas.es/search/${encodeURIComponent(categoria)}/all-ma/all-pr/all-is/${encodeURIComponent(ubicacion)}/all-ba/all-pu/1`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT_MS })
    if (emit.timeUp()) return
    await delay(1500, 2600)
    const listings = await page.$$('article.business-result-content, li.elem')
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
        const auditFallback = {
          correo: '',
          problemasDetectados:
            'Auditoría automática no disponible por tiempo o error; revisar el sitio manualmente.',
          oportunidades:
            'Completar revisión de UX/UI, jerarquía visual, copy y SEO on-page con herramientas externas.',
        }
        const { correo, problemasDetectados, oportunidades } = await withTimeout(
          auditFromWebsite(browser, sitioWeb),
          14_000,
          auditFallback,
        )
        if (emit.timeUp()) break
        const { direccion, ciudad, pais } = splitDireccionResultado(direccionListado)
        emit.tryEmit({
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
      await delay(400, 800)
    }
  } finally {
    await page.context().close().catch(() => {})
  }
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
): Promise<{ reason: StreamScrapeReason; total: number; requested: number }> {
  const requested = Math.max(1, Math.min(100, cantidad))
  const deadline = Date.now() + maxMs
  const log = (m: string) => { console.log(m) }
  const emit = createScrapeEmit(requested, deadline, onNegocio)
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

  try {
    let round = 0
    while (!emit.full() && !emit.timeUp()) {
      round++
      log(`[scraper] ronda ${round} (hasta ${requested}, ${emit.count()} ya guardados)`)
      const before = emit.count()

      await scrapeGoogleMaps(browser, categoria, ubicacion, requested, emit, log, visitedMapPlace, mapsPlaceTitleFails).catch(err => {
        console.error('[scraper] Google Maps failed:', err instanceof Error ? err.message : err)
      })
      log(`[scraper] Maps → ${emit.count()} acumulado`)

      if (emit.full() || emit.timeUp()) break

      if (emit.count() < requested) {
        log('[scraper] complemento: Páginas Amarillas (directorio web)')
        await scrapePaginasAmarillas(browser, categoria, ubicacion, requested - emit.count(), emit, log).catch(err => {
          console.error('[scraper] Páginas Amarillas failed:', err instanceof Error ? err.message : err)
        })
      }
      log(`[scraper] tras directorio → ${emit.count()}`)

      const gained = emit.count() - before
      if (gained === 0) {
        log('[scraper] sin nuevos en esta ronda; pausa antes de repetir…')
        await delay(3500, 6000)
      } else {
        await delay(800, 1600)
      }
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
