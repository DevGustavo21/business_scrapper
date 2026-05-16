import type { Negocio, NegocioFila } from '@/types/business'

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Clave estable para lista negra y dedupe entre búsquedas del mismo rubro/ubicación. */
export function stableBusinessFingerprint(n: Pick<Negocio, 'nombre' | 'telefono' | 'correo' | 'direccion'>): string {
  const tel = norm(n.telefono).replace(/\D/g, '')
  const parts = [norm(n.nombre), tel, norm(n.correo), norm(n.direccion).slice(0, 120)]
  return parts.join('|')
}

export function normalizeSearchCategoryUbicacion(categoria: string, ubicacion: string): {
  categoria_norm: string
  ubicacion_norm: string
} {
  return {
    categoria_norm: norm(categoria),
    ubicacion_norm: norm(ubicacion),
  }
}

export function fingerprintNegocioFila(row: NegocioFila): string {
  return stableBusinessFingerprint(row)
}
