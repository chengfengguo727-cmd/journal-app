import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isValidISODate, todayISO } from '@/lib/utils'
import { JournalEditor } from '@/components/editor/JournalEditor'
import { PhotoAttach } from '@/components/editor/PhotoAttach'
import { VoiceMemos } from '@/components/editor/VoiceMemos'
import type { JournalEntry } from '@/types'

interface Props {
  params: { date: string }
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function formatChinese(date: string): { full: string; weekday: string } {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return {
    full: `${y}年${m}月${d}日`,
    weekday: `星期${WEEKDAYS[dt.getDay()]}`,
  }
}

export default async function JournalPage({ params }: Props) {
  const { date } = params
  if (!isValidISODate(date)) notFound()

  const today = todayISO()
  if (date > today) {
    // 未來日期不能寫，導回今天
    redirect(`/journal/${today}`)
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entry } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle<JournalEntry>()

  const prev = shiftDate(date, -1)
  const next = shiftDate(date, 1)
  const isFutureNext = next > today
  const fmt = formatChinese(date)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur md:px-6">
        <Link
          href={`/journal/${prev}`}
          className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
          aria-label="前一天"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <div className="text-base font-semibold">{fmt.full}</div>
          <div className="text-xs text-muted-foreground">
            {fmt.weekday}
            {date === today && <span className="ml-2 text-primary">· 今天</span>}
          </div>
        </div>
        {isFutureNext ? (
          <span className="h-9 w-9" />
        ) : (
          <Link
            href={`/journal/${next}`}
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
            aria-label="後一天"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </header>

      <JournalEditor date={date} initialEntry={entry} />
      <VoiceMemos date={date} />
      <PhotoAttach date={date} userId={user.id} />
    </div>
  )
}
