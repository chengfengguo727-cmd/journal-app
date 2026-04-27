import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fullSizeUrl,
  getValidAccessToken,
  listPickedMediaItems,
  thumbnailUrl,
} from '@/lib/google-photos'

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
    const items = await listPickedMediaItems(accessToken, sessionId)

    // 標記哪些已經 link 過
    const ids = items.map((i) => i.id)
    let linkedIds = new Set<string>()
    if (ids.length > 0) {
      const { data: linked } = await supabase
        .from('journal_photos')
        .select('google_photo_id')
        .eq('user_id', user.id)
        .eq('source', 'google_photos')
        .in('google_photo_id', ids)
      linkedIds = new Set((linked ?? []).map((l) => l.google_photo_id as string))
    }

    return NextResponse.json(
      items.map((i) => ({
        id: i.id,
        type: i.type,
        thumbnail_url: thumbnailUrl(i.mediaFile.baseUrl),
        full_url: fullSizeUrl(i.mediaFile.baseUrl),
        filename: i.mediaFile.filename,
        taken_at: i.createTime,
        linked: linkedIds.has(i.id),
      })),
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'list_failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
