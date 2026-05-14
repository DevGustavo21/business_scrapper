'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'

/** `undefined` = aún cargando; `null` = no hay sesión. */
export function useSupabaseUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setUser(null)
      return
    }
    let cancelled = false
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUser(data.user ?? null)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return user
}
