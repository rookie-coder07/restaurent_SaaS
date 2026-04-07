ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS access_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all_restaurants',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_system_settings_global_key
  ON system_settings(setting_key)
  WHERE restaurant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_system_settings_restaurant_key
  ON system_settings(restaurant_id, setting_key)
  WHERE restaurant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_global_key
  ON feature_flags(feature_key)
  WHERE restaurant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_restaurant_key
  ON feature_flags(restaurant_id, feature_key)
  WHERE restaurant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_broadcast_notifications_created_at
  ON broadcast_notifications(created_at DESC);

INSERT INTO feature_flags (restaurant_id, feature_key, enabled)
VALUES
  (NULL, 'qr_ordering', true),
  (NULL, 'inventory', true),
  (NULL, 'analytics', true),
  (NULL, 'notifications', true)
ON CONFLICT DO NOTHING;
