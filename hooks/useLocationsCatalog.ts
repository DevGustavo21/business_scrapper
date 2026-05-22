'use client'

import { useEffect, useState } from 'react'

export type RemoteLocation = { label: string; hints: string[] }
export type LocationsCatalog = {
  countries: RemoteLocation[]
  states: RemoteLocation[]
  generatedAt: string
}

/** Caché de módulo: una sola descarga por sesión, compartida entre componentes. */
let cachedCatalog: LocationsCatalog | null = null
let inflight: Promise<LocationsCatalog | null> | null = null

async function loadCatalog(): Promise<LocationsCatalog | null> {
  if (cachedCatalog) return cachedCatalog
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch('/api/locations', { cache: 'force-cache' })
      if (!res.ok) return null
      const data = (await res.json()) as LocationsCatalog
      if (!Array.isArray(data.countries) || !Array.isArray(data.states)) return null
      cachedCatalog = data
      return data
    } catch {
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/**
 * Devuelve el catálogo remoto (países + estados). Mientras carga devuelve `null`
 * para que el componente caiga al dataset estático local.
 */
export function useLocationsCatalog(): LocationsCatalog | null {
  const [catalog, setCatalog] = useState<LocationsCatalog | null>(cachedCatalog)

  useEffect(() => {
    if (catalog) return
    let alive = true
    void loadCatalog().then(c => {
      if (alive && c) setCatalog(c)
    })
    return () => {
      alive = false
    }
  }, [catalog])

  return catalog
}
