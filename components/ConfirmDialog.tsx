'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, busy, onCancel])

  if (!open || !mounted) return null

  const dialog = (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Cerrar"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{message}</p>
        <ConfirmActions
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          confirmVariant={confirmVariant}
          busy={busy}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}

function ConfirmActions({
  cancelLabel,
  confirmLabel,
  confirmVariant,
  busy,
  onCancel,
  onConfirm,
}: {
  cancelLabel: string
  confirmLabel: string
  confirmVariant: 'danger' | 'primary'
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className={cn(
          'flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50',
          confirmVariant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700',
        )}
      >
        {busy ? '…' : confirmLabel}
      </button>
    </div>
  )
}
