# Master Admin Feature - Complete Documentation

## Overview

The **Master Admin** feature allows Super Admins to create hidden administrator accounts that don't display their true administrative role. Instead, they display a public role (admin, super_admin, member, honourable) while secretly having full access to admin features.

### Key Features:

✅ **Hidden Role** - Master Admins display their public role, not their actual admin status  
✅ **Full Access** - Master Admins can see all admins, super admins, and member details  
✅ **Audit Trail** - All assignments/revocations are logged with reasons  
✅ **Role Change Support** - Master Admin status persists even if public role changes  
✅ **No Visibility** - Other users cannot see who the master admins are  
✅ **Secure** - Only Super Admins can assign/revoke master admin status  

---

## Database Schema

### New Column in `members` Table

```sql
ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS is_master_admin BOOLEAN NOT NULL DEFAULT false;
```

### New Table: `master_admin_audit`

Tracks all master admin assignments/revocations with reason and timestamp.

```sql
CREATE TABLE public.master_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('assigned', 'revoked', 'role_changed')),
  previous_role TEXT,
  new_role TEXT,
  reason TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Functions Available

### 1. `get_master_admins()`

**Purpose:** Retrieve all users with master_admin status  
**Returns:** List of master admins with their public role  
**Access:** Super Admin only

```sql
SELECT * FROM public.get_master_admins();
```

**Response:**
```json
[
  {
    "mem_id": 5,
    "auth_user_id": "uuid-123",
    "fullname": "John Doe",
    "username": "johndoe",
    "public_role": "admin",
    "master_admin": true,
    "created_at": "2026-04-03T10:00:00Z"
  }
]
```

### 2. `get_all_admins()`

**Purpose:** Retrieve all admin and super_admin users  
**Returns:** Complete admin list with master_admin status  
**Access:** Master Admin or Super Admin

```sql
SELECT * FROM public.get_all_admins();
```

### 3. `assign_master_admin(p_mem_id, p_reason)`

**Purpose:** Assign master admin role to a user  
**Parameters:**
- `p_mem_id` (INTEGER): Member ID to promote
- `p_reason` (TEXT, optional): Reason for assignment

**Access:** Super Admin only

```sql
SELECT public.assign_master_admin(
  p_mem_id := 5,
  p_reason := 'Assigned to oversee admin operations'
);
```

### 4. `revoke_master_admin(p_mem_id, p_reason)`

**Purpose:** Remove master admin role from a user  
**Parameters:**
- `p_mem_id` (INTEGER): Member ID to demote
- `p_reason` (TEXT, optional): Reason for revocation

**Access:** Super Admin only

```sql
SELECT public.revoke_master_admin(
  p_mem_id := 5,
  p_reason := 'Admin role change'
);
```

---

## Frontend Implementation

### Updated Authentication Context

The `AdminAuthContext` now includes:

```typescript
interface AdminAuthContextType {
  // ... existing fields
  isMasterAdmin: boolean;  // New field
}
```

Access in components:
```typescript
const { isMasterAdmin } = useAdminAuth();

if (isMasterAdmin) {
  // Show master admin features
}
```

### Master Admin Control Page

**Route:** `/admin/master-admin`  
**Access:** Super Admin only  
**Features:**
- View all master admins
- Assign new master admins
- Revoke master admin status
- View all admins and super admins
- View audit log of all assignments/revocations
- Search and filter capabilities

---

## How to Use

### As a Super Admin

#### 1. Assign a Master Admin

1. Go to **Admin Dashboard** → **Master Admin Control**
2. Click **"Assign Master Admin"** button
3. Select an admin from the dropdown
4. (Optional) Enter a reason
5. Click **"Assign Master Admin"**

**Behind the scenes:**
```sql
UPDATE public.members
SET is_master_admin = true, updated_at = now()
WHERE mem_id = 5;

-- Audit log created automatically
INSERT INTO public.master_admin_audit (...)
VALUES (...);
```

#### 2. View Master Admins

The **Master Admins** tab shows:
- Full name
- Username
- Public role they display
- Date assigned
- Option to revoke

#### 3. View All Admins

The **All Admins** tab shows a table of:
- Name
- Username
- Role
- Designation
- Master Admin status (checkmark if yes)
- Date joined

#### 4. View Audit Log

The **Audit Log** tab shows:
- Action taken (assigned/revoked)
- Reason provided
- Timestamp

### As a Master Admin (Using the System)

Master Admins can:
1. View the **Master Admin Control** page
2. See all admins and super admins
3. View member details
4. Retain all permissions of their public role

**Important:** Master Admins see this page as a special privilege, but it's only accessible through the application logic (not visible in sidebar for non-super-admins during normal operation).

---

## Security Considerations

### Row Level Security (RLS)

All audit logs are protected by RLS:
- ✅ Only Super Admins can VIEW audit logs
- ✅ Only Super Admins can INSERT audit logs
- ✅ Automatically enforced by Supabase

```sql
-- Super admins can view
CREATE POLICY "Super admins can view master admin audit"
ON public.master_admin_audit FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.members
    WHERE auth_user_id = auth.uid()
    AND role = 'super_admin'
  )
);
```

### Why It's Hidden

1. **No display badge** - The `is_master_admin` column is internal only
2. **Public role shown** - Users see `role` column (admin/super_admin/member/honourable)
3. **Page access restricted** - Only Super Admins can access `/admin/master-admin`
4. **Audit protected** - Master admin assignments logged in secure table

---

## Database Queries

### Hard-Code Assignment (Direct SQL)

```sql
-- Assign member with ID 5 as master admin
UPDATE public.members
SET is_master_admin = true, updated_at = now()
WHERE mem_id = 5;
```

### Check Master Admin Status

```sql
SELECT mem_id, fullname, role, is_master_admin
FROM public.members
WHERE mem_id = 5;
```

### View Master Admins Audit Trail

```sql
SELECT 
  maa.id,
  m.fullname,
  assigner.fullname AS assigned_by,
  maa.action,
  maa.reason,
  maa.assigned_at
