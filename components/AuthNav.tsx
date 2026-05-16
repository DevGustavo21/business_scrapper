'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { upsertMyProfile } from '@/lib/supabase/profiles'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'

export function AuthNav() {
  const user = useSupabaseUser()

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return
    const sb = createBrowserSupabaseClient()
    void upsertMyProfile(sb, user.id, user.email ?? '')
  }, [user])

  if (user === undefined) {
    return <div className="h-8 w-24 rounded-md bg-neutral-200 dark:bg-neutral-700 animate-pulse" aria-hidden />
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
      >
        Iniciar sesión
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link
        href="/settings/perfil"
        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 shrink-0"
      >
        Perfil
      </Link>
      <span className="hidden sm:inline text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[160px]">
        {user.email}
      </span>
      <button
        type="button"
        onClick={async () => {
          if (!isSupabaseConfigured()) return
          const supabase = createBrowserSupabaseClient()
          await supabase.auth.signOut()
          window.location.reload()
        }}
        className="text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        Salir
      </button>
    </div>
  )
}
