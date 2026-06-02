import { defineRouting } from 'next-intl/routing'

/**
 * Configuración central de rutas localizadas.
 *
 * Idiomas soportados: `en` (default) y `es`.
 * Estrategia: prefijo siempre visible (`/en/...`, `/es/...`). Esto evita
 * ambigüedad y simplifica SEO.
 */
export const routing = defineRouting({
  locales: ['en', 'es'] as const,
  defaultLocale: 'en',
  localePrefix: 'always',
  /**
   * Las **claves** son los slugs internos (coinciden con los directorios bajo
   * `app/[locale]/...`) y los **valores** son los slugs públicos por idioma.
   *
   * Para mantener una sola fuente de verdad de las palabras traducidas se
   * exporta también `SEGMENT_TRANSLATIONS` con cada segmento estático que
   * cambia entre idiomas; lo usa el `LocaleSwitcher` para mapear la URL
   * actual al otro idioma sin tener que parsear `pathnames` completo.
   */
  pathnames: {
    '/': '/',
    '/login': '/login',
    '/auth/auth-code-error': '/auth/auth-code-error',
    '/agregar-prospectos': {
      en: '/add-prospects',
      es: '/agregar-prospectos',
    },
    '/busqueda-compartida/[searchId]': {
      en: '/shared-search/[searchId]',
      es: '/busqueda-compartida/[searchId]',
    },
    '/busqueda/[searchId]/negocio/[rowId]': {
      en: '/search/[searchId]/business/[rowId]',
      es: '/busqueda/[searchId]/negocio/[rowId]',
    },
    '/carpetas': {
      en: '/folders',
      es: '/carpetas',
    },
    '/clientes-prospectos': {
      en: '/client-prospects',
      es: '/clientes-prospectos',
    },
    '/compartido': {
      en: '/shared',
      es: '/compartido',
    },
    '/lista/[listId]': {
      en: '/list/[listId]',
      es: '/lista/[listId]',
    },
    '/listas-prospectos': {
      en: '/prospect-lists',
      es: '/listas-prospectos',
    },
    '/precios': {
      en: '/price',
      es: '/precios',
    },
    '/prospecto/[id]': {
      en: '/prospect/[id]',
      es: '/prospecto/[id]',
    },
    '/settings/lista-negra': {
      en: '/settings/blacklist',
      es: '/settings/lista-negra',
    },
    '/settings/perfil': {
      en: '/settings/profile',
      es: '/settings/perfil',
    },
  },
  /**
   * Cookie en la que persistimos la preferencia del usuario.
   * `next-intl` la lee/escribe automáticamente cuando se usa su Link/router.
   */
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365, // 1 año
  },
})

export type AppLocale = (typeof routing.locales)[number]

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (routing.locales as readonly string[]).includes(value)
}

/**
 * Tabla de **segmentos** traducidos (no rutas completas) que aparece en algún
 * `pathnames`. La usamos para reconstruir la URL del otro idioma a partir
 * del pathname actual, segmento por segmento. Sólo aparecen segmentos que
 * cambian; el resto del path (incluidos los dinámicos como `abc-123`) se
 * preserva tal cual.
 */
export const SEGMENT_TRANSLATIONS: Record<string, Record<AppLocale, string>> = {
  'add-prospects': { en: 'add-prospects', es: 'agregar-prospectos' },
  'agregar-prospectos': { en: 'add-prospects', es: 'agregar-prospectos' },
  blacklist: { en: 'blacklist', es: 'lista-negra' },
  'lista-negra': { en: 'blacklist', es: 'lista-negra' },
  business: { en: 'business', es: 'negocio' },
  negocio: { en: 'business', es: 'negocio' },
  'client-prospects': { en: 'client-prospects', es: 'clientes-prospectos' },
  'clientes-prospectos': { en: 'client-prospects', es: 'clientes-prospectos' },
  folders: { en: 'folders', es: 'carpetas' },
  carpetas: { en: 'folders', es: 'carpetas' },
  list: { en: 'list', es: 'lista' },
  lista: { en: 'list', es: 'lista' },
  price: { en: 'price', es: 'precios' },
  precios: { en: 'price', es: 'precios' },
  profile: { en: 'profile', es: 'perfil' },
  perfil: { en: 'profile', es: 'perfil' },
  'prospect-lists': { en: 'prospect-lists', es: 'listas-prospectos' },
  'listas-prospectos': { en: 'prospect-lists', es: 'listas-prospectos' },
  prospect: { en: 'prospect', es: 'prospecto' },
  prospecto: { en: 'prospect', es: 'prospecto' },
  search: { en: 'search', es: 'busqueda' },
  busqueda: { en: 'search', es: 'busqueda' },
  shared: { en: 'shared', es: 'compartido' },
  compartido: { en: 'shared', es: 'compartido' },
  'shared-search': { en: 'shared-search', es: 'busqueda-compartida' },
  'busqueda-compartida': { en: 'shared-search', es: 'busqueda-compartida' },
}

/**
 * Devuelve la URL equivalente en `nextLocale` para un `pathname` localizado
 * (sin prefijo de locale). Traduce los segmentos estáticos conocidos y
 * preserva todo lo demás (incluidos los segmentos dinámicos).
 */
export function translatePathname(pathname: string, nextLocale: AppLocale): string {
  const segments = pathname.split('/')
  const translated = segments.map(segment => {
    if (!segment) return segment
    const entry = SEGMENT_TRANSLATIONS[segment]
    return entry ? entry[nextLocale] : segment
  })
  return translated.join('/')
}
