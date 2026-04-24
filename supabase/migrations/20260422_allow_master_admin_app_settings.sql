-- ===================================================================
-- ALLOW MASTER ADMINS TO UPDATE APP SETTINGS
-- Update RLS policies on app_settings to allow master admins
-- ===================================================================

-- Create helper function to check if user is super admin OR master admin
CREATE OR REPLACE FUNCTION private.is_super_admin_or_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT exists (
    SELECT 1
    FROM private.app_config c
    WHERE c.id = 1
      AND c.super_admin_id = auth.uid()
  )
  OR exists (
    SELECT 1
    FROM public.members m
    WHERE m.auth_user_id = auth.uid()
      AND m.is_master_admin = true
  );
$$;

-- Update app_settings RLS policies to allow master admins

DROP POLICY IF EXISTS "super admin can update signup flag" ON public.app_settings;
CREATE POLICY "super admin can update signup flag"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (private.is_super_admin_or_master_admin())
  WITH CHECK (private.is_super_admin_or_master_admin());

DROP POLICY IF EXISTS "super admin can insert signup flag" ON public.app_settings;
CREATE POLICY "super admin can insert signup flag"
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (private.is_super_admin_or_master_admin());

-- Also update the admin toggle exam app setting policy if it exists
DROP POLICY IF EXISTS "admins can update exam app setting" ON public.app_settings;
CREATE POLICY "admins can update exam app setting"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (private.is_super_admin_or_master_admin())
  WITH CHECK (private.is_super_admin_or_master_admin());
