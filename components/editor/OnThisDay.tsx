'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarHeart } from 'lucide-react'
import { MOOD_EMOJIS, type MoodScore } from '@/types'

interface Hit {
  id: string
  date: string
  title: string | null
  content: string | null
  mood_score: MoodScore | null
  word_count: number | null
}

interface Props {
  date: string
}

export function OnThisDay({ date }: Props) {
  const [hits, setHits] = useState<Hit[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/on-this-day?date=${date}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Hit[]) => {
        if (!cancelled) setHits(data)
      })
      .catch(() => {
        if (!cancelled) setHits([])
      })
    return () => {
      cancelled = true
    }
  }, [date])

  if (hits === null) return null
  if (hits.length === 0) return null

  return (
    <section className="border-t bg-muted/10 px-4 py-4 md:px-6">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <CalendarHeart className="h-3.5 w-3.5 text-primary" />
        過往的今天
      </h3>
      <ul className="space-y-2">
        {hits.map((h) => {
          const yearsAgo = parseInt(date.slice(0, 4), 10) - parseInt(h.date.slice(0, 4), 10)
          return (
            <li key={h.id}>
              <Link
                href={`/journal/${h.date}`}
                className="block rounded-md border bg-card p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">
                    {h.mood_score && (
                      <span className="mr-2">{MOOD_EMOJIS[h.mood_score]}</span>
                    )}
                    {yearsAgo} 年前的今天
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {h.date}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {h.word_count ?? 0} 字
                  </div>
                </div>
                {h.title && (
                  <div className="mt-1 text-sm text-muted-foreground">{h.title}</div>
                )}
                {h.content && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {h.content.slice(0, 140)}
                  </p>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
