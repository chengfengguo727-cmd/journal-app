import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText, isGeminiConfigured } from '@/lib/gemini'
import { MOOD_LABELS, type MoodScore } from '@/types'

interface EntryRow {
  date: string
  title: string | null
  content: string | null
  mood_score: number | null
  mood_tags: string[] | null
  custom_tags: string[] | null
  people_tags: string[] | null
  location: string | null
  word_count: number | null
}

const MAX_CHARS_PER_ENTRY = 800
const MAX_TOTAL_CHARS = 80_000

/**
 * GET /api/recap?year=YYYY
 * 拉該年所有日誌，做基本統計，並用 Gemini 寫一段年度反思。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year') ?? ''
  const year = parseInt(yearParam, 10)
  if (!year || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'invalid year' }, { status: 400 })
  }
  const noAi = searchParams.get('no_ai') === '1'

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const start = `${year}-01-01`
  const end = `${year}-12-31`
  const { data, error } = await supabase
    .from('journal_entries')
    .select(
      'date, title, content, mood_score, mood_tags, custom_tags, people_tags, location, word_count',
    )
    .eq('user_id', user.id)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
    .returns<EntryRow[]>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const entries = data ?? []

  if (entries.length === 0) {
    return NextResponse.json({
      year,
      stats: emptyStats(),
      narrative: null,
      highlights: [],
    })
  }

  const stats = computeStats(entries)
  const highlights = pickHighlights(entries)

  let narrative: string | null = null
  if (!noAi) {
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        {
          year,
          stats,
          highlights,
          narrative: null,
          error: 'GEMINI_API_KEY not configured (stats only)',
        },
        { status: 200 },
      )
    }
    try {
      narrative = await buildNarrative(year, entries, stats)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'gemini error'
      return NextResponse.json(
        { year, stats, highlights, narrative: null, ai_error: msg },
        { status: 200 },
      )
    }
  }

  return NextResponse.json({
    year,
    stats,
    highlights,
    narrative,
  })
}

function emptyStats() {
  return {
    total_entries: 0,
    total_words: 0,
    avg_mood: null,
    mood_distribution: {} as Record<string, number>,
    top_tags: [] as Array<{ tag: string; count: number }>,
    top_locations: [] as Array<{ location: string; count: number }>,
    monthly_word_counts: [] as Array<{ month: number; words: number; entries: number }>,
    longest_streak: 0,
  }
}

function computeStats(entries: EntryRow[]) {
  const totalEntries = entries.length
  const totalWords = entries.reduce((s, e) => s + (e.word_count ?? 0), 0)
  const moodEntries = entries.filter((e) => e.mood_score != null)
  const avgMood =
    moodEntries.length > 0
      ? moodEntries.reduce((s, e) => s + (e.mood_score as number), 0) /
        moodEntries.length
      : null

  const moodDistribution: Record<string, number> = {}
  for (const e of moodEntries) {
    const k = String(e.mood_score)
    moodDistribution[k] = (moodDistribution[k] ?? 0) + 1
  }

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
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }))

  const locCount = new Map<string, number>()
  for (const e of entries) {
    if (!e.location) continue
    locCount.set(e.location, (locCount.get(e.location) ?? 0) + 1)
  }
  const topLocations = Array.from(locCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([location, count]) => ({ location, count }))

  const monthly: Array<{ month: number; words: number; entries: number }> = []
  for (let m = 1; m <= 12; m++) {
    const inMonth = entries.filter((e) => parseInt(e.date.slice(5, 7), 10) === m)
    monthly.push({
      month: m,
      words: inMonth.reduce((s, e) => s + (e.word_count ?? 0), 0),
      entries: inMonth.length,
    })
  }

  // 最長連續天數
  let longestStreak = 0
  let run = 0
  let prev: string | null = null
  for (const e of entries) {
    if (prev && diffDays(prev, e.date) === 1) {
      run++
    } else {
      run = 1
    }
    if (run > longestStreak) longestStreak = run
    prev = e.date
  }

  return {
    total_entries: totalEntries,
    total_words: totalWords,
    avg_mood: avgMood,
    mood_distribution: moodDistribution,
    top_tags: topTags,
    top_locations: topLocations,
    monthly_word_counts: monthly,
    longest_streak: longestStreak,
  }
}

function pickHighlights(entries: EntryRow[]) {
  // 每月找一篇代表作（字數最多 + 有心情）
  const byMonth = new Map<number, EntryRow>()
  for (const e of entries) {
    const m = parseInt(e.date.slice(5, 7), 10)
    const prev = byMonth.get(m)
    const score = (e.word_count ?? 0) + (e.mood_score ? 50 : 0)
    const prevScore = prev ? (prev.word_count ?? 0) + (prev.mood_score ? 50 : 0) : -1
    if (score > prevScore) byMonth.set(m, e)
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, e]) => ({
      date: e.date,
      title: e.title,
      mood_score: e.mood_score,
      word_count: e.word_count,
      excerpt: e.content ? e.content.slice(0, 140) : '',
    }))
}

async function buildNarrative(
  year: number,
  entries: EntryRow[],
  stats: ReturnType<typeof computeStats>,
): Promise<string> {
  // 把每篇日誌壓縮成「日期 / 心情 / 簡短內容」餵給 model
  const lines: string[] = []
  let total = 0
  for (const e of entries) {
    const mood = e.mood_score
      ? `${e.mood_score}/${MOOD_LABELS[e.mood_score as MoodScore]}`
      : '—'
    const snippet = (e.content ?? '').slice(0, MAX_CHARS_PER_ENTRY).replace(/\s+/g, ' ')
    const tags = [
      ...(e.custom_tags ?? []),
      ...(e.mood_tags ?? []),
      ...(e.people_tags ?? []),
    ].slice(0, 6).join('、')
    const line = `[${e.date}] 心情=${mood}${tags ? ` 標籤=${tags}` : ''}${
      e.location ? ` @${e.location}` : ''
    }\n${snippet}`
    if (total + line.length > MAX_TOTAL_CHARS) break
    lines.push(line)
    total += line.length
  }

  const statsSummary = [
    `年份：${year}`,
    `篇數：${stats.total_entries}`,
    `總字數：${stats.total_words.toLocaleString()}`,
    stats.avg_mood != null ? `平均心情：${stats.avg_mood.toFixed(2)}/5` : '',
    `最長連續天數：${stats.longest_streak}`,
    stats.top_tags.length > 0
      ? `常用標籤：${stats.top_tags.slice(0, 8).map((t) => `${t.tag}(${t.count})`).join('、')}`
      : '',
    stats.top_locations.length > 0
      ? `常去地點：${stats.top_locations.slice(0, 5).map((l) => `${l.location}(${l.count})`).join('、')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = `${statsSummary}

---

${lines.join('\n\n')}`

  const system = `你是個人日誌的年度回顧寫手。讀完整年的日誌與基本統計後，用繁體中文寫一段「給這位作者的年度回顧」。

格式要求（必須照這個結構，使用 Markdown）：
## 這一年的關鍵字
列出 3–5 個概括這一年的詞或短句（用項目符號）。

## 心情起伏
1–2 段。描述整年情緒的脈絡：高峰、低谷、轉折點。具體引用日期。

## 重要的人事物
1–2 段。常被提到的人、地點、活動、主題。

## 改變
1 段。年初和年末有什麼不同？作者似乎在意什麼新事物，又放下了什麼？

## 給明年的提醒
2–3 句溫柔的觀察，不要說教。

語氣：像熟悉作者的朋友，溫暖但不矯情。可以引用日誌原句但要加引號。
不要：陳腔濫調、空泛祝福、星座式建議。`

  return generateText(prompt, {
    system,
    temperature: 0.7,
    maxOutputTokens: 4000,
  })
}

function diffDays(a: string, b: string): number {
  const d1 = new Date(a + 'T00:00:00')
  const d2 = new Date(b + 'T00:00:00')
  return Math.round((d2.getTime() - d1.getTime()) / 86400000)
}
