-- SQL for audit_actions table (NO RLS POLICIES)
-- Run this in Supabase SQL Editor if you want immediate results

-- Create table
CREATE TABLE IF NOT EXISTS public.audit_actions (
  id bigserial NOT NULL,
  year integer NOT NULL,
  event text NOT NULL,
  bucket_id text NOT NULL,
  object_path text NOT NULL,
  file_name text NULL,
  file_size bigint NULL,
  uploaded_by uuid NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT audit_actions_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS audit_actions_year_idx ON public.audit_actions USING btree (year) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS audit_actions_bucket_idx ON public.audit_actions USING btree (bucket_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS audit_actions_event_idx ON public.audit_actions USING btree (event) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS audit_actions_created_at_idx ON public.audit_actions USING btree (created_at) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS audit_actions_year_event_idx ON public.audit_actions USING btree (year, event) TABLESPACE pg_default;

-- Enable RLS on audit_actions table
ALTER TABLE public.audit_actions ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow all authenticated users to SELECT/READ audit logs
CREATE POLICY "audit_actions_read_all" ON public.audit_actions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy 2: Allow INSERT only for Super Admin or Admin with audit permission
CREATE POLICY "audit_actions_insert_admin" ON public.audit_actions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.members
      WHERE auth_user_id = auth.uid() 
        AND role = 'super_admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.members m
      LEFT JOIN public.admin_granted_permissions agp 
        ON m.auth_user_id = agp.admin_id
      WHERE m.auth_user_id = auth.uid() 
        AND m.role = 'admin'
        AND agp.permission_key = 'audit'
        AND agp.is_active = true
    )
  );

-- Policy 3: Allow DELETE only for Super Admin
CREATE POLICY "audit_actions_delete_super_admin" ON public.audit_actions
  FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.members
      WHERE auth_user_id = auth.uid() 
        AND role = 'super_admin'
    )
  );

-- Policy 4: Prevent UPDATE on audit logs (audit trail should be immutable)
CREATE POLICY "audit_actions_no_update" ON public.audit_actions
  FOR UPDATE
  USING (false);
