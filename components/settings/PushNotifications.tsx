'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type State =
  | 'unsupported'
  | 'no-vapid'
  | 'denied'
  | 'idle' // permission default
  | 'subscribed'
  | 'error'

export function PushNotifications() {
  const [state, setState] = useState<State>('idle')
  const [busy, setBusy] = useState(false)
  const [endpoint, setEndpoint] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (
      !('serviceWorker' in navigator) ||
      !('Notification' in window) ||
      !('PushManager' in window)
    ) {
      setState('unsupported')
      return
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState('no-vapid')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          setState('subscribed')
          setEndpoint(sub.endpoint)
        } else {
          setState('idle')
        }
      } catch {
        setState('error')
      }
    })()
  }, [])

  async function subscribe() {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        if (permission === 'denied') setState('denied')
        toast.error('需要允許通知權限')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapid) {
        setState('no-vapid')
        toast.error('伺服器沒設定 VAPID key')
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      })
      const json = sub.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          user_agent: navigator.userAgent,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '訂閱失敗')
      }
      setState('subscribed')
      setEndpoint(json.endpoint)
      toast.success('已訂閱推播通知')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '訂閱失敗'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  async function unsubscribe() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch(
          `/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
          { method: 'DELETE' },
        )
      }
      setState('idle')
      setEndpoint(null)
      toast.success('已取消訂閱')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '取消訂閱失敗'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setBusy(true)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || '送出失敗')
      toast.success(`已送出測試（${body.sent} 成功 / ${body.failed} 失敗）`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '送出失敗'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  if (state === 'unsupported') {
    return (
      <p className="text-sm text-muted-foreground">
        瀏覽器不支援推播通知（試試 Chrome / Edge / Safari）。
      </p>
    )
  }
  if (state === 'no-vapid') {
    return (
      <p className="text-sm text-muted-foreground">
        伺服器尚未設定 VAPID key，推播功能暫時無法使用。
      </p>
    )
  }
  if (state === 'denied') {
    return (
      <p className="text-sm text-muted-foreground">
        通知權限已被瀏覽器封鎖。請到瀏覽器設定中重新允許 journal-app
        的通知權限。
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        每天 21:00（台灣時間）若還沒寫日誌會推一則溫柔提醒。
      </p>
      <div className="flex flex-wrap gap-2">
        {state !== 'subscribed' ? (
          <Button size="sm" onClick={subscribe} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bell className="h-3.5 w-3.5" />
            )}
            開啟推播
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={sendTest} disabled={busy}>
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              發測試通知
            </Button>
            <Button variant="ghost" size="sm" onClick={unsubscribe} disabled={busy}>
              <BellOff className="h-3.5 w-3.5" />
              停用推播
            </Button>
          </>
        )}
      </div>
      {endpoint && (
        <p className="break-all text-[10px] text-muted-foreground">
          訂閱端點：{endpoint.slice(0, 60)}…
        </p>
      )}
    </div>
  )
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const standard = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(standard)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}
