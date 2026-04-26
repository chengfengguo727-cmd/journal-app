'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { JournalPhoto } from '@/types'

export default function GalleryPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [photos, setPhotos] = useState<JournalPhoto[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    fetch(`/api/photos?month=${monthStr}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setPhotos(Array.isArray(d) ? d : [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [year, month])

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m); setYear(y)
  }

  // 依日期分組
  const byDate = photos.reduce<Record<string, JournalPhoto[]>>((acc, p) => {
    (acc[p.date] = acc[p.date] || []).push(p)
    return acc
  }, {})
  const sortedDates = Object.keys(byDate).sort().reverse()

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
          aria-label="上個月"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold">
          {year} 年 {month} 月相片
          {loading && <span className="ml-2 text-xs font-normal text-muted-foreground">載入中…</span>}
        </h1>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
          aria-label="下個月"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!loading && photos.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          這個月還沒有照片。到日誌頁面上傳吧。
        </p>
      )}

      <div className="space-y-6">
        {sortedDates.map((date) => (
          <section key={date}>
            <Link
              href={`/journal/${date}`}
              className="mb-2 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {date} →
            </Link>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6">
              {byDate[date].map((photo) => (
                <Link
                  key={photo.id}
                  href={`/journal/${date}`}
                  className="aspect-square overflow-hidden rounded-md bg-muted"
                >
                  <img
                    src={photo.photo_url}
                    alt={photo.caption ?? ''}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                  />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
