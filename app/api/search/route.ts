import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidISODate } from '@/lib/utils'

/**
 * GET /api/search?q=&mood=&tag=&location=&from=&to=
 * 全文搜尋 journal_entries（標題 + 內文 ilike），加上心情/標籤/地點/日期區間 filter。
 * 中文分詞 Supabase 沒裝 pg_jieba，所以用 ilike '%q%' 即可，個人用量足夠。
 */
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || ''
  const moodParam = searchParams.get('mood')
  const tag = searchParams.get('tag')?.trim() || ''
  const location = searchParams.get('location')?.trim() || ''
  const from = searchParams.get('from')?.trim() || ''
  const to = searchParams.get('to')?.trim() || ''

  let query = supabase
    .from('journal_entries')
    .select(
      'id, date, title, content, mood_score, mood_tags, custom_tags, people_tags, location, word_count',
    )
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(100)

  if (q) {
    // ilike 對 % 與 _ 是萬用字元，使用者輸入需要 escape 避免破壞語法
    const safe = q.replace(/[\\%_]/g, (c) => `\\${c}`)
    const pattern = `%${safe}%`
    query = query.or(`title.ilike.${pattern},content.ilike.${pattern}`)
  }

  if (moodParam) {
    const m = parseInt(moodParam, 10)
    if (m >= 1 && m <= 5) {
      query = query.eq('mood_score', m)
    }
  }

  if (tag) {
    // tag 含逗號或大括號會破壞 cs.{...} 語法 — 直接擋掉
    if (!/[,{}]/.test(tag)) {
      query = query.or(
        `custom_tags.cs.{${tag}},mood_tags.cs.{${tag}},people_tags.cs.{${tag}}`,
      )
    }
  }

  if (location) {
    const safe = location.replace(/[\\%_]/g, (c) => `\\${c}`)
    query = query.ilike('location', `%${safe}%`)
  }

  if (from && isValidISODate(from)) {
    query = query.gte('date', from)
  }
  if (to && isValidISODate(to)) {
    query = query.lte('date', to)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}
