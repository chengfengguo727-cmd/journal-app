import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPickerSession, getValidAccessToken } from '@/lib/google-photos'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'missing session_id' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const accessToken = await getValidAccessToken(user.id, supabase)
  if (!accessToken) {
    return NextResponse.json({ error: 'not_connected' }, { status: 412 })
  }

  try {
    const session = await getPickerSession(accessToken, sessionId)
    return NextResponse.json({
      media_items_set: session.mediaItemsSet,
      expire_time: session.expireTime,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'poll_failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
