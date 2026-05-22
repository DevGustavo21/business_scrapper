/**
 * Catálogo estático de ubicaciones que el scraper sabe expandir bien.
 * Se prioriza calidad sobre cantidad: cada entrada está alineada con
 * `expandSubRegions()` en `lib/scraper.ts` para que el autocompletado
 * sugiera exactamente lo que la búsqueda puede resolver con buenos resultados.
 */

export type LocationKind = 'country' | 'state' | 'city'

export type LocationSuggestion = {
  /** Etiqueta mostrada y enviada al scraper. */
  label: string
  kind: LocationKind
  /** Texto adicional para hacer match (siglas, traducciones, etc.). */
  hints?: string[]
}

const COUNTRIES: LocationSuggestion[] = [
  { label: 'España', kind: 'country', hints: ['spain', 'es'] },
  { label: 'México', kind: 'country', hints: ['mexico', 'mx'] },
  { label: 'Estados Unidos', kind: 'country', hints: ['usa', 'united states', 'us', 'eeuu'] },
  { label: 'Nicaragua', kind: 'country', hints: ['ni'] },
  { label: 'Costa Rica', kind: 'country', hints: ['cr'] },
  { label: 'Guatemala', kind: 'country', hints: ['gt'] },
  { label: 'Honduras', kind: 'country', hints: ['hn'] },
  { label: 'El Salvador', kind: 'country', hints: ['sv'] },
  { label: 'Panamá', kind: 'country', hints: ['pa', 'panama'] },
  { label: 'Colombia', kind: 'country', hints: ['co'] },
  { label: 'Argentina', kind: 'country', hints: ['ar'] },
  { label: 'Chile', kind: 'country', hints: ['cl'] },
  { label: 'Perú', kind: 'country', hints: ['peru', 'pe'] },
  { label: 'Ecuador', kind: 'country', hints: ['ec'] },
  { label: 'Venezuela', kind: 'country', hints: ['ve'] },
  { label: 'Uruguay', kind: 'country', hints: ['uy'] },
  { label: 'Paraguay', kind: 'country', hints: ['py'] },
  { label: 'Bolivia', kind: 'country', hints: ['bo'] },
  { label: 'Cuba', kind: 'country', hints: ['cu'] },
  { label: 'República Dominicana', kind: 'country', hints: ['republica dominicana', 'dominicana', 'do'] },
  { label: 'Puerto Rico', kind: 'country', hints: ['pr'] },
]

const US_STATES: LocationSuggestion[] = [
  { label: 'Florida, Estados Unidos', kind: 'state', hints: ['fl', 'florida'] },
  { label: 'Texas, Estados Unidos', kind: 'state', hints: ['tx'] },
  { label: 'California, Estados Unidos', kind: 'state', hints: ['ca'] },
  { label: 'New York, Estados Unidos', kind: 'state', hints: ['ny', 'nueva york'] },
  { label: 'Illinois, Estados Unidos', kind: 'state', hints: ['il'] },
  { label: 'Arizona, Estados Unidos', kind: 'state', hints: ['az'] },
  { label: 'Georgia, Estados Unidos', kind: 'state', hints: ['ga'] },
  { label: 'Washington, Estados Unidos', kind: 'state', hints: ['wa'] },
  { label: 'Massachusetts, Estados Unidos', kind: 'state', hints: ['ma'] },
  { label: 'Colorado, Estados Unidos', kind: 'state', hints: ['co'] },
]

