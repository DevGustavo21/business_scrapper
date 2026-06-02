import type { SupabaseClient } from '@supabase/supabase-js'

const AVATAR_BUCKET = 'avatars'

export type ProfileRow = {
  id: string
  email: string
  updated_at: string
  first_name: string | null
  last_name: string | null
  company: string | null
  phone: string | null
  avatar_url: string | null
  /** Preferencia de idioma del usuario. Si la columna no existe en la BD, llega `null`. */
  preferred_locale: 'en' | 'es' | null
}

export async function upsertMyProfile(supabase: SupabaseClient, userId: string, email: string) {
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
  const payload = { email: email.trim(), updated_at: new Date().toISOString() }
  if (existing) {
    const { error } = await supabase.from('profiles').update(payload).eq('id', userId)
    return { error: error ? new Error(error.message) : null }
  }
  const { error } = await supabase.from('profiles').insert({ id: userId, ...payload })
  return { error: error ? new Error(error.message) : null }
}

export async function fetchMyProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: ProfileRow | null; error: Error | null }> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return { data: data as ProfileRow | null, error: error ? new Error(error.message) : null }
}

export async function updateMyProfileDetails(
  supabase: SupabaseClient,
  userId: string,
  fields: {
    first_name: string | null
    last_name: string | null
    company: string | null
    phone: string | null
    avatar_url: string | null
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: fields.first_name?.trim() || null,
      last_name: fields.last_name?.trim() || null,
      company: fields.company?.trim() || null,
      phone: fields.phone?.trim() || null,
      avatar_url: fields.avatar_url?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  return { error: error ? new Error(error.message) : null }
}

export async function uploadMyAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<{ publicUrl: string | null; error: Error | null }> {
  const path = `${userId}/avatar`
  const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
  })
  if (upErr) return { publicUrl: null, error: new Error(upErr.message) }
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return { publicUrl: data.publicUrl ?? null, error: null }
}

export async function removeMyAvatarFiles(supabase: SupabaseClient, userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([`${userId}/avatar`])
  return { error: error ? new Error(error.message) : null }
}

/**
 * Guarda la preferencia de idioma del usuario. No falla si la columna
 * `preferred_locale` aún no existe en la BD; en ese caso registra un warn
 * y la cookie sigue siendo la fuente única (modo degradado).
 */
export async function updateMyPreferredLocale(
  supabase: SupabaseClient,
  userId: string,
  locale: 'en' | 'es',
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ preferred_locale: locale, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) {
    /** Si la columna no existe (42703) lo tratamos como degradación, no como error fatal. */
    if (/column .*preferred_locale.* does not exist/i.test(error.message) || error.code === '42703') {
      console.warn('[profiles] preferred_locale column missing; skipping persistence.')
      return { error: null }
    }
    return { error: new Error(error.message) }
  }
  return { error: null }
}
