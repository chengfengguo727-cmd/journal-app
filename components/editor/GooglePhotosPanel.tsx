'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface PickerItem {
  id: string
  type: 'PHOTO' | 'VIDEO'
  thumbnail_url: string
  full_url: string
  filename: string
  taken_at: string | null
  linked: boolean
}

interface Props {
  date: string
}

type State =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'waiting'; sessionId: string; pickerUri: string }
  | { kind: 'linking'; total: number; done: number }
  | { kind: 'not_connected' }
  | { kind: 'error'; message: string }

export function GooglePhotosPanel({ date }: Props) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<State>({ kind: 'idle' })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => () => stopPoll(), [])

  async function startPicker() {
    setState({ kind: 'creating' })
    try {
      const res = await fetch('/api/photos/google/picker/session', {
        method: 'POST',
      })
      if (res.status === 412) {
        setState({ kind: 'not_connected' })
        return
      }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || '建立 session 失敗')
      }
      const { session_id, picker_uri, polling_interval_ms } = await res.json()

      window.open(picker_uri, '_blank', 'noopener,noreferrer')
      setState({ kind: 'waiting', sessionId: session_id, pickerUri: picker_uri })

      const interval = Math.max(2000, polling_interval_ms || 3000)
      pollRef.current = setInterval(() => void pollSession(session_id), interval)
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : '失敗',
      })
    }
  }

  async function pollSession(sessionId: string) {
    try {
      const res = await fetch(
        `/api/photos/google/picker/poll?session_id=${sessionId}`,
      )
      if (!res.ok) return
      const { media_items_set } = await res.json()
      if (media_items_set) {
        stopPoll()
        await fetchAndLink(sessionId)
      }
    } catch {
      // 略過 poll 失敗
    }
  }

  async function fetchAndLink(sessionId: string) {
    let items: PickerItem[]
    try {
      const res = await fetch(
        `/api/photos/google/picker/items?session_id=${sessionId}`,
      )
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || '讀取照片失敗')
      }
      items = await res.json()
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : '讀取失敗',
      })
      return
    }

    const toLink = items.filter((i) => !i.linked)
    if (toLink.length === 0) {
      toast(items.length > 0 ? '挑選的照片都已經加入過了' : '沒有選任何照片')
      cleanup(sessionId)
      return
    }

    setState({ kind: 'linking', total: toLink.length, done: 0 })

    let done = 0
    let failed = 0
    for (const item of toLink) {
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
        if (!res.ok) throw new Error()
      } catch {
        failed++
      }
      done++
      setState({ kind: 'linking', total: toLink.length, done })
    }

    window.dispatchEvent(
      new CustomEvent('journal-photo-added', { detail: { date } }),
    )

    if (failed > 0) {
      toast.error(`加入 ${done - failed} 張，失敗 ${failed} 張`)
    } else {
      toast.success(`已加入 ${done} 張`)
    }

    cleanup(sessionId)
  }

  function cleanup(sessionId: string) {
    void fetch(
      `/api/photos/google/picker/session?session_id=${sessionId}`,
      { method: 'DELETE' },
    )
    setState({ kind: 'idle' })
  }

  function reset() {
    stopPoll()
    if (state.kind === 'waiting') {
      cleanup(state.sessionId)
    } else {
      setState({ kind: 'idle' })
    }
  }

  return (
    <section className="border-t bg-background px-4 py-3 md:px-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <span>從 Google 相簿選照片</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-3">
          {state.kind === 'idle' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                會開新視窗讓你從 Google 相簿挑照片，挑完關掉視窗就會自動加入日誌。
                <br />
                ⚠️ 因 Google API 限制，連結的照片約 7 天後失效，需重新挑選。
              </p>
              <button
                type="button"
                onClick={startPicker}
                className="rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-accent"
              >
                開啟 Google 相簿
              </button>
            </div>
          )}

          {state.kind === 'creating' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              建立 session…
            </div>
          )}

          {state.kind === 'waiting' && (
            <div className="space-y-2 rounded-md border border-dashed p-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                等你在 Google 視窗選照片完成…
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={state.pickerUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  重新打開選擇視窗
                </a>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={reset}
                  className="text-muted-foreground hover:text-foreground"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {state.kind === 'linking' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              加入中… {state.done}/{state.total}
            </div>
          )}

          {state.kind === 'not_connected' && (
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

          {state.kind === 'error' && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <p className="text-destructive">錯誤：{state.message}</p>
              <button
                type="button"
                onClick={reset}
                className="mt-1 text-muted-foreground hover:text-foreground"
              >
                重試
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
