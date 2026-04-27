'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Status {
  connected: boolean
  connected_at: string | null
}

export function GooglePhotosConnect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    void load()
    // 處理 OAuth 回來的 query 訊息
    const result = searchParams.get('google')
    if (result === 'connected') {
      toast.success('已連結 Google Photos')
      router.replace('/settings')
    } else if (result === 'error') {
      const reason = searchParams.get('reason') ?? ''
      toast.error('連結失敗：' + decodeURIComponent(reason))
      router.replace('/settings')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/photos/google/status')
      if (!res.ok) throw new Error()
      setStatus(await res.json())
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  async function disconnect() {
    if (!confirm('確定中斷與 Google Photos 的連結？已加入日誌的照片連結不會被刪除（但下次刷新會載不到）。')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/photos/google/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('中斷失敗')
      setStatus({ connected: false, connected_at: null })
      toast.success('已中斷連結')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '中斷失敗')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        檢查連結狀態…
      </div>
    )
  }

  if (status?.connected) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          ✓ 已連結
          {status.connected_at && (
            <span className="ml-2 text-xs">
              （{new Date(status.connected_at).toLocaleDateString('zh-TW')} 連結）
            </span>
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={disconnect}
          disabled={disconnecting}
        >
          {disconnecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Unlink className="h-3.5 w-3.5" />
          )}
          中斷連結
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        連結後可在日誌頁面開啟 Google 相簿挑選器，挑選的照片會下載一份到日誌儲存空間。
      </p>
      <Button asChild size="sm">
        <a href="/api/photos/google/auth">
          <Link2 className="h-3.5 w-3.5" />
          連結 Google Photos
        </a>
      </Button>
    </div>
  )
}
