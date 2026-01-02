-- Migration: Relax org_contact_settings select policy for public site access

BEGIN;

-- Ensure the select policy allows public reads (for Donate/footers) while still
-- permitting authenticated users even if the row is temporarily disabled.
DROP POLICY IF EXISTS org_contact_select ON public.org_contact_settings;
CREATE POLICY org_contact_select ON public.org_contact_settings
  FOR SELECT
  USING (is_enabled IS TRUE OR auth.role() IN ('authenticated', 'service_role'));

COMMIT;
