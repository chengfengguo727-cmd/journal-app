'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface GooglePhotoItem {
  id: string
  thumbnail_url: string
  full_url: string
  filename: string
  taken_at: string | null
  linked: boolean
}

interface Props {
  date: string
}

type Status = 'idle' | 'loading' | 'loaded' | 'not_connected' | 'error'

export function GooglePhotosPanel({ date }: Props) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [items, setItems] = useState<GooglePhotoItem[]>([])
  const [linkingId, setLinkingId] = useState<string | null>(null)

  async function loadIfNeeded() {
    if (status === 'loaded') return
    setStatus('loading')
    try {
      const res = await fetch(`/api/photos/google/sync?date=${date}`)
      if (res.status === 412) {
        setStatus('not_connected')
        return
      }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || '載入失敗')
      }
      setItems(await res.json())
      setStatus('loaded')
    } catch (err) {
      setStatus('error')
      toast.error(err instanceof Error ? err.message : '載入 Google Photos 失敗')
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) void loadIfNeeded()
  }

  async function link(item: GooglePhotoItem) {
    setLinkingId(item.id)
    try {
      const res = await fetch('/api/photos/google/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          google_photo_id: item.id,
          thumbnail_url: item.thumbnail_url,
          full_url: item.full_url,
          taken_at: item.taken_at,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || '加入失敗')
      }
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, linked: true } : p)),
      )
      // 通知 PhotoAttach 刷新
      window.dispatchEvent(
        new CustomEvent('journal-photo-added', { detail: { date } }),
      )
      toast.success('已加入')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加入失敗')
    } finally {
      setLinkingId(null)
    }
  }

  return (
    <section className="border-t bg-background px-4 py-3 md:px-6">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <span>從 Google 相簿選照片</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-3">
          {status === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              載入當日照片…
            </div>
          )}

          {status === 'not_connected' && (
            <div className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm">
              <p className="mb-2 text-muted-foreground">尚未連結 Google Photos</p>
              <Link
                href="/settings"
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
              >
                到設定頁連結
              </Link>
            </div>
          )}

          {status === 'loaded' && items.length === 0 && (
            <p className="py-2 text-xs text-muted-foreground">當天 Google 相簿沒有照片。</p>
          )}

          {status === 'loaded' && items.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-square overflow-hidden rounded-md bg-muted"
                >
                  <img
                    src={item.thumbnail_url}
                    alt={item.filename}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    disabled={item.linked || linkingId === item.id}
                    onClick={() => link(item)}
                    className={cn(
                      'absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity',
                      item.linked
                        ? 'opacity-100 bg-emerald-600/70'
                        : 'group-hover:opacity-100',
                      linkingId === item.id && 'opacity-100 bg-black/60',
                    )}
                  >
                    {linkingId === item.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : item.linked ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Plus className="h-5 w-5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
