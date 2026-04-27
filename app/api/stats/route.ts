import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface EntryRow {
  date: string
  mood_score: number | null
  mood_tags: string[] | null
  custom_tags: string[] | null
  people_tags: string[] | null
  location: string | null
  word_count: number | null
}

/**
 * GET /api/stats
 * 一次取所有日誌（個人用量 < 數千篇）做聚合：總覽、心情趨勢、年度熱力圖、Top 標籤/地點。
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .select(
      'date, mood_score, mood_tags, custom_tags, people_tags, location, word_count',
    )
    .eq('user_id', user.id)
    .order('date', { ascending: true })
    .returns<EntryRow[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const entries = data ?? []
  const today = new Date()
  const todayISO = toISO(today)

  const totalEntries = entries.length
  const totalWords = entries.reduce((sum, e) => sum + (e.word_count ?? 0), 0)
  const moodEntries = entries.filter((e) => e.mood_score != null)
  const avgMood =
    moodEntries.length > 0
      ? moodEntries.reduce((s, e) => s + (e.mood_score as number), 0) /
        moodEntries.length
      : null

  // 連續寫作天數：從今天往回算（昨天若沒寫但今天寫了，仍算 1）
  const writtenSet = new Set(entries.map((e) => e.date))
  let currentStreak = 0
  if (writtenSet.has(todayISO) || writtenSet.has(toISO(addDays(today, -1)))) {
    let cursor = writtenSet.has(todayISO) ? new Date(today) : addDays(today, -1)
    while (writtenSet.has(toISO(cursor))) {
      currentStreak++
      cursor = addDays(cursor, -1)
    }
  }

  // 最長連續：掃整串日期
  const sortedDates = entries.map((e) => e.date).sort()
  let longestStreak = 0
  let run = 0
  let prev: string | null = null
  for (const d of sortedDates) {
    if (prev && diffDays(prev, d) === 1) {
      run++
    } else {
      run = 1
    }
    if (run > longestStreak) longestStreak = run
    prev = d
  }

  const start30 = toISO(addDays(today, -29))
  const writtenDays30 = entries.filter((e) => e.date >= start30 && e.date <= todayISO).length

  // 心情趨勢：最近 90 天有 mood 的點
  const start90 = toISO(addDays(today, -89))
  const moodSeries = entries
    .filter((e) => e.mood_score != null && e.date >= start90)
    .map((e) => ({ date: e.date, mood: e.mood_score as number }))

  // 熱力圖：最近 365 天的 word_count
  const start365 = toISO(addDays(today, -364))
  const heatmap = entries
    .filter((e) => e.date >= start365)
    .map((e) => ({ date: e.date, count: e.word_count ?? 0 }))

  // Top 標籤（合併三欄）
  const tagCount = new Map<string, number>()
  for (const e of entries) {
    for (const t of [
      ...(e.custom_tags ?? []),
      ...(e.mood_tags ?? []),
      ...(e.people_tags ?? []),
    ]) {
      if (!t) continue
      tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
    }
  }
  const topTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }))

  // Top 地點
  const locCount = new Map<string, number>()
  for (const e of entries) {
    if (!e.location) continue
    locCount.set(e.location, (locCount.get(e.location) ?? 0) + 1)
  }
  const topLocations = Array.from(locCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([location, count]) => ({ location, count }))

  return NextResponse.json({
    overview: {
      total_entries: totalEntries,
      total_words: totalWords,
      avg_mood: avgMood,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      written_days_30: writtenDays30,
    },
    mood_series: moodSeries,
    heatmap,
    top_tags: topTags,
    top_locations: topLocations,
  })
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function diffDays(a: string, b: string): number {
  const d1 = new Date(a + 'T00:00:00')
  const d2 = new Date(b + 'T00:00:00')
  return Math.round((d2.getTime() - d1.getTime()) / 86400000)
}
