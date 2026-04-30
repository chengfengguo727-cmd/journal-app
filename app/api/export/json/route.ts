import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/export/json
 * 匯出全部日誌 + 照片 + 語音為單一 JSON 檔。
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [entriesResult, photosResult, voiceResult] = await Promise.all([
    supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true }),
    supabase
      .from('journal_photos')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true }),
    supabase
      .from('voice_memos')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true }),
  ])

  for (const r of [entriesResult, photosResult, voiceResult]) {
    if (r.error) {
      return NextResponse.json({ error: r.error.message }, { status: 500 })
    }
  }

  const payload = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    entries: entriesResult.data ?? [],
    photos: photosResult.data ?? [],
    voice_memos: voiceResult.data ?? [],
  }

  const filename = `journal-${new Date().toISOString().slice(0, 10)}.json`
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
