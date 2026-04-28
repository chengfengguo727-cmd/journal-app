'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Loader2 } from 'lucide-react'
import { MOOD_EMOJIS, MOOD_LABELS, type MoodScore } from '@/types'

interface RecapResponse {
  year: number
  stats: {
    total_entries: number
    total_words: number
    avg_mood: number | null
    mood_distribution: Record<string, number>
    top_tags: Array<{ tag: string; count: number }>
    top_locations: Array<{ location: string; count: number }>
    monthly_word_counts: Array<{ month: number; words: number; entries: number }>
    longest_streak: number
  }
  highlights: Array<{
    date: string
    title: string | null
    mood_score: MoodScore | null
    word_count: number | null
    excerpt: string
  }>
  narrative: string | null
  error?: string
  ai_error?: string
}

const NOW = new Date()
const CURRENT_YEAR = NOW.getFullYear()

export function RecapView({ defaultYear }: { defaultYear: number }) {
  const [year, setYear] = useState(defaultYear)
  const [data, setData] = useState<RecapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiPending, setAiPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    // 先抓統計（no_ai=1 立即回），再 trigger AI 生成
    fetch(`/api/recap?year=${year}&no_ai=1`)
      .then((r) => r.json())
      .then((d: RecapResponse) => {
        if (cancelled) return
        setData(d)
        setLoading(false)
        if (d.stats.total_entries > 0) {
          setAiPending(true)
          fetch(`/api/recap?year=${year}`)
            .then((r) => r.json())
            .then((full: RecapResponse) => {
              if (!cancelled) setData(full)
            })
            .catch(() => {})
            .finally(() => {
              if (!cancelled) setAiPending(false)
            })
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [year])

  const yearOptions = Array.from(
    { length: CURRENT_YEAR - 2020 + 1 },
    (_, i) => CURRENT_YEAR - i,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">年份</label>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">載入中…</p>
      )}

      {data && data.stats.total_entries === 0 && (
        <p className="text-sm text-muted-foreground">
          {year} 年沒有任何日誌。
        </p>
      )}

      {data && data.stats.total_entries > 0 && (
        <>
          <Stats stats={data.stats} />
          <Narrative narrative={data.narrative} pending={aiPending} aiError={data.ai_error} />
          <Highlights highlights={data.highlights} />
        </>
      )}
    </div>
  )
}

function Stats({ stats }: { stats: RecapResponse['stats'] }) {
  const maxMonth = Math.max(1, ...stats.monthly_word_counts.map((m) => m.words))
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4 md:p-6">
      <h2 className="text-sm font-semibold">這一年的數字</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="篇數" value={stats.total_entries.toLocaleString()} />
        <Stat label="總字數" value={stats.total_words.toLocaleString()} />
        <Stat
          label="平均心情"
          value={stats.avg_mood != null ? stats.avg_mood.toFixed(2) : '—'}
          sub={
            stats.avg_mood != null
              ? MOOD_EMOJIS[Math.round(stats.avg_mood) as MoodScore]
              : null
          }
        />
        <Stat label="最長連續" value={`${stats.longest_streak} 天`} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold text-muted-foreground">每月寫作量</h3>
        <div className="grid grid-cols-12 gap-1">
          {stats.monthly_word_counts.map((m) => {
            const ratio = m.words / maxMonth
            return (
              <div key={m.month} className="flex flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end">
                  <div
                    className="w-full rounded-sm bg-primary/70 transition-all"
                    style={{ height: `${Math.max(4, ratio * 100)}%` }}
                    title={`${m.month}月：${m.entries} 篇 / ${m.words} 字`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{m.month}</span>
              </div>
            )
          })}
        </div>
      </div>

      {stats.top_tags.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">常用標籤</h3>
          <div className="flex flex-wrap gap-1.5">
            {stats.top_tags.map((t) => (
              <Link
                key={t.tag}
                href={`/search?tag=${encodeURIComponent(t.tag)}`}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs hover:bg-accent"
              >
                <span>{t.tag}</span>
                <span className="text-muted-foreground">·{t.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {stats.top_locations.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">常去地點</h3>
          <ul className="space-y-1 text-sm">
            {stats.top_locations.map((l) => (
              <li
                key={l.location}
                className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-accent"
              >
                <span>📍 {l.location}</span>
                <span className="text-xs text-muted-foreground">{l.count} 次</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {Object.keys(stats.mood_distribution).length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">心情分佈</h3>
          <div className="flex flex-wrap gap-3">
            {([1, 2, 3, 4, 5] as MoodScore[]).map((m) => {
              const count = stats.mood_distribution[String(m)] ?? 0
              return (
                <div key={m} className="flex items-center gap-1.5 text-sm">
                  <span className="text-base">{MOOD_EMOJIS[m]}</span>
                  <span className="text-muted-foreground">{MOOD_LABELS[m]}</span>
                  <span className="tabular-nums">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="rounded-md border bg-background p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline justify-center gap-1.5">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        {sub && <span className="text-base">{sub}</span>}
      </div>
    </div>
  )
}

function Narrative({
  narrative,
  pending,
  aiError,
}: {
  narrative: string | null
  pending: boolean
  aiError?: string
}) {
  return (
    <section className="rounded-lg border bg-card p-4 md:p-6">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        AI 年度反思
      </h2>
      {pending && !narrative && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          AI 正在讀完整年的日誌…
        </div>
      )}
      {aiError && (
        <p className="text-sm text-destructive">{aiError}</p>
      )}
      {narrative && (
        <article className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
          {narrative}
        </article>
      )}
    </section>
  )
}

function Highlights({ highlights }: { highlights: RecapResponse['highlights'] }) {
  if (highlights.length === 0) return null
  return (
    <section className="rounded-lg border bg-card p-4 md:p-6">
      <h2 className="mb-3 text-sm font-semibold">每月精選</h2>
      <ul className="space-y-2">
        {highlights.map((h) => (
          <li key={h.date}>
            <Link
              href={`/journal/${h.date}`}
              className="block rounded-md border bg-background p-3 transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">
                  {h.mood_score && (
                    <span className="mr-2">{MOOD_EMOJIS[h.mood_score]}</span>
                  )}
                  {h.date}
                  {h.title && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      · {h.title}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {h.word_count ?? 0} 字
                </div>
              </div>
              {h.excerpt && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {h.excerpt}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