const CITIES: LocationSuggestion[] = [
  // España
  { label: 'Madrid, España', kind: 'city' },
  { label: 'Barcelona, España', kind: 'city' },
  { label: 'Valencia, España', kind: 'city' },
  { label: 'Sevilla, España', kind: 'city' },
  { label: 'Zaragoza, España', kind: 'city' },
  { label: 'Málaga, España', kind: 'city' },
  { label: 'Bilbao, España', kind: 'city' },
  { label: 'Murcia, España', kind: 'city' },
  // México
  { label: 'Ciudad de México', kind: 'city', hints: ['cdmx', 'df', 'distrito federal'] },
  { label: 'Guadalajara, México', kind: 'city' },
  { label: 'Monterrey, México', kind: 'city' },
  { label: 'Puebla, México', kind: 'city' },
  { label: 'Tijuana, México', kind: 'city' },
  { label: 'Cancún, México', kind: 'city' },
  { label: 'León, México', kind: 'city' },
  { label: 'Mérida, México', kind: 'city' },
  // Estados Unidos · Florida
  { label: 'Miami, Florida', kind: 'city' },
  { label: 'Orlando, Florida', kind: 'city' },
  { label: 'Tampa, Florida', kind: 'city' },
  { label: 'Jacksonville, Florida', kind: 'city' },
  { label: 'Fort Lauderdale, Florida', kind: 'city' },
  { label: 'St. Petersburg, Florida', kind: 'city' },
  { label: 'Hialeah, Florida', kind: 'city' },
  { label: 'Tallahassee, Florida', kind: 'city' },
  // Estados Unidos · Texas
  { label: 'Houston, Texas', kind: 'city' },
  { label: 'Dallas, Texas', kind: 'city' },
  { label: 'Austin, Texas', kind: 'city' },
  { label: 'San Antonio, Texas', kind: 'city' },
  { label: 'Fort Worth, Texas', kind: 'city' },
  { label: 'El Paso, Texas', kind: 'city' },
  // Estados Unidos · California
  { label: 'Los Angeles, California', kind: 'city' },
  { label: 'San Francisco, California', kind: 'city' },
  { label: 'San Diego, California', kind: 'city' },
  { label: 'San Jose, California', kind: 'city' },
  { label: 'Sacramento, California', kind: 'city' },
  { label: 'Fresno, California', kind: 'city' },
  { label: 'Oakland, California', kind: 'city' },
  // Estados Unidos · NY
  { label: 'Manhattan, New York', kind: 'city' },
  { label: 'Brooklyn, New York', kind: 'city' },
  { label: 'Queens, New York', kind: 'city' },
  { label: 'Buffalo, New York', kind: 'city' },
  { label: 'Rochester, New York', kind: 'city' },
  // Estados Unidos · Illinois
  { label: 'Chicago, Illinois', kind: 'city' },
  { label: 'Aurora, Illinois', kind: 'city' },
  { label: 'Naperville, Illinois', kind: 'city' },
  { label: 'Springfield, Illinois', kind: 'city' },
  // Estados Unidos · Arizona
  { label: 'Phoenix, Arizona', kind: 'city' },
  { label: 'Tucson, Arizona', kind: 'city' },
  { label: 'Mesa, Arizona', kind: 'city' },
  { label: 'Scottsdale, Arizona', kind: 'city' },
  // Estados Unidos · Georgia
  { label: 'Atlanta, Georgia', kind: 'city' },
  { label: 'Savannah, Georgia', kind: 'city' },
  { label: 'Augusta, Georgia', kind: 'city' },
  { label: 'Columbus, Georgia', kind: 'city' },
  // Estados Unidos · Washington
  { label: 'Seattle, Washington', kind: 'city' },
  { label: 'Tacoma, Washington', kind: 'city' },
  { label: 'Spokane, Washington', kind: 'city' },
  { label: 'Bellevue, Washington', kind: 'city' },
  // Estados Unidos · Massachusetts
  { label: 'Boston, Massachusetts', kind: 'city' },
  { label: 'Cambridge, Massachusetts', kind: 'city' },
  { label: 'Worcester, Massachusetts', kind: 'city' },
  { label: 'Springfield, Massachusetts', kind: 'city' },
  // Estados Unidos · Colorado
  { label: 'Denver, Colorado', kind: 'city' },
  { label: 'Colorado Springs, Colorado', kind: 'city' },
  { label: 'Aurora, Colorado', kind: 'city' },
  { label: 'Boulder, Colorado', kind: 'city' },
  // Centroamérica
  { label: 'Managua, Nicaragua', kind: 'city' },
  { label: 'Granada, Nicaragua', kind: 'city' },
  { label: 'León, Nicaragua', kind: 'city' },
  { label: 'Matagalpa, Nicaragua', kind: 'city' },
  { label: 'Estelí, Nicaragua', kind: 'city' },
  { label: 'San José, Costa Rica', kind: 'city' },
  { label: 'Heredia, Costa Rica', kind: 'city' },
  { label: 'Alajuela, Costa Rica', kind: 'city' },
  { label: 'Cartago, Costa Rica', kind: 'city' },
  { label: 'Ciudad de Guatemala', kind: 'city', hints: ['guatemala'] },
  { label: 'Quetzaltenango, Guatemala', kind: 'city' },
  { label: 'Antigua Guatemala', kind: 'city' },
  { label: 'Tegucigalpa, Honduras', kind: 'city' },
  { label: 'San Pedro Sula, Honduras', kind: 'city' },
  { label: 'La Ceiba, Honduras', kind: 'city' },
  { label: 'San Salvador, El Salvador', kind: 'city' },
  { label: 'Santa Ana, El Salvador', kind: 'city' },
  { label: 'San Miguel, El Salvador', kind: 'city' },
  { label: 'Ciudad de Panamá', kind: 'city', hints: ['panama'] },
  { label: 'David, Panamá', kind: 'city' },
  { label: 'Colón, Panamá', kind: 'city' },
  // Sudamérica
  { label: 'Bogotá, Colombia', kind: 'city' },
  { label: 'Medellín, Colombia', kind: 'city' },
  { label: 'Cali, Colombia', kind: 'city' },
  { label: 'Cartagena, Colombia', kind: 'city' },
  { label: 'Barranquilla, Colombia', kind: 'city' },
  { label: 'Buenos Aires, Argentina', kind: 'city' },
  { label: 'Córdoba, Argentina', kind: 'city' },
  { label: 'Rosario, Argentina', kind: 'city' },
  { label: 'Mendoza, Argentina', kind: 'city' },
  { label: 'Santiago, Chile', kind: 'city' },
  { label: 'Valparaíso, Chile', kind: 'city' },
  { label: 'Concepción, Chile', kind: 'city' },
  { label: 'Viña del Mar, Chile', kind: 'city' },
  { label: 'Lima, Perú', kind: 'city' },
  { label: 'Arequipa, Perú', kind: 'city' },
  { label: 'Trujillo, Perú', kind: 'city' },
  { label: 'Chiclayo, Perú', kind: 'city' },
  { label: 'Quito, Ecuador', kind: 'city' },
  { label: 'Guayaquil, Ecuador', kind: 'city' },
  { label: 'Cuenca, Ecuador', kind: 'city' },
  { label: 'Caracas, Venezuela', kind: 'city' },
  { label: 'Maracaibo, Venezuela', kind: 'city' },
  { label: 'Valencia, Venezuela', kind: 'city' },
  { label: 'Montevideo, Uruguay', kind: 'city' },
  { label: 'Salto, Uruguay', kind: 'city' },
  { label: 'Paysandú, Uruguay', kind: 'city' },
  { label: 'Asunción, Paraguay', kind: 'city' },
  { label: 'Ciudad del Este, Paraguay', kind: 'city' },
  { label: 'Encarnación, Paraguay', kind: 'city' },
  { label: 'La Paz, Bolivia', kind: 'city' },
  { label: 'Santa Cruz, Bolivia', kind: 'city' },
  { label: 'Cochabamba, Bolivia', kind: 'city' },
  { label: 'La Habana, Cuba', kind: 'city' },
  { label: 'Santiago de Cuba', kind: 'city' },
  { label: 'Camagüey, Cuba', kind: 'city' },
  { label: 'Santo Domingo, República Dominicana', kind: 'city' },
  { label: 'Santiago de los Caballeros, República Dominicana', kind: 'city' },
  { label: 'Punta Cana, República Dominicana', kind: 'city' },
  { label: 'San Juan, Puerto Rico', kind: 'city' },
  { label: 'Ponce, Puerto Rico', kind: 'city' },
  { label: 'Bayamón, Puerto Rico', kind: 'city' },
]

