import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidISODate } from '@/lib/utils'
import { transcribeAudio } from '@/lib/whisper'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024 // Whisper 上限 25MB

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 })
  }

  const audio = formData.get('audio')
  const date = formData.get('date')
  const durationStr = formData.get('duration')

  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: 'missing audio' }, { status: 400 })
  }
  if (typeof date !== 'string' || !isValidISODate(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'audio too large (max 25MB)' }, { status: 413 })
  }

  // 副檔名（從 mimeType 推得；Whisper 看副檔名）
  const ext = mimeToExt(audio.type)
  const filename = `${crypto.randomUUID()}.${ext}`
  const storagePath = `${user.id}/${date}/${filename}`

  // 1) 上傳音檔到 Storage（private bucket）
  const { error: uploadErr } = await supabase.storage
    .from('voice-memos')
    .upload(storagePath, audio, {
      contentType: audio.type || 'audio/webm',
      upsert: false,
    })
  if (uploadErr) {
    return NextResponse.json({ error: `upload failed: ${uploadErr.message}` }, { status: 500 })
  }

  // 2) 呼叫 Whisper 轉文字
  let transcript = ''
  try {
    transcript = await transcribeAudio({
      audio,
      filename,
      language: 'zh',
    })
  } catch (err) {
    // Whisper 失敗仍保留音檔，使用者可日後重試或手動聽
    const msg = err instanceof Error ? err.message : 'transcription failed'
    return NextResponse.json({ error: msg, storage_path: storagePath }, { status: 502 })
  }

  // 3) 找當日 entry_id
  const { data: entry } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()

  // 4) 寫入 voice_memos
  const duration = durationStr ? Math.round(Number(durationStr)) : null
  const { data: memo, error: insertErr } = await supabase
    .from('voice_memos')
    .insert({
      user_id: user.id,
      entry_id: entry?.id ?? null,
      date,
      audio_url: storagePath, // 儲存路徑而非完整 URL，播放時動態 sign
      transcript,
      duration_seconds: duration,
      transcribed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertErr) {
    await supabase.storage.from('voice-memos').remove([storagePath])
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    transcript,
    memo_id: memo.id,
    duration_seconds: memo.duration_seconds,
  })
}

function mimeToExt(mime: string): string {
  if (mime.startsWith('audio/webm')) return 'webm'
  if (mime.startsWith('audio/mp4')) return 'm4a'
  if (mime.startsWith('audio/mpeg')) return 'mp3'
  if (mime.startsWith('audio/wav')) return 'wav'
  if (mime.startsWith('audio/ogg')) return 'ogg'
  return 'webm'
}
