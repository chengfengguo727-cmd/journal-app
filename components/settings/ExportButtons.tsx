'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function ExportButtons() {
  const [busy, setBusy] = useState<string | null>(null)

  async function download(path: string, key: string, label: string) {
    setBusy(key)
    try {
      const res = await fetch(path)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `下載失敗 (${res.status})`)
      }
      const blob = await res.blob()
      const filename =
        parseFilename(res.headers.get('Content-Disposition')) ??
        `journal-${new Date().toISOString().slice(0, 10)}.${path.endsWith('json') ? 'json' : 'zip'}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${label} 已下載`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '下載失敗'
      toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        匯出全部資料，可作為備份或轉移到其他工具使用。
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => download('/api/export/json', 'json', 'JSON')}
        >
          {busy === 'json' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          下載 JSON（完整結構）
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => download('/api/export/markdown', 'md', 'Markdown zip')}
        >
          {busy === 'md' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          下載 Markdown zip（每天一支）
        </Button>
      </div>
    </div>
  )
}

function parseFilename(header: string | null): string | null {
  if (!header) return null
  const m = header.match(/filename="?([^"]+)"?/)
  return m ? m[1] : null
}
