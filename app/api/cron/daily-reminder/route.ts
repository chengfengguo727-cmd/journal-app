import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendPush, isPushConfigured } from '@/lib/push'

/**
 * GET /api/cron/daily-reminder
 *
 * 由 Vercel Cron 在台灣時間 21:00（= UTC 13:00）觸發。
 * 對所有「今天還沒寫日誌」的訂閱者推一則提醒。
 *
 * 需要 SUPABASE_SERVICE_ROLE_KEY env 才能用 service-role 跨用戶查詢。
 * Vercel 會帶 Authorization: Bearer ${CRON_SECRET}，我們驗一下避免被外部觸發。
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ error: 'push not configured' }, { status: 503 })
  }

  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'service-role credentials not configured' },
      { status: 503 },
    )
  }

  const admin = createServiceClient(serviceUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // 以台灣時區判斷今天日期
  const todayTW = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  // 一次撈出今天有寫日誌的 user_id 集合，避免 N+1
  const uniqueUserIds = Array.from(new Set(subs.map((s) => s.user_id)))
  const { data: writtenRows } = await admin
    .from('journal_entries')
    .select('user_id')
    .in('user_id', uniqueUserIds)
    .eq('date', todayTW)

  const wroteToday = new Set((writtenRows ?? []).map((r) => r.user_id as string))

  let sent = 0
  let skipped = 0
  let failed = 0
  const goneEndpoints: string[] = []

  for (const s of subs) {
    if (wroteToday.has(s.user_id)) {
      skipped++
      continue
    }
    const result = await sendPush(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      {
        title: '今天的日誌還沒寫喔',
        body: '花 3 分鐘記下今天值得記住的事',
        url: '/',
        tag: 'daily-reminder',
      },
    )
    if (result.ok) sent++
    else {
      failed++
      if (result.gone) goneEndpoints.push(s.endpoint)
    }
  }

  if (goneEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', goneEndpoints)
  }

  return NextResponse.json({
    ok: true,
    today_tw: todayTW,
    sent,
    skipped,
    failed,
    gone: goneEndpoints.length,
  })
}
