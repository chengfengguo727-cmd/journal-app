import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidISODate } from '@/lib/utils'

interface Row {
  id: string
  date: string
  title: string | null
  content: string | null
  mood_score: number | null
  word_count: number | null
}

/**
 * GET /api/on-this-day?date=YYYY-MM-DD
 * 找出歷史上同月同日（不同年）且早於指定日期的所有日誌。
 * Supabase JS 不支援 to_char 函式，所以拉指定日期前 N 年的窗口在 Node 過濾。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const target = searchParams.get('date') ?? ''
  if (!isValidISODate(target)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const monthDay = target.slice(5) // "MM-DD"

  // 抓所有早於 target 的日誌（個人用量足夠，不會撈太多列）
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, date, title, content, mood_score, word_count')
    .eq('user_id', user.id)
    .lt('date', target)
    .order('date', { ascending: false })
    .returns<Row[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const matches = (data ?? []).filter((e) => e.date.endsWith(`-${monthDay}`))
  return NextResponse.json(matches)
}
