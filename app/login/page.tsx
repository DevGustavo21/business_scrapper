'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Building2 } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'

function LoginForm() {
  const searchParams = useSearchParams()
  const err = searchParams.get('error')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(
    err === 'config'
      ? 'Faltan variables de Supabase en el servidor (.env.local). Revisa la documentación del proyecto.'
      : null,
  )

  async function signInWithGoogle() {
    if (!isSupabaseConfigured()) {
      setMessage('Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setMessage('No se obtuvo URL de inicio de sesión.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error al iniciar sesión.')
    }
    setLoading(false)
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Cada usuario tendrá su perfil. Pronto podrás guardar búsquedas en la base de datos (Supabase).
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-6 shadow-sm flex flex-col gap-4">
        {!isSupabaseConfigured() && (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            Añade en <code className="font-mono">.env.local</code> las variables públicas de Supabase y activa el proveedor
            Google en el panel de Supabase (Authentication → Providers).
          </p>
        )}
        {message && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
            {message}
          </p>
        )}
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 font-medium text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? 'Redirigiendo…' : 'Continuar con Google'}
        </button>
      </div>

      <p className="text-center text-xs text-neutral-500 dark:text-neutral-500">
        Al continuar aceptas las condiciones de Google y las políticas que configures en Supabase.
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-[--color-background]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Building2 size={14} className="text-white" />
            </div>
            <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">Business Prospector</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <Suspense fallback={<div className="text-neutral-500 text-sm">Cargando…</div>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  )
}
