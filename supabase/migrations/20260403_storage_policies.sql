-- Supabase Storage Policies for admin-documents bucket
-- IMPORTANT: Use Service Role credentials to run these queries

-- HOW TO RUN THIS SAFELY:
-- Option 1 (Recommended): Use Supabase Dashboard UI
--   1. Go to Storage > Buckets > admin-documents
--   2. Click "Policies" tab
--   3. Create policies manually via UI (see instructions below)
--
-- Option 2: Run via Supabase CLI with service role
--   1. Get your service role from Supabase Dashboard
--   2. Create a .env.local file:
--      SUPABASE_DB_PASSWORD=your_service_role_password
--   3. Run: psql -h db.xxx.supabase.co -U postgres -d postgres -f this_file.sql
--
-- IMPORTANT: The bucket must be created first via the Supabase dashboard
-- 1. Go to Storage > Buckets
-- 2. Create a new bucket named 'admin-documents' with public OFF

-- NOTE: RLS on storage.objects should already be enabled by Supabase
-- Uncomment the line below ONLY if you have service role access:
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- SERVICE ROLE SETUP (RUN THIS FIRST IF NOT ALREADY DONE)
-- ===================================================================
-- These commands grant necessary permissions to the authenticated role
-- Only run if you have service role or admin credentials

-- Grant permissions to authenticated users to use storage
-- GRANT ALL ON TABLE storage.buckets TO authenticated;
-- GRANT ALL ON TABLE storage.objects TO authenticated;

-- Grant permissions on sequences
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO authenticated;

-- ===================================================================
-- Policy 1: Allow super_admin to SELECT (view/download) from bucket
-- ===================================================================
DROP POLICY IF EXISTS "Allow super_admin to read admin-documents" ON storage.objects;

CREATE POLICY "Allow super_admin to read admin-documents" ON storage.objects
  FOR SELECT 
  USING (
    bucket_id = 'admin-documents' AND
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  );

-- ===================================================================
-- Policy 2: Allow super_admin to INSERT (upload) to bucket
-- ===================================================================
DROP POLICY IF EXISTS "Allow super_admin to upload to admin-documents" ON storage.objects;

CREATE POLICY "Allow super_admin to upload to admin-documents" ON storage.objects
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'admin-documents' AND
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  );

-- ===================================================================
-- Policy 3: Allow super_admin to DELETE from bucket
-- ===================================================================
DROP POLICY IF EXISTS "Allow super_admin to delete from admin-documents" ON storage.objects;

CREATE POLICY "Allow super_admin to delete from admin-documents" ON storage.objects
  FOR DELETE 
  USING (
    bucket_id = 'admin-documents' AND
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  );

-- ===================================================================
-- Policy 4: Allow super_admin to UPDATE objects in bucket
-- ===================================================================
DROP POLICY IF EXISTS "Allow super_admin to update admin-documents" ON storage.objects;

CREATE POLICY "Allow super_admin to update admin-documents" ON storage.objects
  FOR UPDATE 
  USING (
    bucket_id = 'admin-documents' AND
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  ) 
  WITH CHECK (
    bucket_id = 'admin-documents' AND
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  );

-- ===================================================================
-- Verification
-- ===================================================================
-- After running the above policies, verify they were created:
SELECT 
  policyname, 
  permissive, 
  roles, 
  qual as policy_using,
  with_check as policy_with_check
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%admin-documents%'
ORDER BY policyname;

-- ===================================================================
-- RUNNING THIS FILE WITH SERVICE ROLE
-- ===================================================================
-- 
-- METHOD 1: Via Supabase CLI (Recommended)
-- =========
-- 1. Install Supabase CLI: npm install -g supabase
-- 
-- 2. Get your database credentials:
--    - Go to Supabase Dashboard
--    - Project Settings > Database > Connection string
--    - Copy the PostgreSQL connection string
--
-- 3. Run this script:
--    psql "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres" -f this_file.sql
--
-- 4. Or use environment variables:
--    export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
--    psql $DATABASE_URL -f this_file.sql
--
-- METHOD 2: Via Supabase Dashboard (RECOMMENDED FOR MOST USERS)
-- =============================================================
-- Since RLS policies require special permissions, use the Dashboard UI:
--
-- 1. Create bucket via Dashboard:
--    Storage > Create new bucket > name: admin-documents > public: OFF
--
-- 2. Add policies via Dashboard:
--    Storage > admin-documents > Policies > Create a new policy
--
-- 3. For each policy, use the USINGS/WITH CHECK expressions shown above
--
-- METHOD 3: If you still get permission errors
-- =============================================
-- The error "must be owner of table objects" means RLS policies cannot be
-- created via regular authenticated users. In this case:
--
-- A) Ask your Supabase admin to run this script with service role
-- B) Use the Dashboard UI (Method 2 above) - this is the easiest
-- C) Contact Supabase support for elevated SQL permissions
--
-- ===================================================================
