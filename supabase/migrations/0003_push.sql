-- =====================================================
-- Phase 5：Web Push 訂閱
-- =====================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_push" ON push_subscriptions;
CREATE POLICY "own_push" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT ALL ON TABLE push_subscriptions TO authenticated;

-- 給 cron job 使用的 service-role 也需要存取（service_role 預設繞過 RLS，但
-- 為了清楚還是 grant 一下）
GRANT SELECT, DELETE ON TABLE push_subscriptions TO service_role;
