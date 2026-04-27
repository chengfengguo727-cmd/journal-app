import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/google-photos'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${origin}/settings?google=error&reason=${error ?? 'no_code'}`)
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code, origin)
    if (!tokens.refresh_token) {
      // Google 在某些情況不回傳 refresh_token（例如先前已授權過）
      // 沒 refresh_token 等於只能用一小時，建議使用者撤銷後重連
      return NextResponse.redirect(
        `${origin}/settings?google=error&reason=no_refresh_token`,
      )
    }

    const { error: dbErr } = await supabase
      .from('google_photos_auth')
      .upsert(
        {
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (dbErr) {
      return NextResponse.redirect(
        `${origin}/settings?google=error&reason=${encodeURIComponent(dbErr.message)}`,
      )
    }

    return NextResponse.redirect(`${origin}/settings?google=connected`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.redirect(
      `${origin}/settings?google=error&reason=${encodeURIComponent(msg)}`,
    )
  }
}
