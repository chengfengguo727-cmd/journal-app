import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPush, isPushConfigured } from '@/lib/push'

/**
 * POST /api/push/test
 * 對目前使用者的所有訂閱推一筆測試通知。
 */
export async function POST() {
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: 'VAPID keys not configured on server' },
      { status: 503 },
    )
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: '尚未訂閱通知' }, { status: 400 })
  }

  let ok = 0
  let fail = 0
  const goneEndpoints: string[] = []
  for (const s of subs) {
    const result = await sendPush(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      {
        title: '測試通知',
        body: '看到這則代表 push 設定成功 🎉',
        url: '/',
        tag: 'test',
      },
    )
    if (result.ok) ok++
    else {
      fail++
      if (result.gone) goneEndpoints.push(s.endpoint)
    }
  }

  // 清掉失效訂閱
  if (goneEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .in('endpoint', goneEndpoints)
  }

  return NextResponse.json({ sent: ok, failed: fail, gone: goneEndpoints.length })
}
