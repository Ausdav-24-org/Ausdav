-- Create member_qr_codes table for reusable QR code verification
CREATE TABLE member_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mem_id INT NOT NULL REFERENCES members(mem_id) ON DELETE CASCADE,
  qr_token VARCHAR(255) NOT NULL UNIQUE, -- Verification token embedded in QR
  qr_data JSONB NOT NULL, -- Contains member info for display
  generated_by UUID NOT NULL, -- Admin who generated this QR
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- QR expiry date
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_expired_manually BOOLEAN NOT NULL DEFAULT FALSE, -- Admin manually expired it
  scanned_count INT NOT NULL DEFAULT 0,
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_member_qr_codes_mem_id ON member_qr_codes(mem_id);
CREATE INDEX idx_member_qr_codes_token ON member_qr_codes(qr_token);
CREATE INDEX idx_member_qr_codes_is_active ON member_qr_codes(is_active);
CREATE INDEX idx_member_qr_codes_expires_at ON member_qr_codes(expires_at);
CREATE INDEX idx_member_qr_codes_generated_by ON member_qr_codes(generated_by);

-- Auto-update updated_at timestamp
CREATE TRIGGER update_member_qr_codes_updated_at
  BEFORE UPDATE ON member_qr_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE member_qr_codes ENABLE ROW LEVEL SECURITY;

-- Super Admin & Master Admin: Can see all QR codes
CREATE POLICY "super_admin_master_admin_view_all_qr_codes" ON member_qr_codes
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM members 
      WHERE (role = 'super_admin' OR is_master_admin = true) 
      AND auth_user_id = auth.uid()
    )
  );

-- Public verification endpoint can access active QR codes (via anon key)
CREATE POLICY "public_verify_qr_code" ON member_qr_codes
  FOR SELECT
  USING (
    is_active = TRUE 
    AND is_expired_manually = FALSE 
    AND expires_at > NOW()
  );

-- Super Admin & Master Admin: Can insert QR codes
CREATE POLICY "super_admin_master_admin_create_qr_codes" ON member_qr_codes
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT auth_user_id FROM members 
      WHERE (role = 'super_admin' OR is_master_admin = true) 
      AND auth_user_id = auth.uid()
    )
  );

-- Super Admin & Master Admin: Can update/expire QR codes
CREATE POLICY "super_admin_master_admin_update_qr_codes" ON member_qr_codes
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM members 
      WHERE (role = 'super_admin' OR is_master_admin = true) 
      AND auth_user_id = auth.uid()
    )
  );

-- Create audit log table for QR code scans
CREATE TABLE member_qr_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id UUID NOT NULL REFERENCES member_qr_codes(id) ON DELETE CASCADE,
  mem_id INT NOT NULL REFERENCES members(mem_id) ON DELETE CASCADE,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  scanned_from_ip VARCHAR(45), -- IPv4 or IPv6
  user_agent TEXT,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'verified', -- verified, expired, inactive
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX idx_member_qr_scan_logs_qr_code_id ON member_qr_scan_logs(qr_code_id);
CREATE INDEX idx_member_qr_scan_logs_mem_id ON member_qr_scan_logs(mem_id);
CREATE INDEX idx_member_qr_scan_logs_scanned_at ON member_qr_scan_logs(scanned_at);

-- RLS on audit logs (Super Admin & Master Admin only)
ALTER TABLE member_qr_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_master_admin_view_qr_scan_logs" ON member_qr_scan_logs
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM members 
      WHERE (role = 'super_admin' OR is_master_admin = true) 
      AND auth_user_id = auth.uid()
    )
  );

CREATE POLICY "public_create_qr_scan_logs" ON member_qr_scan_logs
  FOR INSERT
  WITH CHECK (true); -- Anyone can log a scan (public endpoint)
