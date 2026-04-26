import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: memo, error: fetchErr } = await supabase
    .from('voice_memos')
    .select('id, audio_url')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!memo) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // 刪 storage（audio_url 是 path）
  if (memo.audio_url) {
    await supabase.storage.from('voice-memos').remove([memo.audio_url])
  }

  const { error: deleteErr } = await supabase
    .from('voice_memos')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
