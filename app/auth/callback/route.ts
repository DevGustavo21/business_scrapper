import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')?.replace(/[^\w/\-]/g, '') || '/'

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=config`)
  }

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/'}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
