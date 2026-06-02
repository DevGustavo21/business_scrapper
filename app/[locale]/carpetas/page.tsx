'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FolderOpen, Share2, Trash2 } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { ShareResourceDialog } from '@/components/ShareResourceDialog'
import { Toast } from '@/components/Toast'
import { useSupabaseUser } from '@/hooks/useSupabaseUser'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import {
  createSearchFolder,
  deleteSearchFolder,
  listFolderSearchIds,
  listSearchFoldersForUser,
  removeSearchFromFolder,
  renameSearchFolder,
} from '@/lib/supabase/collaboration'
import { listProspectSearchesByIds } from '@/lib/supabase/prospectSearches'
import type { SearchFolderRow } from '@/types/collaboration'
import type { ProspectSearchListItem } from '@/types/prospect-search'

function CarpetasPageInner() {
  const t = useTranslations('folders')
  const user = useSupabaseUser()
  const searchParams = useSearchParams()
  const folderParam = searchParams.get('folder')

  const [folders, setFolders] = useState<SearchFolderRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searches, setSearches] = useState<ProspectSearchListItem[]>([])
  const [newFolderName, setNewFolderName] = useState('')
  const [rename, setRename] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [folderAbility, setFolderAbility] = useState<'owner' | 'editor' | 'viewer'>('viewer')

  const loggedIn = Boolean(user && isSupabaseConfigured())

  const selected = useMemo(() => folders.find(f => f.id === selectedId) ?? null, [folders, selectedId])
  const isOwner = Boolean(selected && user && selected.owner_id === user.id)
  const canEditFolderItems = folderAbility === 'owner' || folderAbility === 'editor'
  const canInviteToFolder = folderAbility === 'owner' || folderAbility === 'editor'

  const loadFolders = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) {
      setFolders([])
      setLoading(false)
      return
    }
    setLoading(true)
    const sb = createBrowserSupabaseClient()
    const { data, error: err } = await listSearchFoldersForUser(sb, user.id)
    if (err) setError(err.message)
    else {
      setError(null)
      setFolders(data)
      setSelectedId(prev => {
        if (folderParam && data.some(f => f.id === folderParam)) return folderParam
        if (prev && data.some(f => f.id === prev)) return prev
        return data[0]?.id ?? null
      })
    }
    setLoading(false)
  }, [user, folderParam])

  const loadSearchesInFolder = useCallback(
    async (folderId: string) => {
      const sb = createBrowserSupabaseClient()
      const { ids, error: e1 } = await listFolderSearchIds(sb, folderId)
      if (e1) {
        setSearches([])
        setError(e1.message)
        return
      }
      const { data, error: e2 } = await listProspectSearchesByIds(sb, ids)
      if (e2) setSearches([])
      else setSearches(data ?? [])
      if (e2) setError(e2.message)
    },
    [],
  )

  useEffect(() => {
    void loadFolders()
  }, [loadFolders])

  useEffect(() => {
    if (!selectedId) {
      setSearches([])
      return
    }
    void loadSearchesInFolder(selectedId)
  }, [selectedId, loadSearchesInFolder])

  useEffect(() => {
    if (folderParam && folders.some(f => f.id === folderParam)) setSelectedId(folderParam)
  }, [folderParam, folders])

  useEffect(() => {
    if (!selected || !user) return
    if (selected.owner_id === user.id) {
      setFolderAbility('owner')
      return
    }
    const sb = createBrowserSupabaseClient()
    void sb
      .from('collaboration_members')
      .select('role')
      .eq('resource_type', 'search_folder')
      .eq('resource_id', selected.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFolderAbility(data?.role === 'editor' ? 'editor' : 'viewer')
      })
  }, [selected, user])

  const handleCreate = async () => {
    if (!user || !newFolderName.trim()) return
    const sb = createBrowserSupabaseClient()
    const { folder, error: err } = await createSearchFolder(sb, user.id, newFolderName.trim())
    if (err || !folder) setError(err?.message ?? t('genericError'))
    else {
      setNewFolderName('')
      await loadFolders()
      setSelectedId(folder.id)
    }
  }

  const handleRename = async () => {
    if (!selectedId || !rename.trim()) return
    const sb = createBrowserSupabaseClient()
    const { error: err } = await renameSearchFolder(sb, selectedId, rename.trim())
    if (err) setError(err.message)
    else {
      setRename('')
      await loadFolders()
    }
  }

  const handleDeleteFolder = async () => {
    if (!selectedId || !isOwner) return
    if (!window.confirm(t('deleteConfirm'))) return
    const sb = createBrowserSupabaseClient()
    const { error: err } = await deleteSearchFolder(sb, selectedId)
    if (err) setError(err.message)
    else {
      setSelectedId(null)
      await loadFolders()
    }
  }

  const handleRemoveSearch = async (searchId: string) => {
    if (!selectedId) return
    const sb = createBrowserSupabaseClient()
    const { error: err } = await removeSearchFromFolder(sb, selectedId, searchId)
    if (err) setError(err.message)
    else await loadSearchesInFolder(selectedId)
  }

  useEffect(() => {
    if (selected) setRename(selected.name)
  }, [selected])

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FolderOpen className="text-indigo-600" />
              {t('title')}
            </h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
              {t('subtitle')}
            </p>
          </div>
          <Link href="/" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">
            {t('back')}
          </Link>
        </div>

        {!loggedIn && (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
            <Link href="/login" className="font-semibold underline">
              {t('loginPrefix')}
            </Link>{' '}
            {t('loginSuffix')}
          </p>
        )}

        {loggedIn && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[420px]">
            <section className="lg:col-span-4 flex flex-col gap-3 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-neutral-50/50 dark:bg-neutral-950/40">
              <span className="text-xs font-semibold uppercase text-neutral-500">{t('yourFolders')}</span>
              <div className="flex gap-2">
                <input
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder={t('newPlaceholder')}
                  className="flex-1 min-w-0 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={loading || !newFolderName.trim()}
                  className="shrink-0 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40"
                >
                  {t('create')}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[360px] flex flex-col gap-1 pr-1">
                {loading && <p className="text-xs text-neutral-500">{t('loading')}</p>}
                {!loading && folders.length === 0 && (
                  <p className="text-xs text-neutral-500">{t('emptyFolders')}</p>
                )}
                {folders.map(f => {
                  const active = f.id === selectedId
                  const mine = user?.id === f.owner_id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedId(f.id)}
                      className={`text-left rounded-lg px-3 py-2 text-sm border transition-colors ${
                        active
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-neutral-900 dark:text-neutral-100'
                          : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <span className="font-medium line-clamp-2">{f.name}</span>
                      <span className="block text-[10px] text-neutral-500">{mine ? t('owner') : t('shared')}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="lg:col-span-8 flex flex-col gap-4 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 min-h-[320px]">
              {!selected && <p className="text-sm text-neutral-500">{t('selectFolder')}</p>}
              {selected && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{t('name')}</label>
                      <div className="flex gap-2">
                        <input
                          value={rename}
                          onChange={e => setRename(e.target.value)}
                          disabled={!canEditFolderItems}
                          className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm disabled:opacity-50"
                        />
                        {canEditFolderItems && (
                          <button
                            type="button"
                            onClick={handleRename}
                            className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm"
                          >
                            {t('save')}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {canInviteToFolder && (
                      <button
                        type="button"
                        onClick={() => setShareOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium"
                      >
                        <Share2 size={16} />
                        {t('share')}
                      </button>
                      )}
                      {isOwner && (
                        <button
                          type="button"
                          onClick={handleDeleteFolder}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm"
                        >
                          <Trash2 size={16} />
                          {t('delete')}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t('searchesInFolder')}</h2>
                    {searches.length === 0 && <p className="text-xs text-neutral-500">{t('emptySearches')}</p>}
                    <ul className="flex flex-col gap-2">
                      {searches.map(s => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-neutral-100 dark:border-neutral-800 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <Link
                              href={`/busqueda-compartida/${encodeURIComponent(s.id)}`}
                              className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline line-clamp-2"
                            >
                              {s.categoria} · {s.ubicacion}
                            </Link>
                            <span className="block text-[10px] text-neutral-500">
                              {t('resultCount', { count: s.result_count, requested: s.cantidad_solicitada })}
                            </span>
                          </div>
                          {canEditFolderItems && (
                            <button
                              type="button"
                          title={t('remove')}
                              className="shrink-0 p-2 text-neutral-400 hover:text-red-600"
                              onClick={() => void handleRemoveSearch(s.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>

      {selected && user && (
        <ShareResourceDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          title={selected.name}
          resourceType="search_folder"
          resourceId={selected.id}
          inviterUserId={user.id}
          inviterEmail={user.email ?? undefined}
        />
      )}

      {error && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  )
}

export default function CarpetasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Loading…</div>
      }
    >
      <CarpetasPageInner />
    </Suspense>
  )
}