FROM public.master_admin_audit maa
LEFT JOIN public.members m ON m.auth_user_id = maa.master_admin_id
LEFT JOIN public.members assigner ON assigner.auth_user_id = maa.assigned_by
ORDER BY maa.assigned_at DESC;
```

### Remove Master Admin Status

```sql
UPDATE public.members
SET is_master_admin = false, updated_at = now()
WHERE mem_id = 5;
```

---

## Scenarios

### Scenario 1: User as Normal Member

**Status:**
- `role` = 'member'
- `is_master_admin` = false
- Sees: Profile page, resources, events

### Scenario 2: User as Master Admin with Admin Public Role

**Status:**
- `role` = 'admin'
- `is_master_admin` = true
- Sees:
  - All admin features (events, quiz, finance, etc.) normally
  - Special Master Admin Control page
  - All other admins and members
  - Displays as "Admin" to others

### Scenario 3: User Changes from Admin to Honourable

**Status Before:**
- `role` = 'admin'
- `is_master_admin` = true

**Status After:**
- `role` = 'honourable'
- `is_master_admin` = true (persists!)
- Sees:
  - Normal honourable member features
  - Still has Master Admin Control page access
  - Still sees all admins and members

---

## Frontend Components

### AdminMasterAdminPage Component

**Path:** `src/pages/admin/AdminMasterAdminPage.tsx`  
**Features:**
- Three tabs: Master Admins | All Admins | Audit Log
- Modal dialog for assigning new master admins
- Real-time search and filtering
- Responsive table for admin list
- Audit trail with action badges

### Updated AdminSidebar

**New Navigation Item:**
```
Master Admin Control (icon: ShieldAlert)
- Only visible to super_admins
- Route: /admin/master-admin
- Placed after Permissions menu item
```

### Updated AdminAuthContext

**New Fields:**
```typescript
isMasterAdmin: boolean  // True if user is marked as master admin
```

---

## Migration & Setup

### Step 1: Run Migration

```bash
# The migration runs automatically:
# File: supabase/migrations/20260403_add_master_admin.sql
```

### Step 2: Configure in Supabase

1. Go to Supabase Dashboard
2. Run migrations in SQL Editor
3. Verify tables created:
   - `members.is_master_admin` column exists
   - `master_admin_audit` table exists

### Step 3: Deploy Application

1. Update auth context (already done)
2. Update sidebar (already done)
3. Add new route `/admin/master-admin` (already done)
4. Deploy to your server

### Step 4: Test

1. Login as Super Admin
2. Navigate to `/admin/master-admin`
3. Assign a test user as Master Admin
4. Verify they see the page
5. Check audit log

---

## Troubleshooting

### Issue: "Only super admins can view master admins"

**Solution:** Make sure the user is logged in as super_admin role in the members table

```sql
-- Check user role
SELECT role FROM public.members WHERE auth_user_id = '{user_id}';
```

### Issue: RPC function not found

**Solution:** Ensure migration has been applied

```sql
-- Check if function exists
SELECT EXISTS(
  SELECT 1 FROM pg_proc WHERE proname = 'assign_master_admin'
);
```

### Issue: Master Admin page shows "Access Denied"

**Solution:** The accessing user must be Super Admin

```sql
-- Verify user is super_admin
SELECT mem_id, fullname, role FROM public.members 
WHERE auth_user_id = '{current_user_id}';
```

### Issue: Assignments not appearing in audit log

**Solution:** Check RLS policy allows super admin access

```sql
-- Verify RLS policy
SELECT * FROM pg_policies 
WHERE tablename = 'master_admin_audit';
```

---

##SQL Reference

For complete SQL queries, see: `lib/MASTER_ADMIN_QUERIES.sql`

### Quick Commands

```sql
-- View all master admins
SELECT * FROM members WHERE is_master_admin = true;

-- Assign master admin
UPDATE members SET is_master_admin = true WHERE mem_id = 5;

-- Revoke master admin
UPDATE members SET is_master_admin = false WHERE mem_id = 5;

-- View audit log
SELECT * FROM master_admin_audit ORDER BY assigned_at DESC;

-- Count master admins
SELECT COUNT(*) FROM members WHERE is_master_admin = true;
```

---

## Conclusion

The Master Admin feature provides a secure, audited way to create hidden administrator roles while maintaining a public-facing role. All changes are logged and only Super Admins have access to manage this feature.
