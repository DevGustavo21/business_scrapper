'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { Toast } from '@/components/Toast'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import {
  fetchMyProfile,
  updateMyProfileDetails,
  uploadMyAvatar,
  removeMyAvatarFiles,
  type ProfileRow,
} from '@/lib/supabase/profiles'

const inputClass =
  'mt-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 w-full max-w-lg'

function PerfilInner() {
  const user = useSupabaseUser()
  const fileRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loggedIn = Boolean(user && isSupabaseConfigured())

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    const sb = createBrowserSupabaseClient()
    const { data, error: e } = await fetchMyProfile(sb, user.id)
    if (e) setError(e.message)
    setProfile(data)
    setFirstName(data?.first_name ?? '')
    setLastName(data?.last_name ?? '')
    setCompany(data?.company ?? '')
    setPhone(data?.phone ?? '')
    setAvatarUrl(data?.avatar_url ?? null)
    setPendingFile(null)
    setPreviewUrl(null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let created: string | null = null
    if (pendingFile) {
      created = URL.createObjectURL(pendingFile)
      setPreviewUrl(created)
    } else {
      setPreviewUrl(null)
    }
    return () => {
      if (created) URL.revokeObjectURL(created)
    }
  }, [pendingFile])

  const displayAvatar = previewUrl || avatarUrl

  const pickFile = () => fileRef.current?.click()

  const save = async () => {
    if (!user || !isSupabaseConfigured()) return
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    const sb = createBrowserSupabaseClient()
    let nextAvatar = avatarUrl
    if (pendingFile) {
      const { publicUrl, error: upErr } = await uploadMyAvatar(sb, user.id, pendingFile)
      if (upErr) {
        setError(upErr.message)
        setSaving(false)
        return
      }
      nextAvatar = publicUrl
    }
    const { error: uErr } = await updateMyProfileDetails(sb, user.id, {
      first_name: firstName || null,
      last_name: lastName || null,
      company: company || null,
      phone: phone || null,
      avatar_url: nextAvatar,
    })
    setSaving(false)
    if (uErr) {
      setError(uErr.message)
      return
    }
    setPendingFile(null)
    setAvatarUrl(nextAvatar)
    await load()
    setSuccessMessage('Tu perfil se actualizó correctamente.')
  }

  const clearPhoto = async () => {
    if (!user || !isSupabaseConfigured()) return
    setPendingFile(null)
    setPreviewUrl(null)
    setAvatarUrl(null)
    const sb = createBrowserSupabaseClient()
    await removeMyAvatarFiles(sb, user.id)
    const { error: uErr } = await updateMyProfileDetails(sb, user.id, {
      first_name: firstName || null,
      last_name: lastName || null,
      company: company || null,
      phone: phone || null,
      avatar_url: null,
    })
    if (uErr) setError(uErr.message)
    else {
      setSuccessMessage('Foto de perfil eliminada. Los demás datos se mantienen guardados.')
      await load()
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-400">Cuenta</p>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Perfil</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Completa tus datos. Si subes una foto, se usará en los avatares del chat cuando otros colaboren contigo en
            listas o búsquedas.
          </p>
        </div>
        <Link href="/" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline w-fit">
          ← Inicio
        </Link>

        {!loggedIn && (
          <p className="text-sm text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <Link href="/login" className="underline font-semibold">
              Inicia sesión
            </Link>{' '}
            para editar tu perfil.
          </p>
        )}

        {loggedIn && loading && <p className="text-sm text-neutral-500">Cargando…</p>}

        {loggedIn && !loading && (
          <form
            className="flex flex-col gap-6 max-w-lg"
            onSubmit={e => {
              e.preventDefault()
              void save()
            }}
          >
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 mb-2">Foto de perfil</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs text-neutral-500">
                  {displayAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    'Sin foto'
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f && f.size > 5 * 1024 * 1024) {
                        setSuccessMessage(null)
                        setError('La imagen no debe superar 5 MB.')
                        return
                      }
                      setPendingFile(f ?? null)
                    }}
                  />
                  <button
                    type="button"
                    onClick={pickFile}
                    className="rounded-lg px-3 py-2 text-xs font-semibold border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 w-fit"
                  >
                    Elegir imagen
                  </button>
                  {(avatarUrl || pendingFile) && (
                    <button
                      type="button"
                      onClick={() => void clearPhoto()}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline w-fit"
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-neutral-500">JPG, PNG, Webp o GIF. Máx. 5 MB.</p>
            </div>

            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Nombre
              <input className={inputClass} value={firstName} onChange={e => setFirstName(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Apellido
              <input className={inputClass} value={lastName} onChange={e => setLastName(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Empresa
              <input className={inputClass} value={company} onChange={e => setCompany(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Correo electrónico
              <input
                className={inputClass + ' opacity-80 cursor-not-allowed'}
                readOnly
                value={user?.email ?? profile?.email ?? ''}
              />
              <span className="mt-1 block text-[11px] text-neutral-500">
                Viene de tu cuenta de acceso (Google). Para cambiarlo, usa la configuración de tu proveedor de identidad.
              </span>
            </label>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Teléfono
              <input
                className={inputClass}
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+34 …"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 w-fit"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        )}
      </main>
      {error && <Toast message={error} variant="error" onClose={() => setError(null)} />}
      {successMessage && (
        <Toast message={successMessage} variant="success" onClose={() => setSuccessMessage(null)} />
      )}
    </div>
  )
}

export default function PerfilPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Cargando…</div>}
    >
      <PerfilInner />
    </Suspense>
  )
}
