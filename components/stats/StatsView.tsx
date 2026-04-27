'use client'

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MOOD_EMOJIS } from '@/types'

interface StatsResponse {
  overview: {
    total_entries: number
    total_words: number
    avg_mood: number | null
    current_streak: number
    longest_streak: number
    written_days_30: number
  }
  mood_series: Array<{ date: string; mood: number }>
  heatmap: Array<{ date: string; count: number }>
  top_tags: Array<{ tag: string; count: number }>
  top_locations: Array<{ location: string; count: number }>
}

export function StatsView() {
  const [data, setData] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p className="text-sm text-muted-foreground">載入中…</p>
  }
  if (!data || 'error' in data) {
    return <p className="text-sm text-muted-foreground">無法載入統計資料。</p>
  }

  const empty = data.overview.total_entries === 0
  if (empty) {
    return (
      <p className="text-sm text-muted-foreground">
        還沒有日誌可以統計，去寫一篇吧。
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <Overview overview={data.overview} />
      <MoodChart series={data.mood_series} />
      <Heatmap cells={data.heatmap} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TopTags items={data.top_tags} />
        <TopLocations items={data.top_locations} />
      </div>
    </div>
  )
}

function Overview({ overview }: { overview: StatsResponse['overview'] }) {
  const cards = [
    { label: '總篇數', value: overview.total_entries.toLocaleString() },
    { label: '總字數', value: overview.total_words.toLocaleString() },
    {
      label: '平均心情',
      value:
        overview.avg_mood != null ? overview.avg_mood.toFixed(2) : '—',
      sub:
        overview.avg_mood != null
          ? MOOD_EMOJIS[Math.round(overview.avg_mood) as 1 | 2 | 3 | 4 | 5]
          : null,
    },
    { label: '近 30 天寫作', value: `${overview.written_days_30} 天` },
    { label: '目前連續', value: `${overview.current_streak} 天` },
    { label: '最長連續', value: `${overview.longest_streak} 天` },
  ]
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border bg-card p-4 text-center md:text-left"
        >
          <div className="text-xs text-muted-foreground">{c.label}</div>
          <div className="mt-1 flex items-baseline gap-1.5 justify-center md:justify-start">
            <span className="text-2xl font-semibold tabular-nums">{c.value}</span>
            {c.sub && <span className="text-lg">{c.sub}</span>}
          </div>
        </div>
      ))}
    </section>
  )
}

function MoodChart({ series }: { series: StatsResponse['mood_series'] }) {
  return (
    <section className="rounded-lg border bg-card p-4 md:p-6">
      <h2 className="mb-3 text-sm font-semibold">心情趨勢（最近 90 天）</h2>
      {series.length === 0 ? (
        <p className="text-sm text-muted-foreground">最近 90 天還沒有心情紀錄。</p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(d: string) => d.slice(5)}
                minTickGap={24}
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v) => {
                  const n = typeof v === 'number' ? v : Number(v)
                  if (!Number.isFinite(n)) return [String(v), '心情']
                  const rounded = Math.min(5, Math.max(1, Math.round(n))) as 1 | 2 | 3 | 4 | 5
                  return [`${n} ${MOOD_EMOJIS[rounded]}`, '心情']
                }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              />
              <Line
                type="monotone"
                dataKey="mood"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

function Heatmap({ cells }: { cells: StatsResponse['heatmap'] }) {
  // 過去 365 天熱力圖（GitHub 風格：欄＝週，列＝週日～六）
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 364)
  // 對齊到當週週日
  start.setDate(start.getDate() - start.getDay())

  const map = new Map(cells.map((c) => [c.date, c.count]))
  const max = Math.max(1, ...cells.map((c) => c.count))

  const weeks: Array<Array<{ date: string; count: number; future: boolean } | null>> = []
  const cursor = new Date(start)
  const todayISO = isoOf(today)
  while (cursor <= addDays(today, 6 - today.getDay())) {
    const week: Array<{ date: string; count: number; future: boolean } | null> = []
    for (let d = 0; d < 7; d++) {
      const iso = isoOf(cursor)
      const future = iso > todayISO
      week.push({ date: iso, count: map.get(iso) ?? 0, future })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  return (
    <section className="rounded-lg border bg-card p-4 md:p-6">
      <h2 className="mb-3 text-sm font-semibold">寫作熱力圖（過去一年）</h2>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell, di) => {
                if (!cell || cell.future) {
                  return (
                    <div
                      key={di}
                      className="h-3 w-3 rounded-sm bg-transparent"
                    />
                  )
                }
                const intensity = cell.count === 0 ? 0 : Math.min(4, Math.ceil((cell.count / max) * 4))
                return (
                  <Link
                    key={di}
                    href={`/journal/${cell.date}`}
                    title={`${cell.date}：${cell.count} 字`}
                    className={cn(
                      'h-3 w-3 rounded-sm transition-transform hover:scale-150',
                      INTENSITY_CLASSES[intensity],
                    )}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-3 w-3 rounded-sm', INTENSITY_CLASSES[i])} />
        ))}
        <span>多</span>
      </div>
    </section>
  )
}

const INTENSITY_CLASSES = [
  'bg-muted',
  'bg-primary/20',
  'bg-primary/40',
  'bg-primary/65',
  'bg-primary',
]

function TopTags({ items }: { items: StatsResponse['top_tags'] }) {
  return (
    <section className="rounded-lg border bg-card p-4 md:p-6">
      <h2 className="mb-3 text-sm font-semibold">常用標籤</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚未使用任何標籤。</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((t) => (
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
      )}
    </section>
  )
}

function TopLocations({ items }: { items: StatsResponse['top_locations'] }) {
  return (
    <section className="rounded-lg border bg-card p-4 md:p-6">
      <h2 className="mb-3 text-sm font-semibold">常去地點</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚未紀錄地點。</p>
      ) : (
        <ul className="space-y-1">
          {items.map((l) => (
            <li key={l.location}>
              <Link
                href={`/search?location=${encodeURIComponent(l.location)}`}
                className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent"
              >
                <span>📍 {l.location}</span>
                <span className="text-xs text-muted-foreground">{l.count} 次</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function isoOf(d: Date): string {
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
