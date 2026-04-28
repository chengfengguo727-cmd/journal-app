import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateText, isGeminiConfigured } from '@/lib/gemini'
import { MOOD_LABELS, type MoodScore } from '@/types'

/**
 * POST /api/entries/[id]/summarize
 * 用 Gemini 對單篇日誌生成 2–3 句的中性摘要，存到 ai_summary 欄位。
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 503 },
    )
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: entry, error: fetchErr } = await supabase
    .from('journal_entries')
    .select('id, date, title, content, mood_score, mood_tags, custom_tags, location')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!entry) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  if (!entry.content || entry.content.trim().length < 30) {
    return NextResponse.json(
      { error: '內文太短（少於 30 字），不需要摘要' },
      { status: 400 },
    )
  }

  const moodLine = entry.mood_score
    ? `心情：${entry.mood_score}/5 (${MOOD_LABELS[entry.mood_score as MoodScore]})`
    : ''
  const tagsLine =
    [...(entry.mood_tags ?? []), ...(entry.custom_tags ?? [])].length > 0
      ? `標籤：${[...(entry.mood_tags ?? []), ...(entry.custom_tags ?? [])].join('、')}`
      : ''
  const locLine = entry.location ? `地點：${entry.location}` : ''
  const titleLine = entry.title ? `標題：${entry.title}` : ''

  const prompt = [
    `日期：${entry.date}`,
    titleLine,
    moodLine,
    locLine,
    tagsLine,
    '',
    '日誌內文：',
    entry.content,
  ]
    .filter(Boolean)
    .join('\n')

  const system = `你是個人日誌的摘要助理。讀完日誌後，用繁體中文寫 2–3 句精簡摘要，捕捉「當天發生了什麼、作者的心情、值得記住的細節」。
- 用第三人稱旁白語氣，不要開頭說「這篇日誌…」
- 不要評論或建議，只忠實摘要
- 保留具體名詞與情緒詞
- 總長度 60–120 個中文字`

  let summary: string
  try {
    summary = await generateText(prompt, {
      system,
      temperature: 0.4,
      maxOutputTokens: 400,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'gemini error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const { error: updateErr } = await supabase
    .from('journal_entries')
    .update({ ai_summary: summary })
    .eq('id', entry.id)
    .eq('user_id', user.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ summary })
}
