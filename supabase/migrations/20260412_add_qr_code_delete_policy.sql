-- Add DELETE policy for member_qr_codes table
-- Allow Super Admin & Master Admin to delete QR codes

CREATE POLICY "super_admin_master_admin_delete_qr_codes" ON member_qr_codes
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM members 
      WHERE (role = 'super_admin' OR is_master_admin = true) 
      AND auth_user_id = auth.uid()
    )
  );
