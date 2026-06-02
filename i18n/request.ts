import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'

/**
 * Loader de mensajes por request. Lo invoca `next-intl` en server components
 * a través de `getTranslations`, `getLocale`, etc.
 *
 * Si el `locale` no coincide con uno soportado caemos al `defaultLocale`
 * (en lugar de devolver `notFound()`), porque la app sigue funcionando
 * en inglés y preferimos un fallback visible a un 404 silencioso.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale

  const messages = (await import(`../messages/${locale}.json`)).default

  return {
    locale,
    messages,
  }
})
