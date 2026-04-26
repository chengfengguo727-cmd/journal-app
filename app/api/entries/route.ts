import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { countWords, isValidISODate } from '@/lib/utils'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Single date — 取得該日日誌
  if (date) {
    if (!isValidISODate(date)) {
      return NextResponse.json({ error: 'invalid date' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  // Month overview — 取得指定月份所有日期 + mood
  if (yearParam && monthParam) {
    const year = parseInt(yearParam, 10)
    const month = parseInt(monthParam, 10)
    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'invalid year/month' }, { status: 400 })
    }
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).getDate()
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('journal_entries')
      .select('date, mood_score, word_count')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const dates = (data ?? []).map((d) => d.date)
    const mood_scores = Object.fromEntries(
      (data ?? [])
        .filter((d) => d.mood_score != null)
        .map((d) => [d.date, d.mood_score]),
    )
    const word_counts = Object.fromEntries(
      (data ?? []).map((d) => [d.date, d.word_count ?? 0]),
    )
    return NextResponse.json({ dates, mood_scores, word_counts })
  }

  // 否則：列出最近 30 篇
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, date, title, content, mood_score, custom_tags, word_count, updated_at')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
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
  if (!date || !isValidISODate(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }

  const content = (body.content as string) ?? ''
  const wordCount = countWords(content)

  const payload = {
    user_id: user.id,
    date,
    title: (body.title as string) ?? null,
    content,
    content_html: (body.content_html as string) ?? null,
    mood_score: (body.mood_score as number | null) ?? null,
    mood_tags: (body.mood_tags as string[]) ?? [],
    custom_tags: (body.custom_tags as string[]) ?? [],
    people_tags: (body.people_tags as string[]) ?? [],
    location: (body.location as string) ?? null,
    location_lat: (body.location_lat as number | null) ?? null,
    location_lng: (body.location_lng as number | null) ?? null,
    word_count: wordCount,
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
