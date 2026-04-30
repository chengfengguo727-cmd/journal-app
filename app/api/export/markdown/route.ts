import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@/lib/supabase/server'
import { MOOD_EMOJIS, MOOD_LABELS, type MoodScore } from '@/types'

interface EntryRow {
  id: string
  date: string
  title: string | null
  content: string | null
  mood_score: number | null
  mood_tags: string[] | null
  custom_tags: string[] | null
  people_tags: string[] | null
  weather: string | null
  location: string | null
  ai_summary: string | null
}
interface PhotoRow {
  id: string
  date: string
  photo_url: string
  caption: string | null
}
interface VoiceRow {
  id: string
  date: string
  audio_url: string
  transcript: string | null
  duration_seconds: number | null
}

/**
 * GET /api/export/markdown
 * 為每篇日誌產生一支 .md，打包成 zip 下載。
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [entriesResult, photosResult, voiceResult] = await Promise.all([
    supabase
      .from('journal_entries')
      .select(
        'id, date, title, content, mood_score, mood_tags, custom_tags, people_tags, weather, location, ai_summary',
      )
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .returns<EntryRow[]>(),
    supabase
      .from('journal_photos')
      .select('id, date, photo_url, caption')
      .eq('user_id', user.id)
      .returns<PhotoRow[]>(),
    supabase
      .from('voice_memos')
      .select('id, date, audio_url, transcript, duration_seconds')
      .eq('user_id', user.id)
      .returns<VoiceRow[]>(),
  ])

  for (const r of [entriesResult, photosResult, voiceResult]) {
    if (r.error) {
      return NextResponse.json({ error: r.error.message }, { status: 500 })
    }
  }

  const entries = entriesResult.data ?? []
  const photosByDate = groupByDate(photosResult.data ?? [])
  const voiceByDate = groupByDate(voiceResult.data ?? [])

  const zip = new JSZip()

  for (const e of entries) {
    const md = buildMarkdown(
      e,
      photosByDate.get(e.date) ?? [],
      voiceByDate.get(e.date) ?? [],
    )
    // 依年份分資料夾，方便瀏覽
    const year = e.date.slice(0, 4)
    const filename = `${e.date}${e.title ? `-${slugify(e.title)}` : ''}.md`
    zip.file(`${year}/${filename}`, md)
  }

  zip.file(
    'README.md',
    `# 私人日誌匯出\n\n匯出時間：${new Date().toISOString()}\n篇數：${entries.length}\n\n按年份分資料夾，每天一支 .md。\n`,
  )

  const buf = await zip.generateAsync({ type: 'arraybuffer' })
  const filename = `journal-${new Date().toISOString().slice(0, 10)}.zip`
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function groupByDate<T extends { date: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const arr = map.get(r.date) ?? []
    arr.push(r)
    map.set(r.date, arr)
  }
  return map
}

function buildMarkdown(
  e: EntryRow,
  photos: PhotoRow[],
  voices: VoiceRow[],
): string {
  const lines: string[] = []
  const heading = e.title ? `# ${e.title}` : `# ${e.date}`
  lines.push(heading)
  lines.push('')

  // Front-matter style 元資料
  const meta: string[] = [`> **${e.date}**`]
  if (e.mood_score) {
    meta.push(
      `> 心情：${MOOD_EMOJIS[e.mood_score as MoodScore]} ${e.mood_score}/5 (${MOOD_LABELS[e.mood_score as MoodScore]})`,
    )
  }
  if (e.weather) meta.push(`> 天氣：${e.weather}`)
  if (e.location) meta.push(`> 地點：${e.location}`)
  const allTags = [
    ...(e.mood_tags ?? []),
    ...(e.custom_tags ?? []),
    ...(e.people_tags ?? []),
  ]
  if (allTags.length > 0) meta.push(`> 標籤：${allTags.join('、')}`)
  lines.push(...meta)
  lines.push('')

  if (e.ai_summary) {
    lines.push('## AI 摘要')
    lines.push('')
    lines.push(e.ai_summary)
    lines.push('')
  }

  if (e.content && e.content.trim().length > 0) {
    lines.push('## 內文')
    lines.push('')
    lines.push(e.content)
    lines.push('')
  }

  if (photos.length > 0) {
    lines.push('## 照片')
    lines.push('')
    for (const p of photos) {
      lines.push(`![${p.caption ?? ''}](${p.photo_url})`)
      lines.push('')
    }
  }

  if (voices.length > 0) {
    lines.push('## 語音備忘')
    lines.push('')
    for (const v of voices) {
      const dur = v.duration_seconds
        ? `（${Math.round(v.duration_seconds)} 秒）`
        : ''
      lines.push(`- 連結：${v.audio_url} ${dur}`)
      if (v.transcript) {
        lines.push(`  - 轉文字：${v.transcript}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

function slugify(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
}