const STATIC_LOCATIONS: LocationSuggestion[] = [...COUNTRIES, ...US_STATES, ...CITIES]

/** Catálogo estático curado (fallback rápido + ciudades para multi-query). */
export const STATIC_LOCATIONS_INDEX = buildIndex(STATIC_LOCATIONS)

type LocationIndex = {
  item: LocationSuggestion
  haystacks: string[]
}[]

/** Lowercase + sin diacríticos + caracteres "raros" colapsados. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s,.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildIndex(items: LocationSuggestion[]): LocationIndex {
  return items.map(item => ({
    item,
    haystacks: [normalize(item.label), ...(item.hints ?? []).map(normalize)],
  }))
}

/**
 * Devuelve sugerencias ordenadas por relevancia. Da prioridad a prefijos exactos,
 * luego a coincidencias internas. Bonifica país > estado > ciudad cuando empata.
 * Opcionalmente recibe un índice externo (catálogo remoto del endpoint).
 */
export function suggestLocations(
  query: string,
  limit = 8,
  index: LocationIndex = STATIC_LOCATIONS_INDEX,
): LocationSuggestion[] {
  const q = normalize(query)
  if (q.length < 1) return []

  const scored: { item: LocationSuggestion; score: number; seenKey: string }[] = []
  const seen = new Set<string>()
  for (const { item, haystacks } of index) {
    let best = -1
    for (const h of haystacks) {
      if (h === q) {
        best = Math.max(best, 1000)
      } else if (h.startsWith(q)) {
        best = Math.max(best, 700 - h.length)
      } else if (h.includes(q)) {
        best = Math.max(best, 300 - h.length)
      }
    }
    if (best < 0) continue
    const k = item.label.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    const typeBonus = item.kind === 'country' ? 8 : item.kind === 'state' ? 4 : 0
    scored.push({ item, score: best + typeBonus, seenKey: k })
  }
  scored.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
  return scored.slice(0, limit).map(x => x.item)
}

export function locationKindLabel(kind: LocationKind): string {
  if (kind === 'country') return 'País'
  if (kind === 'state') return 'Estado'
  return 'Ciudad'
}
