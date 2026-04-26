-- =====================================================
-- 私人日誌系統 — 初始 schema
-- 對應規劃書 §3.1
-- =====================================================

-- 日誌條目主表
CREATE TABLE IF NOT EXISTS journal_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  title         TEXT,
  content       TEXT,
  content_html  TEXT,
  mood_score    SMALLINT CHECK (mood_score BETWEEN 1 AND 5),
  mood_tags     TEXT[] DEFAULT '{}',
  custom_tags   TEXT[] DEFAULT '{}',
  people_tags   TEXT[] DEFAULT '{}',
  weather       TEXT,
  location      TEXT,
  location_lat  DECIMAL(9,6),
  location_lng  DECIMAL(9,6),
  word_count    INTEGER DEFAULT 0,
  is_favorite   BOOLEAN DEFAULT FALSE,
  ai_summary    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 語音備忘錄（多筆/每天）
CREATE TABLE IF NOT EXISTS voice_memos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id         UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  date             DATE NOT NULL,
  audio_url        TEXT NOT NULL,
  transcript       TEXT,
  duration_seconds INTEGER,
  transcribed_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 照片紀錄
CREATE TABLE IF NOT EXISTS journal_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id        UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  date            DATE NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('upload', 'google_photos')),
  photo_url       TEXT NOT NULL,
  original_url    TEXT,
  google_photo_id TEXT,
  caption         TEXT,
  taken_at        TIMESTAMPTZ,
  lat             DECIMAL(9,6),
  lng             DECIMAL(9,6),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Google Photos 授權記錄
CREATE TABLE IF NOT EXISTS google_photos_auth (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TIMESTAMPTZ,
  connected_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 快速備忘
CREATE TABLE IF NOT EXISTS quick_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  content    TEXT NOT NULL,
  note_type  TEXT DEFAULT 'text' CHECK (note_type IN ('text', 'voice', 'photo')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 索引
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON journal_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_entries_mood      ON journal_entries(user_id, mood_score);
CREATE INDEX IF NOT EXISTS idx_entries_tags      ON journal_entries USING GIN(custom_tags);
CREATE INDEX IF NOT EXISTS idx_photos_user_date  ON journal_photos(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_memos_user_date   ON voice_memos(user_id, date DESC);

-- =====================================================
-- updated_at 自動更新 trigger
-- =====================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entries_updated_at ON journal_entries;
CREATE TRIGGER trg_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- Row Level Security
-- =====================================================
ALTER TABLE journal_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_memos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_photos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_photos_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_notes        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_entries" ON journal_entries;
CREATE POLICY "own_entries" ON journal_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_memos" ON voice_memos;
CREATE POLICY "own_memos" ON voice_memos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_photos" ON journal_photos;
CREATE POLICY "own_photos" ON journal_photos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_google_auth" ON google_photos_auth;
CREATE POLICY "own_google_auth" ON google_photos_auth
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_notes" ON quick_notes;
CREATE POLICY "own_notes" ON quick_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 表級 GRANT — 透過 SQL Editor 建立的表不會自動授權給 authenticated 角色
-- 必須明確 GRANT，否則即使 RLS 政策正確，仍會報 "permission denied for table"
-- =====================================================
GRANT ALL ON TABLE
  journal_entries,
  voice_memos,
  journal_photos,
  google_photos_auth,
  quick_notes
TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
