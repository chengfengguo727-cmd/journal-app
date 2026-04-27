import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidISODate } from '@/lib/utils'
import {
  batchGetMediaItems,
  fullSizeUrl,
  getValidAccessToken,
  thumbnailUrl,
} from '@/lib/google-photos'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const month = searchParams.get('month')

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let query = supabase
    .from('journal_photos')
    .select('*')
    .eq('user_id', user.id)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (date) {
    if (!isValidISODate(date)) {
      return NextResponse.json({ error: 'invalid date' }, { status: 400 })
    }
    query = query.eq('date', date)
  } else if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'invalid month' }, { status: 400 })
    }
    const start = `${month}-01`
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const end = `${month}-${String(lastDay).padStart(2, '0')}`
    query = query.gte('date', start).lte('date', end)
  } else {
    query = query.limit(60)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []

  // 替 google_photos 來源刷新 baseUrl（會在 ~60 分鐘過期）
  const googleRows = rows.filter(
    (r) => r.source === 'google_photos' && r.google_photo_id,
  )
  if (googleRows.length > 0) {
    const accessToken = await getValidAccessToken(user.id, supabase)
    if (accessToken) {
      const ids = googleRows.map((r) => r.google_photo_id as string)
      try {
        const fresh = await batchGetMediaItems(accessToken, ids)
        rows.forEach((r) => {
          if (r.source === 'google_photos' && r.google_photo_id) {
            const item = fresh[r.google_photo_id]
            if (item) {
              r.photo_url = thumbnailUrl(item.baseUrl)
              r.original_url = fullSizeUrl(item.baseUrl)
            }
          }
        })
      } catch {
        // refresh 失敗不擋 list，前端 img 載失敗就會看到 broken icon
      }
    }
  }

  return NextResponse.json(rows)
}

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
  const storagePath = body.storage_path as string | undefined
  if (!date || !isValidISODate(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }
  if (!storagePath || !storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'invalid storage_path' }, { status: 400 })
  }

  // Public URL（bucket 是 public）
  const { data: { publicUrl } } = supabase.storage
    .from('journal-photos')
    .getPublicUrl(storagePath)

  // 找當日是否已有 entry，作為 entry_id
  const { data: entry } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()

  const payload = {
    user_id: user.id,
    entry_id: entry?.id ?? null,
    date,
    source: 'upload' as const,
    photo_url: publicUrl,
    original_url: publicUrl,
    caption: (body.caption as string | undefined) ?? null,
    taken_at: (body.taken_at as string | undefined) ?? null,
  }

  const { data, error } = await supabase
    .from('journal_photos')
    .insert(payload)
    .select()
    .single()

  if (error) {
    // 寫資料庫失敗 → 嘗試把 storage 已上傳的檔案刪除避免孤兒
    await supabase.storage.from('journal-photos').remove([storagePath])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
