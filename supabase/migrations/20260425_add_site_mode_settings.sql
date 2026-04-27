-- Add site mode settings to app_settings table
-- These columns control under construction mode, access restrictions, and display options

ALTER TABLE IF EXISTS public.app_settings
ADD COLUMN IF NOT EXISTS site_under_construction boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS restrict_public_access boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_signup_when_construction boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS show_maintenance_countdown boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_admin_login boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS show_under_construction_banner boolean DEFAULT false;

-- Comment on the new columns for documentation
COMMENT ON COLUMN public.app_settings.site_under_construction IS 'When true, public pages show the under construction page';
COMMENT ON COLUMN public.app_settings.restrict_public_access IS 'When true, non-admin users are blocked from accessing most pages';
COMMENT ON COLUMN public.app_settings.allow_signup_when_construction IS 'When true, new users can sign up while site is under construction';
COMMENT ON COLUMN public.app_settings.show_maintenance_countdown IS 'When true, a countdown timer is displayed on the under construction page';
COMMENT ON COLUMN public.app_settings.allow_admin_login IS 'When true, admin users can sign in while site is under construction';
COMMENT ON COLUMN public.app_settings.show_under_construction_banner IS 'When true, a maintenance banner is shown on top of pages';
