'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MOOD_EMOJIS, MOOD_LABELS, type MoodScore } from '@/types'

interface SearchHit {
  id: string
  date: string
  title: string | null
  content: string | null
  mood_score: MoodScore | null
  mood_tags: string[] | null
  custom_tags: string[] | null
  people_tags: string[] | null
  location: string | null
  word_count: number | null
}

interface Filters {
  q: string
  mood: MoodScore | null
  tag: string
  location: string
  from: string
  to: string
}

const EMPTY_FILTERS: Filters = {
  q: '',
  mood: null,
  tag: '',
  location: '',
  from: '',
  to: '',
}

export function SearchView() {
  const sp = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => ({
    q: sp.get('q') ?? '',
    mood: parseMood(sp.get('mood')),
    tag: sp.get('tag') ?? '',
    location: sp.get('location') ?? '',
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
  }))
  const [results, setResults] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const hasAnyFilter = useMemo(
    () =>
      Boolean(
        filters.q ||
          filters.mood ||
          filters.tag ||
          filters.location ||
          filters.from ||
          filters.to,
      ),
    [filters],
  )

  useEffect(() => {
    if (!hasAnyFilter) {
      setResults([])
      setSubmitted(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSearch(filters)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  async function runSearch(f: Filters) {
    setLoading(true)
    setSubmitted(true)
    const params = new URLSearchParams()
    if (f.q) params.set('q', f.q)
    if (f.mood) params.set('mood', String(f.mood))
    if (f.tag) params.set('tag', f.tag)
    if (f.location) params.set('location', f.location)
    if (f.from) params.set('from', f.from)
    if (f.to) params.set('to', f.to)
    try {
      const res = await fetch(`/api/search?${params.toString()}`)
      if (!res.ok) {
        setResults([])
        return
      }
      const data = (await res.json()) as SearchHit[]
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setFilters(EMPTY_FILTERS)
    setResults([])
    setSubmitted(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border bg-card p-4 md:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="搜尋標題、內文…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">心情</span>
          {([1, 2, 3, 4, 5] as MoodScore[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() =>
                setFilters({ ...filters, mood: filters.mood === m ? null : m })
              }
              title={MOOD_LABELS[m]}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-base transition-all',
                filters.mood === m
                  ? 'bg-primary/15 ring-2 ring-primary'
                  : 'opacity-60 hover:opacity-100 hover:bg-accent',
              )}
            >
              {MOOD_EMOJIS[m]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            value={filters.tag}
            onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
            placeholder="標籤（custom / mood / people 任一符合）"
          />
          <Input
            value={filters.location}
            onChange={(e) =>
              setFilters({ ...filters, location: e.target.value })
            }
            placeholder="地點"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            從
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="h-9"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            到
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="h-9"
            />
          </label>
        </div>

        {hasAnyFilter && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="h-3.5 w-3.5" />
              清除條件
            </Button>
          </div>
        )}
      </div>

      <div>
        {!hasAnyFilter ? (
          <p className="text-sm text-muted-foreground">
            輸入關鍵字或選擇條件開始搜尋。
          </p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">搜尋中…</p>
        ) : results.length === 0 ? (
          submitted && (
            <p className="text-sm text-muted-foreground">沒有符合的日誌。</p>
          )
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              共 {results.length} 篇{results.length >= 100 && '（顯示前 100 篇）'}
            </p>
            <ul className="space-y-2">
              {results.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/journal/${e.date}`}
                    className="block rounded-md border bg-card p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">
                        {e.mood_score && (
                          <span className="mr-2">
                            {MOOD_EMOJIS[e.mood_score]}
                          </span>
                        )}
                        {e.date}
                        {e.title && (
                          <span className="ml-2 text-muted-foreground font-normal">
                            · {e.title}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.word_count ?? 0} 字
                      </div>
                    </div>
                    {e.content && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {snippetAround(e.content, filters.q)}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {e.location && (
                        <span className="text-xs text-muted-foreground">
                          📍 {e.location}
                        </span>
                      )}
                      {[
                        ...(e.custom_tags ?? []),
                        ...(e.mood_tags ?? []),
                        ...(e.people_tags ?? []),
                      ]
                        .slice(0, 6)
                        .map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                          >
                            {t}
                          </span>
                        ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function parseMood(v: string | null): MoodScore | null {
  if (!v) return null
  const n = parseInt(v, 10)
  return n >= 1 && n <= 5 ? (n as MoodScore) : null
}

function snippetAround(content: string, q: string, radius = 60): string {
  if (!q) return content.slice(0, 140)
  const idx = content.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return content.slice(0, 140)
  const start = Math.max(0, idx - radius)
  const end = Math.min(content.length, idx + q.length + radius)
  return (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '')
}
