'use client'

import { Link } from '@/i18n/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Settings } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { fetchMyProfile, upsertMyProfile, type ProfileRow } from '@/lib/supabase/profiles'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { cn } from '@/lib/utils'

function greetingName(profile: ProfileRow | null, email: string) {
  const a = (profile?.first_name ?? '').trim()
  const b = (profile?.last_name ?? '').trim()
  if (a || b) return [a, b].filter(Boolean).join(' ')
  return email
}

export function AuthNav() {
  const user = useSupabaseUser()
  const t = useTranslations('authNav')
  const tCommon = useTranslations('common')
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const loadProfile = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return
    const sb = createBrowserSupabaseClient()
    await upsertMyProfile(sb, user.id, user.email ?? '')
    const { data } = await fetchMyProfile(sb, user.id)
    setProfile(data)
  }, [user])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (user === undefined) {
    return <div className="h-9 w-24 rounded-md bg-neutral-200 dark:bg-neutral-700 animate-pulse" aria-hidden />
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
      >
        {t('signIn')}
      </Link>
    )
  }

  const name = greetingName(profile, user.email ?? 'Usuario')

  const handleLogout = async () => {
    if (!isSupabaseConfigured()) return
    setLogoutBusy(true)
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    setLogoutBusy(false)
    setLogoutOpen(false)
    window.location.href = '/'
  }

  return (
    <>
      <AuthNavMenu
        wrapRef={wrapRef}
        greeting={t('greeting', { name })}
        settingsLabel={t('settings')}
        logoutLabel={t('logout')}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        setLogoutOpen={setLogoutOpen}
      />

      <ConfirmDialog
        open={logoutOpen}
        title={t('logoutTitle')}
        message={t('logoutMessage')}
        confirmLabel={t('logoutConfirm')}
        cancelLabel={tCommon('cancel')}
        confirmVariant="danger"
        busy={logoutBusy}
        onConfirm={() => void handleLogout()}
        onCancel={() => setLogoutOpen(false)}
      />
    </>
  )
}

function AuthNavMenu({
  wrapRef,
  greeting,
  settingsLabel,
  logoutLabel,
  menuOpen,
  setMenuOpen,
  setLogoutOpen,
}: {
  wrapRef: React.RefObject<HTMLDivElement | null>
  greeting: string
  settingsLabel: string
  logoutLabel: string
  menuOpen: boolean
  setMenuOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  setLogoutOpen: (v: boolean) => void
}) {
  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setMenuOpen(v => !v)}
        className={cn(
          'flex items-center gap-1 max-w-[10rem] sm:max-w-[14rem] rounded-lg px-2 py-1.5 text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors',
          menuOpen && 'bg-neutral-100 dark:bg-neutral-800',
        )}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <span className="truncate">{greeting}</span>
        <ChevronDown size={14} className={cn('shrink-0 transition-transform', menuOpen && 'rotate-180')} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-[60] w-44 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg p-1.5 flex flex-col gap-1"
        >
          <Link
            href="/settings/perfil"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Settings size={14} className="shrink-0" />
            {settingsLabel}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              setLogoutOpen(true)
            }}
            className="w-full rounded-lg px-3 py-2 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 text-left"
          >
            {logoutLabel}
          </button>
        </div>
      )}
    </div>
  )
}
