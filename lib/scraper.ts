import { chromium, type Browser, type Page } from 'playwright-core'
import { Negocio, SCRAPE_MAX_MS } from '@/types/business'

/** SPAs como Maps/Yelp casi nunca llegan a "networkidle". */
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

async function collectMapsPlaceLinks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const hrefs = [...document.querySelectorAll('a[href*="/maps/place/"]')]
      .map(a => (a as HTMLAnchorElement).href)
    return [...new Set(hrefs)].slice(0, 100)
  })
}

async function collectYelpBizLinks(page: Page, max: number): Promise<string[]> {
  return page.evaluate((lim: number) => {
    const hrefs = [...document.querySelectorAll('a[href*="/biz/"]')]
      .map(a => (a as HTMLAnchorElement).href)
      .filter(h => h.includes('/biz/') && !h.includes('?'))
    return [...new Set(hrefs)].slice(0, lim)
  }, max)
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

async function enrichFromWebsite(browser: Browser, sitioWeb: string): Promise<{ correo: string; nombreDueno: string }> {
  if (!sitioWeb) return { correo: '', nombreDueno: '' }
  let page: Page | null = null
  try {
    page = await newPage(browser)
    await page.goto(sitioWeb, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await delay(500, 1000)
    const correo = await extractEmail(page)
    let nombreDueno = ''
    const aboutLinks = await page.$$eval('a', els =>
      els.filter(a => /about|contact|nosotros|equipo|team/i.test(a.href + a.textContent))
        .map(a => a.href).slice(0, 2)
    )
    for (const link of aboutLinks) {
      try {
        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 10000 })
        await delay(400, 800)
        const body = await page.innerText('body').catch(() => '')
        const m = body.match(/(?:founder|owner|director|dueño|propietario|CEO)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/)
        if (m) { nombreDueno = m[1]; break }
      } catch { /* ignore */ }
    }
    return { correo, nombreDueno }
  } catch {
    return { correo: '', nombreDueno: '' }
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
): Promise<void> {
  log('[scraper] Maps: nueva pestaña…')
  const page = await newPage(browser)
  try {
    const listUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${categoria} en ${ubicacion}`)}`
    log('[scraper] Maps: goto listado…')
    await page.goto(listUrl, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT_MS })
    if (emit.timeUp()) return
    await delay(3500, 5500)
    if (emit.timeUp()) return
    const feedLoc = page.locator('[role="feed"]').first()
    if ((await page.locator('[role="feed"]').count()) > 0) {
      const scrolls = Math.min(Math.ceil(cantidadSolicitada / 6), 12)
      for (let i = 0; i < scrolls && !emit.timeUp(); i++) {
        await feedLoc.evaluate((el) => { (el as HTMLElement).scrollBy(0, 600) }, { timeout: 5000 }).catch(() => {})
        await delay(700, 1200)
      }
    }
    log('[scraper] Maps: extrayendo enlaces /maps/place/…')
    const links = await withTimeout(collectMapsPlaceLinks(page), 15_000, [] as string[])
    log(`[scraper] Maps: ${links.length} enlaces de fichas`)
    for (const link of links) {
      if (emit.timeUp() || emit.full()) break
      const dp = await newPage(browser)
      try {
        await dp.goto(link, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT_MS })
        if (emit.timeUp()) break
        await delay(2000, 3200)
        const nombre = await dp.locator('h1').first().innerText({ timeout: 8000 }).catch(() => '')
        const ubicacionText = await dp.locator('[data-item-id="address"]').innerText()
          .catch(async () => dp.locator('button[data-tooltip="Copy address"]').innerText().catch(() => ''))
        const telefono = await dp.locator('[data-item-id^="phone"]').innerText()
          .catch(async () => dp.locator('button[data-tooltip="Copy phone number"]').innerText().catch(() => ''))
        let sitioWeb = ''
        const webEl = await dp.$('a[data-item-id="authority"]')
        if (webEl) sitioWeb = (await webEl.getAttribute('href')) ?? ''
        if (!nombre) continue
        const { correo, nombreDueno } = await withTimeout(enrichFromWebsite(browser, sitioWeb), 12_000, { correo: '', nombreDueno: '' })
        if (emit.timeUp()) break
        emit.tryEmit({ nombre: nombre.trim(), ubicacion: ubicacionText.trim(), telefono: telefono.trim(), correo, sitioWeb, nombreDueno })
      } catch { /* skip */ } finally {
        await dp.context().close().catch(() => {})
        await delay(1000, 2000)
      }
    }
  } finally {
    await page.context().close().catch(() => {})
  }
}

