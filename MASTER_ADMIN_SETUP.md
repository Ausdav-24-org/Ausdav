# Master Admin Setup - Hard-Coded Assignment

## Initial Setup

The Master Admin system is now **independent from Super Admin** control. Here's how to set it up:

### Step 1: Deploy Migration

The migration file `20260403_add_master_admin.sql` will automatically add:
- `is_master_admin` column to `members` table
- `master_admin_audit` table
- Functions accessible only to Master Admins (not Super Admin)
- RLS policies protecting Master Admin operations

### Step 2: Hard-Code the Initial Master Admin

Choose one user to be the initial Master Admin. Then run this SQL in Supabase:

```sql
-- Replace {mem_id} with the actual member ID
UPDATE public.members
SET is_master_admin = true, updated_at = now()
WHERE mem_id = {mem_id};

-- Example: Make member with ID 1 the first Master Admin
UPDATE public.members
SET is_master_admin = true, updated_at = now()
WHERE mem_id = 1;
```

**To find the correct mem_id:**
```sql
SELECT mem_id, fullname, username, role 
FROM public.members 
WHERE role IN ('admin', 'super_admin')
ORDER BY created_at DESC;
```

### Step 3: Verify Assignment

Check that the Master Admin was assigned:

```sql
SELECT mem_id, fullname, username, role, is_master_admin 
FROM public.members 
WHERE is_master_admin = true;
```

---

## Now Master Admin Can Control

Once the initial Master Admin is assigned they can:

1. **Login** to the application
2. **Navigate** to sidebar → "Master Admin Control"
3. **View:**
   - All current Master Admins
   - All Admins & Super Admins (searchable table)
   - Audit Log (history of assignments)
4. **Assign:** New Master Admins (with optional reason)
5. **Revoke:** Master Admin status from others
6. **Search:** Filter across all tabs

### Assignment Modal

When assigning a new Master Admin:
- Select from dropdown of available admins
- Optional reason field
- Confirms assignment
- Creates audit log entry automatically

---

## Key Features

✅ **Independent Control:** Master Admin controls other Master Admins (Super Admin cannot)  
✅ **Audit Trail:** Every assignment/revocation logged with timestamp and reason  
✅ **Hidden Status:** Master Admins display their public role (admin/super_admin/etc)  
✅ **Others Can't See:** Super Admin cannot access or view Master Admin features  
✅ **Page Access:** Only Master Admins see the "Master Admin Control" link in sidebar  
✅ **Self-Managing:** Master Admins manage themselves (no Super Admin involvement)  

---

## Access Control

| User Type | Can See Master Admin Page | Can Assign Master Admins | Can See Audit Log |
|-----------|--------------------------|-------------------------|-------------------|
| Super Admin | ❌ NO | ❌ NO | ❌ NO |
| Master Admin | ✅ YES | ✅ YES | ✅ YES |
| Regular Admin | ❌ NO | ❌ NO | ❌ NO |
| Member | ❌ NO | ❌ NO | ❌ NO |

---

## RLS Policies

All operations are protected at database level:

```sql
-- Only Master Admins can call these functions:
- get_master_admins()
- get_all_admins()
- assign_master_admin(mem_id, reason)
- revoke_master_admin(mem_id, reason)

-- Only Master Admins can view/create audit logs
```

**Super Admins trying to access these will get:**  
`Only master admins can [view/manage] master admins`

---

## SQL Quick Reference

### View Current Master Admins
```sql
SELECT mem_id, fullname, role, is_master_admin 
FROM public.members 
WHERE is_master_admin = true;
```

### View Assignment Audit Log
```sql
SELECT * FROM public.master_admin_audit 
ORDER BY assigned_at DESC;
```

### Make Someone a Master Admin
```sql
UPDATE public.members 
SET is_master_admin = true 
WHERE mem_id = 5;
```

### Remove Master Admin Status
```sql
UPDATE public.members 
SET is_master_admin = false 
WHERE mem_id = 5;
```

---

## Best Practices

1. **Start with One:** Hard-code one Master Admin initially
2. **That Master Admin:** Then assigns others
3. **Document Reason:** Always provide reason when assigning
4. **Review Audit Log:** Regularly check who's been assigned
5. **Revoke Carefully:** Only revoke if absolutely necessary

---

## Troubleshooting

### "Only master admins can view master admins"

**Solution:** The logged-in user must have `is_master_admin = true`

```sql
-- Check user's status
SELECT mem_id, fullname, is_master_admin 
FROM public.members 
WHERE auth_user_id = 'USER_ID_HERE';
```

### Master Admin Control link not showing

**Solution:** User must have `is_master_admin = true` for link to appear

```sql
-- Verify in database
SELECT mem_id, is_master_admin FROM public.members WHERE mem_id = X;
```

### RPC function not found

**Solution:** Ensure migration has been applied

```sql
-- Check if function exists
SELECT EXISTS(
  SELECT 1 FROM pg_proc WHERE proname = 'assign_master_admin'
);
```

---

## Setup Examples

### Example 1: Initial Setup

```sql
-- Step 1: Find candidate
SELECT mem_id, fullname, role FROM public.members 
WHERE role IN ('admin', 'super_admin') LIMIT 5;

-- Step 2: Assign as Master Admin (e.g., mem_id = 3)
UPDATE public.members 
SET is_master_admin = true, updated_at = now() 
WHERE mem_id = 3;

-- Step 3: Verify
SELECT mem_id, fullname, is_master_admin FROM public.members WHERE mem_id = 3;
```

### Example 2: Later, Master Admin Assigns Another

1. First Master Admin logs into app
2. Goes to "Master Admin Control" page
3. Clicks "Assign Master Admin"
4. Selects admin "Sarah" (mem_id = 7)
5. Enters reason: "Additional oversight needed"
6. Clicks assign
7. Audit log automatically created

---

## System Independence

```
Super Admin
├── No access to Master Admin system
├── Cannot see who Master Admins are
├── Cannot assign/revoke Master Admins
└── Cannot view Master Admin audit logs

Master Admin (Independent)
├── Controls other Master Admins
├── Can assign new Master Admins
├── Can revoke Master Admin status
├── Can view audit log
└── Can see all other admins
```

---

**Status:** ✅ System is completely independent from Super Admin control  
**Setup Required:** Hard-code first Master Admin via SQL  
**After That:** Master Admins manage themselves
