-- ===================================================================
-- MASTER ADMIN FEATURE
-- Add hidden master_admin role that doesn't show in public display
-- but allows secret admin access level
-- ===================================================================

-- Add master_admin column to members table
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS is_master_admin BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster lookups of master admins
CREATE INDEX IF NOT EXISTS idx_members_master_admin 
ON public.members(is_master_admin) 
WHERE is_master_admin = true;

-- Create table to track master admin assignments (audit trail)
CREATE TABLE IF NOT EXISTS public.master_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('assigned', 'revoked', 'role_changed')),
  previous_role TEXT,
  new_role TEXT,
  reason TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for audit lookups
CREATE INDEX IF NOT EXISTS idx_master_admin_audit_admin 
ON public.master_admin_audit(master_admin_id);

CREATE INDEX IF NOT EXISTS idx_master_admin_audit_assigned_by 
ON public.master_admin_audit(assigned_by);

-- Enable RLS on audit table
ALTER TABLE public.master_admin_audit ENABLE ROW LEVEL SECURITY;

-- RLS: Only Master Admins can view audit logs (not Super Admin)
DROP POLICY IF EXISTS "Master admins can view master admin audit" ON public.master_admin_audit;
CREATE POLICY "Master admins can view master admin audit"
ON public.master_admin_audit FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE auth_user_id = auth.uid()
    AND is_master_admin = true
  )
);

-- RLS: Only Master Admins can insert audit logs (not Super Admin)
DROP POLICY IF EXISTS "Master admins can create master admin audit" ON public.master_admin_audit;
CREATE POLICY "Master admins can create master admin audit"
ON public.master_admin_audit FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE auth_user_id = auth.uid()
    AND is_master_admin = true
  )
);

-- ===================================================================
-- FUNCTION: Get Master Admins List
-- Returns: List of all master admins with their public role
-- Only Master Admins can view this (not Super Admin)
-- ===================================================================
CREATE OR REPLACE FUNCTION public.get_master_admins()
RETURNS TABLE(
  mem_id INTEGER,
  auth_user_id UUID,
  fullname TEXT,
  username TEXT,
  public_role TEXT,
  master_admin BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Only MASTER ADMINS can view the master admins list (not super admin)
  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_user_id = auth.uid()
    AND m.is_master_admin = true
  ) THEN
    RAISE EXCEPTION 'Only master admins can view master admins list';
  END IF;

  RETURN QUERY
  SELECT 
    m.mem_id,
    m.auth_user_id,
    m.fullname,
    m.username,
    m.role,
    m.is_master_admin,
    m.created_at,
    m.updated_at
  FROM public.members m
  WHERE m.is_master_admin = true
  ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- FUNCTION: Get All Admins and Super Admins (Only Master Admin can see)
-- Returns: All users with admin or super_admin role
-- Only Master Admins can view this (not Super Admin)
-- ===================================================================
CREATE OR REPLACE FUNCTION public.get_all_admins()
RETURNS TABLE(
  mem_id INTEGER,
  auth_user_id UUID,
  fullname TEXT,
  username TEXT,
  role TEXT,
  is_master_admin BOOLEAN,
  designation TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Only MASTER ADMINS can view all admins (not super admin)
  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_user_id = auth.uid()
    AND m.is_master_admin = true
  ) THEN
    RAISE EXCEPTION 'Only master admins can view admin list';
  END IF;

  RETURN QUERY
  SELECT 
    m.mem_id,
    m.auth_user_id,
    m.fullname,
    m.username,
    m.role,
    m.is_master_admin,
    m.designation,
    m.created_at
  FROM public.members m
  WHERE m.role IN ('admin', 'super_admin')
  ORDER BY m.role DESC, m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- FUNCTION: Assign Master Admin Role
-- Parameters: member_id (mem_id), reason (optional text)
-- ONLY Master Admins can assign new Master Admins (completely independent)
-- ===================================================================
CREATE OR REPLACE FUNCTION public.assign_master_admin(
  p_mem_id INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_member_record RECORD;
  v_user_id UUID;
BEGIN
  -- Set session flag to bypass trigger restrictions
  PERFORM set_config('app.allow_service_role_updates', 'true', false);
  
  -- ONLY Master Admins can assign new Master Admins
  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_user_id = auth.uid()
    AND m.is_master_admin = true
  ) THEN
    RAISE EXCEPTION 'Only master admins can assign new master admins';
  END IF;

  -- Get member details
  SELECT mem_id, auth_user_id, role INTO v_member_record
  FROM public.members
  WHERE mem_id = p_mem_id;

  IF v_member_record IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Update member to mark as master admin
  UPDATE public.members
  SET is_master_admin = true,
      updated_at = now()
  WHERE mem_id = p_mem_id
  AND is_master_admin = false;

  -- Log to audit table
  INSERT INTO public.master_admin_audit (
    master_admin_id,
    assigned_by,
    action,
    previous_role,
    new_role,
    reason
  ) VALUES (
    v_member_record.auth_user_id,
    auth.uid(),
    'assigned',
    v_member_record.role,
    v_member_record.role,
    p_reason
  );

  RETURN json_build_object(
    'success', true,
    'message', 'User assigned as master admin',
    'mem_id', p_mem_id,
    'fullname', v_member_record,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- FUNCTION: Revoke Master Admin Role
-- Parameters: member_id (mem_id), reason (optional text)
-- Only Master Admins can revoke other Master Admins
-- ===================================================================
CREATE OR REPLACE FUNCTION public.revoke_master_admin(
  p_mem_id INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_member_record RECORD;
  v_user_id UUID;
BEGIN
  -- Set session flag to bypass trigger restrictions
  PERFORM set_config('app.allow_service_role_updates', 'true', false);
  
  -- ONLY Master Admins can revoke other Master Admins
  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_user_id = auth.uid()
    AND m.is_master_admin = true
  ) THEN
    RAISE EXCEPTION 'Only master admins can revoke master admin role';
  END IF;

  -- Get member details
  SELECT mem_id, auth_user_id, role INTO v_member_record
  FROM public.members
  WHERE mem_id = p_mem_id;

  IF v_member_record IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Update member to remove master admin role
  UPDATE public.members
  SET is_master_admin = false,
      updated_at = now()
  WHERE mem_id = p_mem_id
  AND is_master_admin = true;

  -- Log to audit table
  INSERT INTO public.master_admin_audit (
    master_admin_id,
    assigned_by,
    action,
    previous_role,
    new_role,
    reason
  ) VALUES (
    v_member_record.auth_user_id,
    auth.uid(),
    'revoked',
    v_member_record.role,
    v_member_record.role,
    p_reason
  );

  RETURN json_build_object(
    'success', true,
    'message', 'User master admin role revoked',
    'mem_id', p_mem_id,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
