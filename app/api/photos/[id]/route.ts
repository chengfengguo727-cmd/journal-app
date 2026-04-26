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

  // 先取得 photo_url 以解析 storage path
  const { data: photo, error: fetchErr } = await supabase
    .from('journal_photos')
    .select('id, photo_url, source')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!photo) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // 從 public URL 解出 storage path（格式：.../storage/v1/object/public/journal-photos/<path>）
  if (photo.source === 'upload') {
    const m = photo.photo_url.match(/\/storage\/v1\/object\/public\/journal-photos\/(.+)$/)
    if (m) {
      await supabase.storage.from('journal-photos').remove([m[1]])
    }
  }

  const { error: deleteErr } = await supabase
    .from('journal_photos')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
