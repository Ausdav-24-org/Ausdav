# Unified Table Update - AdminDetailsPage

**Date**: April 3, 2026
**Change Type**: Database Schema Optimization

## 📋 Summary

The `admin_contacts` and `admin_patrons` tables have been **unified into a single `admin_contacts` table** to reduce complexity and improve maintainability.

## 🔄 Changes Made

### Before (Two Separate Tables)
```
admin_contacts:
- id, contact_name, batch, contact_no, created_by, timestamps

admin_patrons:
- id, patron_name, patron_no, description, created_by, timestamps
```

### After (Single Unified Table)
```
admin_contacts:
- id, contact_type ('contact'|'patron'), name, batch, contact_no, patron_no, description
- created_by, timestamps
```

## 🗄️ Database Schema

### Table: admin_contacts
```sql
id              BIGINT PRIMARY KEY
contact_type    VARCHAR(50) - CHECK IN ('contact', 'patron')
name            VARCHAR(255) - Used for both contact and patron names
batch           INTEGER - Only populated for contacts
contact_no      VARCHAR(20) - Only populated for contacts
patron_no       VARCHAR(50) - Only populated for patrons
description     TEXT - Only populated for patrons
created_by      UUID - Reference to auth.users
created_at      TIMESTAMP WITH TIME ZONE
updated_at      TIMESTAMP WITH TIME ZONE
```

### Indexes
```sql
idx_admin_contacts_type_created      - (contact_type, created_at)
idx_admin_contacts_created_by        - (created_by)
idx_admin_contacts_batch             - (batch)
idx_admin_contacts_patron_no         - (patron_no)
```

## 💻 Code Changes

### SQL Migration
**File**: `supabase/migrations/20260403_admin_details.sql`

- Removed separate `admin_patrons` table
- Updated `admin_contacts` table with unified schema
- Consolidated RLS policies into one
- Added composite index for type + creation date queries

### React Component
**File**: `src/pages/admin/AdminDetailsPage.tsx`

**Changes:**
- Merged `allContacts`, `allPatrons` state → `allContacts` (filtered at display time)
- Merged `loadContacts()`, `loadPatrons()` → `loadContactsAndPatrons()`
- Merged `loadingContacts`, `loadingPatrons` → Single `loading` state
- Consolidated table structure in interfaces
- Filtering by `contact_type` when displaying in cards:
  ```typescript
  const contacts = allContacts.filter(item => item.contact_type === 'contact');
  const patrons = allContacts.filter(item => item.contact_type === 'patron');
  ```

## 📊 Benefits

✅ **Simplification**: One table instead of two
✅ **Maintainability**: Fewer schema changes to manage
✅ **Performance**: Fewer queries (load once, filter once)
✅ **Flexibility**: Easy to add more types in future
✅ **Consistency**: Unified RLS policies
✅ **Reduced Code**: Cleaner component logic

## ⚠️ Migration Notes

### For Existing Deployments
If you already created the old separate tables, you need to migrate data:

```sql
-- Migrate contacts data
INSERT INTO admin_contacts (contact_type, name, batch, contact_no, created_by, created_at, updated_at)
SELECT 'contact', contact_name, batch, contact_no, created_by, created_at, updated_at
FROM old_admin_contacts;

-- Migrate patrons data
INSERT INTO admin_contacts (contact_type, name, patron_no, description, created_by, created_at, updated_at)
SELECT 'patron', patron_name, patron_no, description, created_by, created_at, updated_at
FROM old_admin_patrons;

-- Drop old tables (after verifying data)
DROP TABLE old_admin_contacts;
DROP TABLE old_admin_patrons;
```

### For Fresh Deployments
Run the updated migration as-is:
```bash
supabase db push
```

## 🔍 Query Examples

### Get all contacts
```sql
SELECT * FROM admin_contacts 
WHERE contact_type = 'contact' 
ORDER BY created_at DESC;
```

### Get all patrons
```sql
SELECT * FROM admin_contacts 
WHERE contact_type = 'patron' 
ORDER BY created_at DESC;
```

### Get contacts by batch
```sql
SELECT * FROM admin_contacts 
WHERE contact_type = 'contact' AND batch = 2020 
ORDER BY name;
```

### Get patron by number
```sql
SELECT * FROM admin_contacts 
WHERE contact_type = 'patron' AND patron_no = 'P001';
```

## 🧪 Testing Checklist

- [ ] Add new contact (Name, Batch, Phone)
- [ ] Edit contact
- [ ] Delete contact
- [ ] Download contact (Name+Batch+Senior format)
- [ ] Add new patron (Name, Patron No, Description)
- [ ] Edit patron
- [ ] Delete patron
- [ ] Download patron (Name+Patron format)
- [ ] Verify RLS policies work for super_admin only
- [ ] Verify batch and patron_no are unique when needed

## 📝 Notes

- **Nullable fields**: `batch`, `contact_no`, `patron_no`, `description` are nullable
  - For contacts: only `batch` and `contact_no` are populated
  - For patrons: only `patron_no` is populated (description optional)
- **Column names**: Using `name` for both types to avoid duplication
- **Download format**: Unchanged - still generates same file formats
- **RLS policies**: Single policy applies to all contact types

## 🚀 Deployment Steps

1. **Backup existing data** (if migrating from old schema)
2. **Run migration**: `supabase db push`
3. **Verify tables created**: Check Supabase dashboard
4. **Migrate data** (if needed, see Migration Notes)
5. **Test component**: Access `/admin/details` as super_admin
6. **Old tables cleanup** (if migrating old data)

---

**Status**: ✅ Updated and Ready
**Files Modified**: 2
**Breaking Changes**: None (fresh install); Requires migration (existing)
