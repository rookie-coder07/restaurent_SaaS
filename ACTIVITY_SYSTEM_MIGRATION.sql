-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_restaurant_id ON activity_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view activity logs for their restaurant
CREATE POLICY "Users can view activity logs for their restaurant" 
  ON activity_logs 
  FOR SELECT 
  USING (restaurant_id IN (
    SELECT restaurant_id FROM users WHERE id = auth.uid()
  ));

-- Policy to allow activity service to insert logs
CREATE POLICY "Allow activity service to log activities" 
  ON activity_logs 
  FOR INSERT 
  WITH CHECK (true);
