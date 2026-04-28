'use client'

import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Props {
  entryId: string | null
  initialSummary: string | null
}

export function AISummary({ entryId, initialSummary }: Props) {
  const [summary, setSummary] = useState<string | null>(initialSummary)
  const [loading, setLoading] = useState(false)

  if (!entryId) {
    return null
  }

  async function generate() {
    if (!entryId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/entries/${entryId}/summarize`, {
        method: 'POST',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || '生成失敗')
      }
      setSummary(body.summary)
      toast.success('AI 摘要已更新')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失敗'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="border-t bg-muted/20 px-4 py-4 md:px-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI 摘要
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={generate}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              生成中…
            </>
          ) : summary ? (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              重新生成
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              生成摘要
            </>
          )}
        </Button>
      </div>
      {summary ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          寫完日誌後點上方按鈕，讓 AI 幫你做個簡短摘要。
        </p>
      )}
    </section>
  )
}
