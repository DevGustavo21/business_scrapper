import type { Negocio, NegocioFila } from '@/types/business'

export function normalizeNegocios(raw: unknown): NegocioFila[] {
  if (!Array.isArray(raw)) return []
  return raw.map((n, i) => {
    const o = n as Partial<NegocioFila>
    const id =
      typeof o.id === 'string' && o.id
        ? o.id
        : typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `row-${i}-${Date.now()}`
    return { ...(o as Negocio), id }
  })
}
