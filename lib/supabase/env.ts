/**
 * Clave pública para el cliente Supabase: admite `anon` (JWT legacy) o clave publicable `sb_publishable_…`.
 * La URL del proyecto sigue siendo obligatoria (Settings → API en el panel de Supabase).
 */
export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    ''
  return { url, anonKey }
}

/** Clave secreta (solo servidor). Opcional hasta que uses RLS bypass o Edge con service role. */
export function getSupabaseSecretKey(): string {
  return process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabasePublicEnv()
  return Boolean(url && anonKey)
}
