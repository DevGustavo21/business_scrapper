'use client'
import { useEffect } from 'react'
import { X, AlertCircle } from 'lucide-react'

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  const long = message.length > 120
  useEffect(() => {
    const ms = long ? 18_000 : 7000
    const t = setTimeout(onClose, ms)
    return () => clearTimeout(t)
  }, [onClose, long])
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 ${long ? 'max-w-lg' : 'max-w-sm'} px-4 py-3 rounded-xl shadow-lg bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 animate-in`}
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
      <p className="text-sm flex-1 leading-relaxed">{message}</p>
      <button type="button" onClick={onClose} className="shrink-0 text-red-400 hover:text-red-600 transition-colors">
        <X size={15} />
      </button>
    </div>
  )
}
