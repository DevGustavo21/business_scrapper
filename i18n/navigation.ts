import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Wrappers de `next/navigation` que entienden el locale activo.
 * Úsalos en lugar de `next/link` y `next/navigation` para que los
 * enlaces y `router.push(...)` mantengan el prefijo correcto.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
