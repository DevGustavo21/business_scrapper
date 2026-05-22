'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export type ObservationsValue = {
  problemasDetectados: string
  oportunidades: string
}

type Props = {
  value: ObservationsValue
  disabled?: boolean
  /**
   * Persiste el cambio. Recibe el snapshot actual. Devuelve error o null.
   * Si devuelve error, se muestra el mensaje en la UI.
   */
  onSave: (next: ObservationsValue) => Promise<{ error: Error | null }>
  /** Aviso visible cuando el usuario no puede guardar (no logueado / sin permisos). */
  disabledHint?: string
}

/**
 * Dos textareas (problemas detectados + oportunidades) con autoguardado debounced.
 * Pensado para que el equipo deje observaciones manuales sobre un negocio.
 */
export function EditableObservations({ value, disabled = false, onSave, disabledHint }: Props) {
  const [problemas, setProblemas] = useState(value.problemasDetectados)
  const [oportunidades, setOportunidades] = useState(value.oportunidades)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  /** Snapshot persistido para reconciliar tras props nuevos (carga desde DB). */
  const lastSavedRef = useRef<ObservationsValue>(value)
  const debounceRef = useRef<number | null>(null)
  const savedTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setProblemas(value.problemasDetectados)
    setOportunidades(value.oportunidades)
    lastSavedRef.current = value
    setStatus('idle')
    setErrorMsg(null)
  }, [value])

  const flush = useCallback(async () => {
    const snapshot: ObservationsValue = {
      problemasDetectados: problemas,
      oportunidades: oportunidades,
    }
    if (
      snapshot.problemasDetectados === lastSavedRef.current.problemasDetectados &&
      snapshot.oportunidades === lastSavedRef.current.oportunidades
    ) {
      return
    }
    setStatus('saving')
    setErrorMsg(null)
    const { error } = await onSave(snapshot)
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
      return
    }
    lastSavedRef.current = snapshot
    setStatus('saved')
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    savedTimerRef.current = window.setTimeout(() => {
      setStatus(prev => (prev === 'saved' ? 'idle' : prev))
    }, 1600)
  }, [problemas, oportunidades, onSave])

  const scheduleSave = useCallback(() => {
    if (disabled) return
    setStatus('dirty')
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      void flush()
    }, 900)
  }, [disabled, flush])

  useEffect(
    () => () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    },
    [],
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Observaciones del equipo
        </h2>
        <StatusBadge status={status} disabled={disabled} disabledHint={disabledHint} errorMsg={errorMsg} />
      </div>

      <Field
        label="Problemas detectados"
        placeholder="Qué hemos notado del negocio: sitio caído, sin redes, no contestan, no aceptan tarjeta, etc."
        value={problemas}
        disabled={disabled}
        onChange={v => {
          setProblemas(v)
          scheduleSave()
        }}
        onBlur={() => {
          if (debounceRef.current) window.clearTimeout(debounceRef.current)
          void flush()
        }}
      />

      <Field
        label="Oportunidades"
        placeholder="Qué podemos ofrecer: rediseño web, campaña local, automatizaciones, etc."
        value={oportunidades}
        disabled={disabled}
        onChange={v => {
          setOportunidades(v)
          scheduleSave()
        }}
        onBlur={() => {
          if (debounceRef.current) window.clearTimeout(debounceRef.current)
          void flush()
        }}
      />
    </div>
  )
}

function Field({
  label,
  placeholder,
  value,
  disabled,
  onChange,
  onBlur,
}: {
  label: string
  placeholder: string
  value: string
  disabled: boolean
  onChange: (v: string) => void
  onBlur: () => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</span>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2.5 text-sm leading-relaxed text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      />
    </label>
  )
}

function StatusBadge({
  status,
  disabled,
  disabledHint,
  errorMsg,
}: {
  status: SaveStatus
  disabled: boolean
  disabledHint?: string
  errorMsg: string | null
}) {
  if (disabled) {
    return (
      <span className="text-[11px] text-neutral-500 dark:text-neutral-500">
        {disabledHint ?? 'Solo lectura'}
      </span>
    )
  }
  if (status === 'saving' || status === 'dirty') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        <Loader2 size={12} className="animate-spin" />
        {status === 'saving' ? 'Guardando…' : 'Pendiente'}
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <Check size={12} />
        Guardado
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span
        title={errorMsg ?? 'Error al guardar'}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400"
      >
        <AlertCircle size={12} />
        Error al guardar
      </span>
    )
  }
  return null
}
