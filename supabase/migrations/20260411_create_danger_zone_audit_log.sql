-- Create danger zone audit log table
CREATE TABLE IF NOT EXISTS admin_danger_zone_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  reason_note TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_danger_zone_logs_admin_id ON admin_danger_zone_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_danger_zone_logs_page ON admin_danger_zone_logs(page);
CREATE INDEX IF NOT EXISTS idx_danger_zone_logs_action ON admin_danger_zone_logs(action);
CREATE INDEX IF NOT EXISTS idx_danger_zone_logs_created_at ON admin_danger_zone_logs(created_at);

-- Enable RLS
ALTER TABLE admin_danger_zone_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- SELECT: Only super admins can view logs
CREATE POLICY "Super admins can view danger zone logs"
  ON admin_danger_zone_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  );

-- INSERT: Any admin can log their own danger zone actions
CREATE POLICY "Admins can log their own danger zone actions"
  ON admin_danger_zone_logs
  FOR INSERT
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role IN ('admin', 'super_admin')
    )
  );

-- UPDATE: Only super admins can update logs
CREATE POLICY "Super admins can update danger zone logs"
  ON admin_danger_zone_logs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  );

-- DELETE: Only super admins can delete logs
CREATE POLICY "Super admins can delete danger zone logs"
  ON admin_danger_zone_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  );

-- Create audit trigger
CREATE OR REPLACE FUNCTION update_danger_zone_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS danger_zone_logs_updated_at ON admin_danger_zone_logs;
CREATE TRIGGER danger_zone_logs_updated_at
  BEFORE UPDATE ON admin_danger_zone_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_danger_zone_logs_updated_at();
