'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { listPending, removePending, pendingCount } from '@/lib/offline-queue'

/**
 * 監聽 online 事件，把 IndexedDB queue 裡的 entries replay 回 server。
 * 也在 mount 時跑一次（瀏覽器啟動就連網的情況）。
 */
export function OfflineQueueFlusher() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let inflight = false

    async function flush() {
      if (inflight) return
      if (!navigator.onLine) return
      inflight = true
      try {
        const pending = await listPending()
        if (pending.length === 0) return
        let ok = 0
        let fail = 0
        for (const item of pending) {
          try {
            const res = await fetch('/api/entries', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload),
            })
            if (res.ok) {
              await removePending(item.date)
              ok++
            } else {
              fail++
            }
          } catch {
            fail++
            break // 還在離線就停 — 等下次 online 事件
          }
        }
        if (ok > 0) {
          toast.success(`已同步 ${ok} 筆離線資料${fail > 0 ? `（${fail} 筆失敗）` : ''}`)
        }
      } finally {
        inflight = false
      }
    }

    // 啟動時先試一次
    void pendingCount().then((c) => {
      if (c > 0) void flush()
    })

    window.addEventListener('online', flush)
    return () => {
      window.removeEventListener('online', flush)
    }
  }, [])

  return null
}
