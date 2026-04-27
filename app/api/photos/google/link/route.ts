import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidISODate } from '@/lib/utils'
import { getValidAccessToken } from '@/lib/google-photos'

/**
 * 將使用者透過 Picker 挑選的 Google 照片下載到 Supabase Storage 永久保存。
 * Picker baseUrl 需要 Authorization: Bearer，且只在 session 內有效；
 * 我們在 link 當下抓 bytes 上傳，之後就不再依賴 Google session。
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const date = body.date as string | undefined
  const googleId = body.google_photo_id as string | undefined
  const fullUrl = body.full_url as string | undefined
  const thumbnailUrl = body.thumbnail_url as string | undefined
  const takenAt = body.taken_at as string | null | undefined

  if (!date || !isValidISODate(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }
  if (!googleId || !(fullUrl || thumbnailUrl)) {
    return NextResponse.json({ error: 'missing identifiers' }, { status: 400 })
  }

  // 重複 link 檢查
  const { data: existing } = await supabase
    .from('journal_photos')
    .select('id')
    .eq('user_id', user.id)
    .eq('google_photo_id', googleId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ id: existing.id, already_linked: true })
  }

  // 取 Google OAuth access token
  const accessToken = await getValidAccessToken(user.id, supabase)
  if (!accessToken) {
    return NextResponse.json({ error: 'not_connected' }, { status: 412 })
  }

  // 抓圖片 bytes（用 full size 較佳；fallback 到 thumbnail）
  const sourceUrl = fullUrl || thumbnailUrl!
  let imageRes: Response
  try {
    imageRes = await fetch(sourceUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch (err) {
    return NextResponse.json(
      { error: `fetch failed: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 502 },
    )
  }
  if (!imageRes.ok) {
    return NextResponse.json(
      { error: `Google returned ${imageRes.status}` },
      { status: 502 },
    )
  }

  const arrayBuffer = await imageRes.arrayBuffer()
  const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : 'jpg'

  // 上傳到 Supabase Storage
  const filename = `${crypto.randomUUID()}.${ext}`
  const storagePath = `${user.id}/${date}/${filename}`
  const { error: uploadErr } = await supabase.storage
    .from('journal-photos')
    .upload(storagePath, new Uint8Array(arrayBuffer), {
      contentType,
      upsert: false,
    })
  if (uploadErr) {
    return NextResponse.json(
      { error: `upload failed: ${uploadErr.message}` },
      { status: 500 },
    )
  }

  const { data: { publicUrl } } = supabase.storage
    .from('journal-photos')
    .getPublicUrl(storagePath)

  // 寫資料庫（保留 source='google_photos' 紀錄來源；photo_url 是 Supabase URL）
  const { data: entry } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()

  const { data, error } = await supabase
    .from('journal_photos')
    .insert({
      user_id: user.id,
      entry_id: entry?.id ?? null,
      date,
      source: 'google_photos',
      photo_url: publicUrl,
      original_url: publicUrl,
      google_photo_id: googleId,
      taken_at: takenAt ?? null,
    })
    .select()
    .single()

  if (error) {
    // 寫 DB 失敗 → 嘗試刪除剛上傳的孤兒檔
    await supabase.storage.from('journal-photos').remove([storagePath])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const googleId = searchParams.get('google_photo_id')
  if (!googleId) {
    return NextResponse.json({ error: 'missing google_photo_id' }, { status: 400 })
  }

  // 找 row 取出 storage path
  const { data: photo } = await supabase
    .from('journal_photos')
    .select('id, photo_url')
    .eq('user_id', user.id)
    .eq('google_photo_id', googleId)
    .maybeSingle()

  if (photo?.photo_url) {
    const m = photo.photo_url.match(/\/storage\/v1\/object\/public\/journal-photos\/(.+)$/)
    if (m) {
      await supabase.storage.from('journal-photos').remove([m[1]])
    }
  }

  const { error } = await supabase
    .from('journal_photos')
    .delete()
    .eq('user_id', user.id)
    .eq('google_photo_id', googleId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
