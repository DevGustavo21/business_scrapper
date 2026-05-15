'use client'

export function SimpleInfoModal({
  open,
  title,
  message,
  primaryLabel = 'Entendido',
  onClose,
}: {
  open: boolean
  title: string
  message: string
  primaryLabel?: string
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-label="Cerrar" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  )
}
