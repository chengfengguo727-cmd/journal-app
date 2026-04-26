'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, todayISO } from '@/lib/utils'
import { MOOD_EMOJIS, type MoodScore } from '@/types'

interface MonthData {
  dates: string[]
  mood_scores: Record<string, MoodScore>
  word_counts: Record<string, number>
}

const WEEKDAY_HEADERS = ['日', '一', '二', '三', '四', '五', '六']

export function CalendarView() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [data, setData] = useState<MonthData>({
    dates: [],
    mood_scores: {},
    word_counts: {},
  })
  const [loading, setLoading] = useState(false)

  const today = todayISO()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/entries?year=${year}&month=${month}`)
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
  }, [year, month])

  const cells = useMemo(() => buildMonthCells(year, month), [year, month])
  const writtenSet = useMemo(() => new Set(data.dates), [data.dates])

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
          aria-label="上一個月"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">
          {year} 年 {month} 月
          {loading && <span className="ml-2 text-xs text-muted-foreground">載入中…</span>}
        </h2>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
          aria-label="下一個月"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_HEADERS.map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="aspect-square" />
          const written = writtenSet.has(cell.iso)
          const mood = data.mood_scores[cell.iso]
          const isToday = cell.iso === today
          const isFuture = cell.iso > today

          const inner = (
            <div
              className={cn(
                'flex aspect-square flex-col items-center justify-center rounded-md text-sm transition-colors',
                isFuture
                  ? 'cursor-not-allowed text-muted-foreground/40'
                  : 'cursor-pointer hover:bg-accent',
                written && !isFuture && 'bg-primary/10',
                isToday && 'ring-2 ring-primary',
              )}
            >
              <span className={cn(written && 'font-semibold')}>{cell.day}</span>
              {mood && <span className="text-xs leading-none">{MOOD_EMOJIS[mood]}</span>}
            </div>
          )

          return isFuture ? (
            <div key={i}>{inner}</div>
          ) : (
            <Link key={i} href={`/journal/${cell.iso}`}>
              {inner}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function buildMonthCells(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: Array<{ day: number; iso: string } | null> = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, iso })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
