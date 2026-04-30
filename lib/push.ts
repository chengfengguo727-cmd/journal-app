import webpush from 'web-push'

/**
 * Web Push 設定 + 寄送 helper。
 * 需要環境變數：
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   - VAPID_PRIVATE_KEY
 *   - VAPID_SUBJECT (mailto:you@example.com)
 *
 * VAPID key 產生方式（一次就好）：
 *   npx web-push generate-vapid-keys
 */

let configured = false
function ensureConfigured() {
  if (configured) return
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
  if (!pub || !priv) {
    throw new Error('VAPID keys not configured')
  }
  webpush.setVapidDetails(subject, pub, priv)
  configured = true
}

export interface PushSubscriptionInfo {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function sendPush(
  sub: PushSubscriptionInfo,
  payload: PushPayload,
): Promise<{ ok: boolean; statusCode?: number; gone?: boolean }> {
  ensureConfigured()
  try {
    const res = await webpush.sendNotification(
      sub,
      JSON.stringify(payload),
      { TTL: 60 * 60 },
    )
    return { ok: true, statusCode: res.statusCode }
  } catch (err: unknown) {
    const e = err as { statusCode?: number }
    // 410 / 404 = 訂閱失效，可以從 DB 刪掉
    const gone = e?.statusCode === 410 || e?.statusCode === 404
    return { ok: false, statusCode: e?.statusCode, gone }
  }
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  )
}
