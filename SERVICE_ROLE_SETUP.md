# Service Role Setup Guide for Storage Policies

**Updated**: April 3, 2026

## Problem

The error `ERROR: 42501: must be owner of table objects` occurs when trying to create RLS policies on Supabase storage tables without proper permissions.

## Solutions

### ✅ Solution 1: Use Supabase Dashboard UI (RECOMMENDED)

This is the easiest and most reliable method:

1. **Create the bucket first**
   - Go to **Storage** → **Buckets**
   - Click **Create a new bucket**
   - Name: `admin-documents`
   - Public: **OFF**
   - Click **Create**

2. **Add policies via Dashboard**
   - Click the `admin-documents` bucket
   - Go to **Policies** tab
   - Click **Create a new policy** (or **New Policy**)
   - For each policy, fill in:
     - **Operation**: SELECT, INSERT, UPDATE, or DELETE
     - **Target Role**: `authenticated`
     - **Policy Expression**: (see below)

3. **Policy Expression for all 4 policies**
   ```sql
   (bucket_id = 'admin-documents'::text) AND 
   (EXISTS (
     SELECT 1 FROM members 
     WHERE (members.auth_user_id = auth.uid()) 
     AND (members.role = 'super_admin'::text)
   ))
   ```

---

### Solution 2: Run via CLI with Service Role (Advanced)

If you have service role credentials:

#### Step 1: Get your credentials
```
Supabase Dashboard 
→ Project Settings 
→ Database 
→ Connection String (top right) 
→ Copy PostgreSQL version
```

Example: `postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres`

#### Step 2: Run the SQL file
```bash
# Option A: Direct command
psql "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres" \
  -f supabase/migrations/20260403_storage_policies.sql

# Option B: Using environment variable
export DATABASE_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres"
psql $DATABASE_URL -f supabase/migrations/20260403_storage_policies.sql
```

#### Step 3: Verify policies were created
```bash
psql $DATABASE_URL -c \
  "SELECT policyname FROM pg_policies 
   WHERE schemaname='storage' AND tablename='objects' 
   AND policyname LIKE '%admin-documents%';"
```

---

### Alternative: Using Supabase CLI Commands

```bash
# 1. Link your project (if not already done)
supabase link --project-ref your_project_ref

# 2. Run migrations
supabase db push

# 3. View the SQL file to manually run if needed
cat supabase/migrations/20260403_storage_policies.sql
```

---

## Troubleshooting

### Error: "must be owner of table objects"
**Cause**: You don't have service role permissions
**Solution**: Use Dashboard UI method (Solution 1 above)

### Error: "Connection refused"
**Cause**: Wrong host or credentials
**Solution**: 
- Copy the connection string again from Supabase Dashboard
- Make sure you have the correct password

### Error: "role 'authenticated' does not exist"
**Cause**: Not using service role connection
**Solution**: Use the full PostgreSQL connection string from Supabase

### Policies created but storage still fails
**Cause**: RLS not properly enabled on storage.objects
**Solution**: 
1. Go to Supabase Dashboard
2. SQL Editor
3. Run: `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`
4. Then create policies

---

## Verification

After creating policies, verify they exist:

### Via Dashboard SQL Editor
```sql
SELECT 
  policyname, 
  permissive, 
  roles,
  qual
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%admin-documents%'
ORDER BY policyname;
```

### Via CLI
```bash
psql $DATABASE_URL -c \
  "SELECT policyname FROM pg_policies 
   WHERE tablename='objects' 
   AND policyname LIKE '%admin%' 
   LIMIT 10;"
```

---

## Complete Setup Checklist

- [ ] Bucket `admin-documents` created (Storage → Buckets)
- [ ] Bucket is **private** (Public toggle OFF)
- [ ] 4 policies created for: SELECT, INSERT, UPDATE, DELETE
- [ ] All policies use `authenticated` role
- [ ] All policies check for `super_admin` role in members table
- [ ] Policies verified via SQL query
- [ ] Test upload/download as super_admin user
- [ ] Test permissions denied for non-super_admin users

---

## Policy Details

### Policy Name Format
- `Allow super_admin to read admin-documents`
- `Allow super_admin to upload to admin-documents`
- `Allow super_admin to delete from admin-documents`
- `Allow super_admin to update admin-documents`

### Policy Expression
All four use this same condition:
```sql
(bucket_id = 'admin-documents'::text) AND 
(EXISTS (
  SELECT 1 FROM members 
  WHERE (members.auth_user_id = auth.uid()) 
  AND (members.role = 'super_admin'::text)
))
```

### What Each Policy Does

| Policy | Operation | Allows |
|--------|-----------|---------|
| READ | SELECT | Download files from bucket |
| UPLOAD | INSERT | Upload/create files in bucket |
| DELETE | DELETE | Delete files from bucket |
| UPDATE | UPDATE | Replace files in bucket |

---

## File Path Format

When files are stored, they use this path:
```
admin-documents/{timestamp}-{filename}

Example:
admin-documents/1712145600000-proposal.pdf
admin-documents/1712145615423-budget.docx
admin-documents/1712145630891-report.xlsx
```

---

## Security Notes

✅ **Bucket is private** - Only authenticated super_admin can access
✅ **RLS enforced** - Database policies check user role
✅ **Scoped to super_admin** - Regular users cannot upload/download
✅ **Audit trail** - All operations tracked via created_at timestamps

---

## Support

If you still encounter issues:

1. **Check Supabase status**: https://status.supabase.com
2. **Verify credentials**: Double-check connection string from Dashboard
3. **Test user role**: Ensure test user has `super_admin` role in members table
4. **Clear browser cache**: Some UI changes take time to propagate
5. **Contact Supabase support**: If permissions errors persist

---

**Recommended Approach**: Use the Supabase Dashboard UI (Solution 1) for the smoothest experience. ✅
