import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createPickerSession,
  deletePickerSession,
  getValidAccessToken,
} from '@/lib/google-photos'

export async function POST() {
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
    const session = await createPickerSession(accessToken)
    return NextResponse.json({
      session_id: session.id,
      picker_uri: session.pickerUri,
      expire_time: session.expireTime,
      polling_interval_ms: parseIntervalMs(session.pollingConfig?.pollInterval),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'create_failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

export async function DELETE(request: Request) {
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
    return NextResponse.json({ ok: true })
  }

  try {
    await deletePickerSession(accessToken, sessionId)
  } catch {
    // 忽略：使用者已關掉 session 也是 OK
  }
  return NextResponse.json({ ok: true })
}

function parseIntervalMs(s?: string): number {
  if (!s) return 3000
  const m = s.match(/^([\d.]+)s$/)
  return m ? Math.round(parseFloat(m[1]) * 1000) : 3000
}