// ── Source 2: Yelp ────────────────────────────────────────────────────────────
async function scrapeYelp(
  browser: Browser,
  categoria: string,
  ubicacion: string,
  cantidad: number,
  emit: ScrapeEmit,
  log: (m: string) => void,
): Promise<void> {
  const page = await newPage(browser)
  try {
    log('[scraper] Yelp: goto búsqueda…')
    await page.goto(`https://www.yelp.com/search?find_desc=${encodeURIComponent(categoria)}&find_loc=${encodeURIComponent(ubicacion)}`, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT_MS })
    if (emit.timeUp()) return
    await delay(2500, 4000)
    const links = await withTimeout(collectYelpBizLinks(page, cantidad), 15_000, [] as string[])
    log(`[scraper] Yelp: ${links.length} enlaces /biz/`)
    for (const link of links) {
      if (emit.timeUp() || emit.full()) break
      const dp = await newPage(browser)
      try {
        await dp.goto(link, { waitUntil: NAV_WAIT, timeout: NAV_TIMEOUT_MS })
        if (emit.timeUp()) break
        await delay(1800, 2800)
        const nombre = await dp.locator('h1').first().innerText({ timeout: 8000 }).catch(() => '')
        const ubicacionText = await dp.locator('address').first().innerText().catch(() => '')
        const telefono = await dp.locator('p:has-text("(") >> nth=0').innerText().catch(() => '')
        let sitioWeb = ''
        const webEl = await dp.$('a[href*="biz_redir"]')
        if (webEl) sitioWeb = (await webEl.getAttribute('href')) ?? ''
        if (!nombre) continue
        const { correo, nombreDueno } = await withTimeout(enrichFromWebsite(browser, sitioWeb), 12_000, { correo: '', nombreDueno: '' })
        if (emit.timeUp()) break
        emit.tryEmit({ nombre: nombre.trim(), ubicacion: ubicacionText.trim().replace(/\n/g, ', '), telefono: telefono.trim(), correo, sitioWeb, nombreDueno })
      } catch { /* skip */ } finally {
        await dp.context().close().catch(() => {})
        await delay(1000, 2000)
      }
    }
  } finally {
    await page.context().close().catch(() => {})
  }
}

// ── Source 3: Páginas Amarillas ───────────────────────────────────────────────
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
    await delay(2500, 4000)
    const listings = await page.$$('article.business-result-content, li.elem')
    for (const listing of listings) {
      if (emit.timeUp() || emit.full()) break
      try {
        const nombre = await listing.$eval('a.business-result-title, h2 a, .title a', (el: Element) => el.textContent?.trim() ?? '').catch(() => '')
        const ubicacionText = await listing.$eval('.address, address, .location', (el: Element) => el.textContent?.trim() ?? '').catch(() => '')
        const telefono = await listing.$eval('.phone, .telefonos, [class*="phone"]', (el: Element) => el.textContent?.trim() ?? '').catch(() => '')
        let sitioWeb = ''
        const webEl = await listing.$('a[href^="http"]:not([href*="paginasamarillas"])')
        if (webEl) sitioWeb = (await webEl.getAttribute('href')) ?? ''
        if (!nombre) continue
        const { correo, nombreDueno } = await withTimeout(enrichFromWebsite(browser, sitioWeb), 12_000, { correo: '', nombreDueno: '' })
        if (emit.timeUp()) break
        emit.tryEmit({ nombre, ubicacion: ubicacionText, telefono, correo, sitioWeb, nombreDueno })
      } catch { /* skip */ }
      await delay(800, 1500)
    }
  } finally {
    await page.context().close().catch(() => {})
  }
}

// ── Browser + orquestación ──────────────────────────────────────────────────

async function launchChromium(): Promise<Browser> {
  if (process.env.VERCEL) {
    const SpChromium = (await import('@sparticuz/chromium')).default
    SpChromium.setGraphicsMode = false
    const executablePath = await SpChromium.executablePath()
    return chromium.launch({
      args: [...SpChromium.args, '--disable-dev-shm-usage'],
      executablePath,
      headless: true,
      timeout: 60_000,
    })
  }
  return chromium.launch({
    headless: true,
    timeout: 60_000,
    args: ['--disable-dev-shm-usage', '--no-first-run', '--disable-extensions'],
  })
}

export type StreamScrapeReason = 'target_met' | 'timeout' | 'exhausted'

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
    await scrapeGoogleMaps(browser, categoria, ubicacion, requested, emit, log).catch(err => {
      console.error('[scraper] Google Maps failed:', err instanceof Error ? err.message : err)
    })
    log(`[scraper] Maps → ${emit.count()} filas`)

    if (!emit.timeUp() && !emit.full() && emit.count() < Math.ceil(requested * 0.5)) {
      log('[scraper] fallback Yelp')
      await scrapeYelp(browser, categoria, ubicacion, requested - emit.count(), emit, log).catch(err => {
        console.error('[scraper] Yelp failed:', err instanceof Error ? err.message : err)
      })
    }
    log(`[scraper] tras Yelp → ${emit.count()} filas`)

    if (!emit.timeUp() && !emit.full() && emit.count() < Math.ceil(requested * 0.5)) {
      log('[scraper] fallback Páginas Amarillas')
      await scrapePaginasAmarillas(browser, categoria, ubicacion, requested - emit.count(), emit, log).catch(err => {
        console.error('[scraper] Páginas Amarillas failed:', err instanceof Error ? err.message : err)
      })
    }

    const total = emit.count()
    let reason: StreamScrapeReason
    if (emit.full()) reason = 'target_met'
    else if (emit.timeUp()) reason = 'timeout'
    else reason = 'exhausted'
    log(`[scraper] fin → ${total} negocios (${reason})`)
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
