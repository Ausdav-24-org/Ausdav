-- ===================================================================
-- MASTER ADMIN FEATURE - SQL QUERIES & OPERATIONS
-- ===================================================================
-- This file contains all SQL queries for the Master Admin feature.
-- Master Admins are hidden admins who can see all admins and member details
-- but display their public role (admin, super_admin, etc.)

-- ===================================================================
-- 1. VIEW ALL MASTER ADMINS
-- ===================================================================
-- View members who have master_admin = true
SELECT 
  m.mem_id,
  m.auth_user_id,
  m.fullname,
  m.username,
  m.role AS public_role,
  m.is_master_admin,
  m.created_at
FROM public.members m
WHERE m.is_master_admin = true
ORDER BY m.created_at DESC;

-- ===================================================================
-- 2. ASSIGN A USER AS MASTER ADMIN (Using Session Flag - WORKS!)
-- ===================================================================
-- This bypasses the trigger using the built-in session flag
-- Replace 290 with the actual member ID you want to assign
SET app.allow_service_role_updates TO 'true';

UPDATE public.members
SET is_master_admin = true, updated_at = now()
WHERE mem_id = 290
AND is_master_admin = false;

RESET app.allow_service_role_updates;

-- ===================================================================
-- 3. REVOKE MASTER ADMIN STATUS
-- ===================================================================
-- Replace 290 with the actual member ID to revoke from
UPDATE public.members
SET is_master_admin = false, updated_at = now()
WHERE mem_id = 290;

-- ===================================================================
-- 4. VIEW ALL ADMINS & SUPER ADMINS
-- ===================================================================
-- Master Admins can see this list
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

-- ===================================================================
-- 5. VIEW AUDIT TRAIL OF MASTER ADMIN ASSIGNMENTS
-- ===================================================================
-- See who was assigned/revoked as master admin and by whom
SELECT 
  maa.id,
  m.fullname AS assigned_member,
  m.username AS assigned_member_username,
  assigner.fullname AS assigned_by,
  maa.action,
  maa.previous_role,
  maa.new_role,
  maa.reason,
  maa.assigned_at
FROM public.master_admin_audit maa
LEFT JOIN public.members m ON m.auth_user_id = maa.master_admin_id
LEFT JOIN public.members assigner ON assigner.auth_user_id = maa.assigned_by
ORDER BY maa.assigned_at DESC
LIMIT 100;

-- ===================================================================
-- 6. ASSIGN MASTER ADMIN USING RPC FUNCTION
-- ===================================================================
-- Replace 290 with actual mem_id and reason as needed
SELECT public.assign_master_admin(
  p_mem_id := 290,
  p_reason := 'Assigned to oversee admin operations'
);

-- ===================================================================
-- 7. REVOKE MASTER ADMIN USING RPC FUNCTION
-- ===================================================================
-- Replace 290 with actual mem_id and reason as needed
SELECT public.revoke_master_admin(
  p_mem_id := 290,
  p_reason := 'Role change requested'
);

-- ===================================================================
-- 8. GET MASTER ADMINS LIST (RPC)
-- ===================================================================
-- Returns list of all master admins with their public role
SELECT public.get_master_admins();

-- ===================================================================
-- 9. GET ALL ADMINS LIST (RPC)
-- ===================================================================
-- Returns all admin and super_admin users
SELECT public.get_all_admins();

-- ===================================================================
-- 10. CHECK IF A USER IS MASTER ADMIN
-- ===================================================================
-- Replace 'uuid-123-456' with actual auth_user_id
SELECT 
  m.mem_id,
  m.fullname,
  m.role,
  m.is_master_admin,
  CASE 
    WHEN m.is_master_admin = true THEN 'Master Admin'
    ELSE m.role
  END AS actual_role
FROM public.members m
WHERE m.auth_user_id = 'uuid-123-456'
LIMIT 1;

-- ===================================================================
-- 11. VIEW MEMBER DETAILS (Master Admin Access)
-- ===================================================================
-- Replace 290 with the actual member ID to view details
SELECT 
  m.mem_id,
  m.fullname,
  m.username,
  m.nic,
  m.gender,
  m.role,
  m.batch,
  m.university,
  m.school,
  m.phone,
  m.designation,
  m.created_at,
  m.updated_at,
  m.is_master_admin
FROM public.members m
WHERE m.mem_id = 290
LIMIT 1;

-- ===================================================================
-- 12. COUNT MASTER ADMINS
-- ===================================================================
SELECT COUNT(*) AS master_admin_count
FROM public.members
WHERE is_master_admin = true;

-- ===================================================================
-- 13. BULK ASSIGN MASTER ADMINS
-- ===================================================================
-- Assign multiple users at once
UPDATE public.members
SET is_master_admin = true, updated_at = now()
WHERE mem_id IN (1, 2, 3, 5, 7, 10)
AND is_master_admin = false;

-- ===================================================================
-- 14. SECURITY: RLS POLICIES
-- ===================================================================
-- Master admin audit log can only be viewed by master admins (NOT super admins)
-- These policies are automatically created in the migration

-- Master admins can view master admin audit:
-- SELECT: EXISTS (SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND is_master_admin = true)

-- Master admins can create audit records:
-- INSERT: EXISTS (SELECT 1 FROM members WHERE auth_user_id = auth.uid() AND is_master_admin = true)

-- ===================================================================
-- 15. HIDDEN BY DEFAULT - QUERY TO SHOW ONLY PUBLIC ROLE
-- ===================================================================
-- When displaying user role to others, always use the 'role' column
-- The is_master_admin flag is hidden
SELECT 
  m.mem_id,
  m.fullname,
  m.username,
  m.role AS display_role,  -- <-- Use this for public display
  m.is_master_admin        -- <-- Keep hidden internally
FROM public.members m
WHERE m.auth_user_id = auth.uid();

-- ===================================================================
-- NOTES:
-- ===================================================================
-- 1. Master Admin role is HIDDEN - users see their public role (admin/super_admin/member/honourable)
-- 2. Master Admins can access a special page to view all admins and members
-- 3. No special UI badge or indicator shows master admin status (kept secret)
-- 4. All assignments are logged in master_admin_audit table
-- 5. Master Admins have same permissions as their public role when public
-- 6. Only Master Admins can assign/revoke other master admin status (NOT Super Admins)
-- 7. A Master Admin can later change their public role (e.g., admin → honourable)
-- 8. The master admin status persists even after public role changes
-- 9. Super Admin CANNOT control or manage the Master Admin system
-- 10. Master Admin system is completely independent from Super Admin control
-- 11. SETUP: Super Admin can access /admin/master-admin-setup to assign the first Master Admin
-- 12. After first Master Admin is assigned, only Master Admins can manage the system
-- 13. The setup page only appears for Super Admin when no Master Admins exist yet
