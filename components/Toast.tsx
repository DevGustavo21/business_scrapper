'use client'
import { useEffect } from 'react'
import { X, AlertCircle, CheckCircle } from 'lucide-react'

export function Toast({
  message,
  onClose,
  variant = 'error',
}: {
  message: string
  onClose: () => void
  variant?: 'error' | 'success'
}) {
  const long = message.length > 120
  useEffect(() => {
    const ms = variant === 'success' ? 5000 : long ? 18_000 : 7000
    const t = setTimeout(onClose, ms)
    return () => clearTimeout(t)
  }, [onClose, long, variant])
  const isSuccess = variant === 'success'
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 ${long ? 'max-w-lg' : 'max-w-sm'} px-4 py-3 rounded-xl shadow-lg animate-in ${
        isSuccess
          ? 'bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
          : 'bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
      }`}
    >
      {isSuccess ? (
        <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
      )}
      <p className="text-sm flex-1 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className={`shrink-0 transition-colors ${isSuccess ? 'text-emerald-500 hover:text-emerald-700' : 'text-red-400 hover:text-red-600'}`}
      >
        <X size={15} />
      </button>
    </div>
  )
}
