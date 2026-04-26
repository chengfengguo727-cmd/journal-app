import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CalendarView } from '@/components/timeline/CalendarView'
import { MOOD_EMOJIS, type MoodScore } from '@/types'

interface RecentEntry {
  id: string
  date: string
  title: string | null
  content: string | null
  mood_score: MoodScore | null
  custom_tags: string[] | null
  word_count: number | null
}

export default async function TimelinePage() {
  const supabase = createClient()
  const { data: user } = await supabase.auth.getUser()
  const { data: entries } = await supabase
    .from('journal_entries')
    .select('id, date, title, content, mood_score, custom_tags, word_count')
    .eq('user_id', user.user?.id as string)
    .order('date', { ascending: false })
    .limit(20)
    .returns<RecentEntry[]>()

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <h1 className="mb-6 text-2xl font-bold">時間軸</h1>

      <section className="mb-10 rounded-lg border bg-card p-4 md:p-6">
        <CalendarView />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">最近的日誌</h2>
        {!entries || entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">還沒有任何日誌，去寫一篇吧。</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/journal/${e.date}`}
                  className="block rounded-md border bg-card p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">
                      {e.mood_score && <span className="mr-2">{MOOD_EMOJIS[e.mood_score]}</span>}
                      {e.date}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.word_count ?? 0} 字
                    </div>
                  </div>
                  {e.content && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {e.content.slice(0, 120)}
                    </p>
                  )}
                  {e.custom_tags && e.custom_tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.custom_tags.slice(0, 5).map((t) => (
                        <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
