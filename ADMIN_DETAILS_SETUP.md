# AdminDetailsPage - Setup Guide

This guide explains how to set up the database tables, storage bucket, and policies for the AdminDetailsPage feature.

## Database Setup

### 1. Run the Migration
Execute the SQL migration file to create tables:
- `admin_documents` - For storing admin documents
- `admin_contacts` - For storing contact details
- `admin_patrons` - For storing patron information

```bash
# Navigate to your supabase folder and run the migration
supabase migration up
```

Or manually run the SQL from: `supabase/migrations/20260403_admin_details.sql`

## Storage Bucket Setup

### 2. Create Storage Bucket in Supabase Dashboard

1. Go to your **Supabase Project Dashboard**
2. Navigate to **Storage** → **Buckets**
3. Click **Create a new bucket**
4. Set the following:
   - **Bucket name**: `admin-documents`
   - **Public bucket**: Toggle OFF (keep it private)
   - Click **Create bucket**

### 3. Set Up Storage Policies

Once the bucket is created, add the following policy:

#### Policy: Allow Super Admins to Upload/Download Documents

1. Click the bucket name `admin-documents`
2. Go to **Policies** tab
3. Click **New policy**
4. Create policy with these settings:
   - **Operation**: ALL (or SELECT, INSERT, UPDATE, DELETE as needed)
   - **Target role**: authenticated
   - **Expression**: 
   ```sql
   EXISTS (
     SELECT 1 FROM members
     WHERE members.auth_user_id = auth.uid()
     AND members.role = 'super_admin'
   )
   ```

### Alternative: RLS Policies (SQL)

You can also run these SQL commands directly in the Supabase SQL Editor:

```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow Super Admins to see admin-documents bucket
CREATE POLICY "Allow super_admin to view admin-documents bucket" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'admin-documents' AND
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  );

-- Policy: Allow Super Admins to upload to admin-documents bucket
CREATE POLICY "Allow super_admin to upload to admin-documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'admin-documents' AND
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  );

-- Policy: Allow Super Admins to delete from admin-documents
CREATE POLICY "Allow super_admin to delete from admin-documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'admin-documents' AND
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  );

-- Policy: Allow Super Admins to update admin-documents
CREATE POLICY "Allow super_admin to update admin-documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'admin-documents' AND
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  ) WITH CHECK (
    bucket_id = 'admin-documents' AND
    EXISTS (
      SELECT 1 FROM members
      WHERE members.auth_user_id = auth.uid()
      AND members.role = 'super_admin'
    )
  );
```

## File Download Format

### Contact Download Format
When downloading a contact, the file will be saved as:
```
{contact_name}+{batch}+Senior (Ausdav).txt
```

Example: `John Doe+2020+Senior (Ausdav).txt`

Content format:
```
Name: John Doe
Batch: 2020
Contact No: 03001234567

AUSDAV
```

### Patron Download Format
When downloading a patron, the file will be saved as:
```
{patron_name}+Patron(Ausdav).txt
```

Example: `Dr. Ahmed Khan+Patron(Ausdav).txt`

Content format:
```
Name: Dr. Ahmed Khan
Patron No: P001
Description: Main Patron
AUSDAV
```

## Feature Overview

### AdminDetailsPage Components

#### 1. **Documents Card**
- Upload PDF, Word, or Excel documents
- View uploaded documents
- Download files
- Delete documents
- Automatic file type detection

#### 2. **Contacts Card**
- Add new contacts (Name, Batch, Phone)
- Edit existing contacts
- Delete contacts
- Download contact as text file
- View all contacts in a list

#### 3. **Patrons Card**
- Add new patrons (Name, Patron No, Description)
- Edit existing patrons
- Delete patrons
- Download patron as text file
- Optional description field

## Database Schema

### admin_documents
```sql
- id: BIGINT (Primary Key)
- document_name: VARCHAR(255) - Name of the document
- document_type: VARCHAR(50) - Type: 'pdf', 'word', or 'excel'
- file_path: VARCHAR(500) - Path in storage bucket
- file_size: BIGINT - File size in bytes
- uploaded_by: UUID - Reference to auth.users
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### admin_contacts
```sql
- id: BIGINT (Primary Key)
- contact_name: VARCHAR(255) - Name of contact
- batch: INTEGER - Batch year
- contact_no: VARCHAR(20) - Phone number
- created_by: UUID - Reference to auth.users
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- UNIQUE(contact_name, batch, contact_no)
```

### admin_patrons
```sql
- id: BIGINT (Primary Key)
- patron_name: VARCHAR(255) - Name of patron
- patron_no: VARCHAR(50) - Unique patron number
- description: TEXT - Optional description
- created_by: UUID - Reference to auth.users
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## Troubleshooting

### Permission Denied Errors
- Ensure your user has the `super_admin` role in the `members` table
- Check that RLS policies are properly configured
- Verify that `admin-documents` bucket exists and is private

### File Upload Failures
- Check file size limits (Supabase default is 50MB per file)
- Ensure file type is allowed (PDF, Word, Excel)
- Check bucket RLS policies

### Data Not Loading
- Verify RLS policies on tables are correct
- Check that user is authenticated as `super_admin`
- Ensure tables have proper indexes

## Security Notes

- Only `super_admin` users can access this page
- All operations are protected by RLS policies
- File uploads are validated for type and size
- Storage bucket is private and requires authentication
