-- Drop old activity_logs table if it exists
DROP TABLE IF EXISTS activity_logs CASCADE;

-- Create fresh activity_logs table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_activity_restaurant ON activity_logs(restaurant_id);
CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_restaurant_user ON activity_logs(restaurant_id, user_id);

-- Disable RLS - backend controls access via API layer
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;

-- Verify table was created
SELECT 'Activity logs table created successfully!' as status;
