import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidISODate } from '@/lib/utils'

const SIGNED_URL_TTL_SECONDS = 3600 // 1 hour

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!date || !isValidISODate(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }

  const { data: memos, error } = await supabase
    .from('voice_memos')
    .select('id, date, audio_url, transcript, duration_seconds, created_at')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!memos || memos.length === 0) {
    return NextResponse.json([])
  }

  // 為每筆建立 signed URL（audio_url 存的是 storage path）
  const paths = memos.map((m) => m.audio_url)
  const { data: signed } = await supabase.storage
    .from('voice-memos')
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)

  const signedByPath = new Map<string, string>()
  signed?.forEach((s, i) => {
    if (s.signedUrl) signedByPath.set(paths[i], s.signedUrl)
  })

  return NextResponse.json(
    memos.map((m) => ({
      ...m,
      signed_url: signedByPath.get(m.audio_url) ?? null,
    })),
  )
}
