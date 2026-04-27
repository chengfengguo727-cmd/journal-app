import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidISODate } from '@/lib/utils'

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
  const thumbnailUrl = body.thumbnail_url as string | undefined
  const fullUrl = body.full_url as string | undefined
  const takenAt = body.taken_at as string | null | undefined

  if (!date || !isValidISODate(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }
  if (!googleId || !thumbnailUrl) {
    return NextResponse.json({ error: 'missing google_photo_id or thumbnail_url' }, { status: 400 })
  }

  // 已經 link 過？跳過避免重複
  const { data: existing } = await supabase
    .from('journal_photos')
    .select('id')
    .eq('user_id', user.id)
    .eq('google_photo_id', googleId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ id: existing.id, already_linked: true })
  }

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
      photo_url: thumbnailUrl,
      original_url: fullUrl ?? thumbnailUrl,
      google_photo_id: googleId,
      taken_at: takenAt ?? null,
    })
    .select()
    .single()

  if (error) {
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

  const { error } = await supabase
    .from('journal_photos')
    .delete()
    .eq('user_id', user.id)
    .eq('source', 'google_photos')
    .eq('google_photo_id', googleId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
