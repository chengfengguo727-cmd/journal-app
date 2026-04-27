import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidISODate } from '@/lib/utils'
import {
  getValidAccessToken,
  searchPhotosByDate,
  thumbnailUrl,
  fullSizeUrl,
} from '@/lib/google-photos'

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

  const accessToken = await getValidAccessToken(user.id, supabase)
  if (!accessToken) {
    return NextResponse.json({ error: 'not_connected' }, { status: 412 })
  }

  let items
  try {
    items = await searchPhotosByDate(accessToken, date)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'search_failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // 找出已經 link 過的 google_photo_id（用於 UI 標記「已加入」）
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
      thumbnail_url: thumbnailUrl(i.baseUrl),
      full_url: fullSizeUrl(i.baseUrl),
      filename: i.filename,
      taken_at: i.mediaMetadata?.creationTime ?? null,
      linked: linkedIds.has(i.id),
    })),
  )
}
