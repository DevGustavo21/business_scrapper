'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Building2, Globe2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocationsCatalog } from '@/hooks/useLocationsCatalog'
import {
  STATIC_LOCATIONS_INDEX,
  buildIndex,
  locationKindLabel,
  suggestLocations,
  type LocationKind,
  type LocationSuggestion,
} from '@/lib/locations'

type Props = {
  id?: string
  value: string
  onChange: (v: string) => void
  /** Notifica cuando el usuario elige una sugerencia (vs. teclea libre). */
  onSelectSuggestion?: (item: LocationSuggestion) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Combobox de ubicación con dataset estático: países, estados de EE.UU.
 * y ciudades principales que el scraper sabe expandir bien. No consume cuota
 * de Google ni red; filtra en cliente con normalización (sin diacríticos).
 */
export function LocationAutocomplete({
  id,
  value,
  onChange,
  onSelectSuggestion,
  placeholder,
  disabled = false,
  className,
}: Props) {
  const rid = useId()
  const inputId = id ?? `loc-${rid}`
  const listboxId = `${inputId}-listbox`

  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  /** Bloquea el reapertura inmediata tras seleccionar con teclado/clic. */
  const justSelectedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  /** Catálogo remoto (REST Countries + CountriesNow) — `null` mientras carga. */
  const remote = useLocationsCatalog()

  /**
   * Índice combinado: catálogo estático curado (ciudades + países hispanos priorizados)
   * fusionado con el catálogo remoto del servidor. Si el remoto no llegó, basta el estático.
   */
  const mergedIndex = useMemo(() => {
    if (!remote) return STATIC_LOCATIONS_INDEX
    const dynamicItems: LocationSuggestion[] = [
      ...remote.countries.map(c => ({ label: c.label, kind: 'country' as const, hints: c.hints })),
      ...remote.states.map(s => ({ label: s.label, kind: 'state' as const, hints: s.hints })),
    ]
    return [...STATIC_LOCATIONS_INDEX, ...buildIndex(dynamicItems)]
  }, [remote])

  const suggestions = useMemo(() => {
    if (!value.trim()) return [] as LocationSuggestion[]
    return suggestLocations(value, 8, mergedIndex)
  }, [value, mergedIndex])

  /** Cerrar al hacer click fuera. */
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  /** Mantén la opción activa a la vista al navegar con teclado. */
  useEffect(() => {
    if (!open || activeIdx < 0) return
    const li = listRef.current?.children[activeIdx] as HTMLElement | undefined
    li?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, open])

  const commitSelection = useCallback(
    (item: LocationSuggestion) => {
      onChange(item.label)
      onSelectSuggestion?.(item)
      setOpen(false)
      setActiveIdx(-1)
      justSelectedRef.current = true
      inputRef.current?.focus()
    },
    [onChange, onSelectSuggestion],
  )

  const handleChange = (next: string) => {
    onChange(next)
    if (justSelectedRef.current) {
      justSelectedRef.current = false
      return
    }
    if (next.trim()) {
      setOpen(true)
      setActiveIdx(-1)
    } else {
      setOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (!open && suggestions.length > 0) setOpen(true)
      if (suggestions.length === 0) return
      e.preventDefault()
      setActiveIdx(i => (i + 1) % suggestions.length)
      return
    }
    if (e.key === 'ArrowUp') {
      if (suggestions.length === 0) return
      e.preventDefault()
      setActiveIdx(i => (i <= 0 ? suggestions.length - 1 : i - 1))
      return
    }
    if (e.key === 'Enter') {
      if (open && activeIdx >= 0 && suggestions[activeIdx]) {
        e.preventDefault()
        commitSelection(suggestions[activeIdx])
      }
      return
    }
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
        setActiveIdx(-1)
      }
      return
    }
    if (e.key === 'Tab' && open && activeIdx >= 0 && suggestions[activeIdx]) {
      commitSelection(suggestions[activeIdx])
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => {
          if (value.trim() && suggestions.length > 0) setOpen(true)
        }}
        onKeyDown={handleKeyDown}
        className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      />

      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-2 w-full max-h-72 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl shadow-black/5 dark:shadow-black/40 py-1"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.kind}-${s.label}`}
              id={`${listboxId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={e => {
                /** mousedown (no click) para no perder el focus antes de seleccionar. */
                e.preventDefault()
                commitSelection(s)
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                i === activeIdx
                  ? 'bg-indigo-50 dark:bg-indigo-950/40'
                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60',
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <KindIcon kind={s.kind} active={i === activeIdx} />
                <HighlightedText text={s.label} query={value} />
              </div>
              <span
                className={cn(
                  'shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full',
                  s.kind === 'country'
                    ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                    : s.kind === 'state'
                      ? 'bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                )}
              >
                {locationKindLabel(s.kind)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function KindIcon({ kind, active }: { kind: LocationKind; active: boolean }) {
  const cls = cn(
    'shrink-0',
    active ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400 dark:text-neutral-500',
  )
  if (kind === 'country') return <Globe2 size={16} className={cls} />
  if (kind === 'state') return <MapPin size={16} className={cls} />
  return <Building2 size={16} className={cls} />
}

/** Resalta la subcadena que coincide con la consulta (sin diacríticos). */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const matches = useMemo(() => findMatchRange(text, query), [text, query])
  if (!matches) {
    return <span className="truncate text-sm text-neutral-900 dark:text-neutral-100">{text}</span>
  }
  const [start, end] = matches
  return (
    <span className="truncate text-sm text-neutral-900 dark:text-neutral-100">
      {text.slice(0, start)}
      <mark className="bg-transparent font-semibold text-indigo-700 dark:text-indigo-300">
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </span>
  )
}

/** Encuentra el rango (start,end) del primer match de `query` en `text`, ignorando acentos. */
function findMatchRange(text: string, query: string): [number, number] | null {
  const q = query.trim()
  if (!q) return null
  const folded = stripDiacritics(text.toLowerCase())
  const needle = stripDiacritics(q.toLowerCase())
  const idx = folded.indexOf(needle)
  if (idx < 0) return null
  return [idx, idx + needle.length]
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
