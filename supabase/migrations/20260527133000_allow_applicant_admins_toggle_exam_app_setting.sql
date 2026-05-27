-- Allow applicant admins to toggle exam application and related app settings
-- The applicants admin screen manages exam availability, so its UPDATE policy
-- must include the applicant admin permission in addition to super/master admins.

DROP POLICY IF EXISTS "admins can update exam app setting" ON public.app_settings;
CREATE POLICY "admins can update exam app setting"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (
    private.is_super_admin_or_master_admin()
    OR private.has_permission('applicant')
  )
  WITH CHECK (
    private.is_super_admin_or_master_admin()
    OR private.has_permission('applicant')
  );