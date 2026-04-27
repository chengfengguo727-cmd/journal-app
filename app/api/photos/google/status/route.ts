import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data } = await supabase
    .from('google_photos_auth')
    .select('connected_at, expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    connected: !!data,
    connected_at: data?.connected_at ?? null,
    expires_at: data?.expires_at ?? null,
  })
}
