-- =====================================================
-- 私人日誌系統 — Storage Buckets（Phase 2）
-- 建立兩個 bucket：journal-photos（public）、voice-memos（private）
-- =====================================================

-- Photos bucket — public（URL 可直接存取，靠 UUID 檔名做難以猜測保護）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'journal-photos',
  'journal-photos',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Voice memos bucket — private（必須透過 signed URL 存取）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-memos',
  'voice-memos',
  false,
  26214400,  -- 25 MB
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- Storage Policies（檔案路徑前綴須符合 user_id）
-- 路徑慣例：{user_id}/{YYYY-MM-DD}/{uuid}.{ext}
-- =====================================================

-- Photos
DROP POLICY IF EXISTS "photos_insert_own" ON storage.objects;
CREATE POLICY "photos_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "photos_select_own" ON storage.objects;
CREATE POLICY "photos_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "photos_update_own" ON storage.objects;
CREATE POLICY "photos_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "photos_delete_own" ON storage.objects;
CREATE POLICY "photos_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'journal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Voice memos
DROP POLICY IF EXISTS "memos_insert_own" ON storage.objects;
CREATE POLICY "memos_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-memos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "memos_select_own" ON storage.objects;
CREATE POLICY "memos_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-memos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "memos_delete_own" ON storage.objects;
CREATE POLICY "memos_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'voice-memos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
