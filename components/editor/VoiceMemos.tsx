'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface VoiceMemo {
  id: string
  date: string
  audio_url: string
  signed_url: string | null
  transcript: string | null
  duration_seconds: number | null
  created_at: string
}

interface Props {
  date: string
}

export function VoiceMemos({ date }: Props) {
  const [memos, setMemos] = useState<VoiceMemo[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/voice?date=${date}`)
      if (!res.ok) throw new Error('讀取失敗')
      setMemos(await res.json())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '讀取語音失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as { date?: string } | undefined
      if (detail?.date === date) void load()
    }
    window.addEventListener('voice-memo-added', handler)
    return () => window.removeEventListener('voice-memo-added', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  async function handleDelete(memo: VoiceMemo) {
    if (!confirm('刪除這段語音？')) return
    try {
      const res = await fetch(`/api/voice/${memo.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('刪除失敗')
      setMemos((prev) => prev.filter((m) => m.id !== memo.id))
      toast.success('已刪除')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '刪除失敗')
    }
  }

  if (loading) return null
  if (memos.length === 0) return null

  return (
    <section className="border-t bg-background px-4 py-4 md:px-6">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        語音 · {memos.length}
      </h2>
      <ul className="space-y-3">
        {memos.map((memo) => (
          <li key={memo.id} className="rounded-md border bg-card p-3">
            <div className="flex items-center gap-3">
              {memo.signed_url ? (
                <audio
                  controls
                  preload="none"
                  src={memo.signed_url}
                  className="h-9 flex-1"
                />
              ) : (
                <span className="flex-1 text-xs text-muted-foreground">
                  音檔不可用
                </span>
              )}
              {memo.duration_seconds != null && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {memo.duration_seconds}s
                </span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(memo)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="刪除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {memo.transcript && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {memo.transcript}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
