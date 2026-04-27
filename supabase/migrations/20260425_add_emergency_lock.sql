-- Add emergency lock setting for master admin control
-- When enabled, blocks regular admins from accessing their pages

ALTER TABLE IF EXISTS public.app_settings
ADD COLUMN IF NOT EXISTS master_admin_emergency_lock boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS emergency_lock_reason text,
ADD COLUMN IF NOT EXISTS emergency_lock_enabled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS emergency_lock_enabled_by uuid;

COMMENT ON COLUMN public.app_settings.master_admin_emergency_lock IS 'When true, regular admins and super admins cannot access their sidebar pages';
COMMENT ON COLUMN public.app_settings.emergency_lock_reason IS 'Reason for enabling the emergency lock';
COMMENT ON COLUMN public.app_settings.emergency_lock_enabled_at IS 'Timestamp when the lock was enabled';
COMMENT ON COLUMN public.app_settings.emergency_lock_enabled_by IS 'Master admin user ID who enabled the lock';
