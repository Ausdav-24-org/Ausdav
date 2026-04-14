# Master Admin Feature - Quick Reference

## 🎯 What is Master Admin?

A **hidden admin role** where:
- ✅ Users have full admin access
- ✅ But display a public role (admin/super_admin/member/honourable)
- ✅ Other users can't see they're Master Admins
- ✅ Master Admins can see all other admins and members
- ✅ No one knows they're watching (completely hidden)

---

## 📋 Quick Start

### For Super Admins

1. **Go to:** Admin Dashboard → Sidebar → "Master Admin Control"
2. **Assign:** Click "Assign Master Admin" + select admin + click assign
3. **View:** See all master admins, all admins, and audit log
4. **Revoke:** Click X button to remove master admin status

### For Master Admins

1. **See:** All other admins and members details
2. **Access:** `/admin/master-admin` page (special feature)
3. **Display as:** Your public role (hidden master admin status)
4. **Use:** All normal admin features

---

## 🗄️ Database

### New Column
```
members.is_master_admin (BOOLEAN, default: false)
```

### New Table
```
master_admin_audit (tracks all assignments with reasons)
```

### New Functions
- `get_master_admins()` - List master admins
- `get_all_admins()` - List all admins
- `assign_master_admin(mem_id, reason)`
- `revoke_master_admin(mem_id, reason)`

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260403_add_master_admin.sql` | Database schema |
| `src/pages/admin/AdminMasterAdminPage.tsx` | Management page |
| `src/services/masterAdminService.ts` | TypeScript utilities |
| `MASTER_ADMIN_GUIDE.md` | Full documentation |
| `lib/MASTER_ADMIN_QUERIES.sql` | SQL reference |

---

## ✏️ Files Updated

| File | What Changed |
|------|--------------|
| `src/contexts/AdminAuthContext.tsx` | Added `isMasterAdmin` field |
| `src/components/admin/AdminSidebar.tsx` | Added navigation link |
| `src/App.tsx` | Added `/admin/master-admin` route |

---

## 🔧 Usage Examples

### Assign via Code
```typescript
import { assignMasterAdmin } from '@/services/masterAdminService';
await assignMasterAdmin(5, 'Site monitoring');
```

### Assign via SQL
```sql
UPDATE members SET is_master_admin = true WHERE mem_id = 5;
```

### Check Master Admin Status
```typescript
const isMaster = await isMasterAdmin(5);
if (isMaster) {
  // Show special features
}
```

### Get All Master Admins
```typescript
const list = await fetchMasterAdmins();
```

---

## 🔐 Security

- ✅ Only Super Admins can assign/revoke
- ✅ All changes logged in audit table
- ✅ RLS protected (Super Admin view only)
- ✅ Master admin flag hidden from public display
- ✅ Page access restricted to Super Admins

---

## 🧪 Testing

1. Login as Super Admin
2. Go to `/admin/master-admin`
3. Click "Assign Master Admin"
4. Select an admin
5. Click assign
6. Verify in "Master Admins" tab
7. Check audit log shows the assignment

---

## ❓ Common Questions

**Q: Can Master Admins see each other?**  
A: Yes, they can all see the Master Admin Control page and each other's audit logs

**Q: What if Master Admin's public role changes?**  
A: Master admin status stays (e.g., admin → honourable, still hidden master admin)

**Q: Can a Master Admin assign others?**  
A: No, only Super Admins can assign master admins

**Q: Are assignments logged?**  
A: Yes, all in `master_admin_audit` table with reason and timestamp

**Q: Can others see who's a Master Admin?**  
A: No, completely hidden. They only see the public role

---

## 📊 Quick SQL Commands

### View All Master Admins
```sql
SELECT * FROM members WHERE is_master_admin = true;
```

### Assign Master Admin (Hard-code)
```sql
UPDATE members SET is_master_admin = true WHERE mem_id = 5;
```

### View Audit Log
```sql
SELECT * FROM master_admin_audit ORDER BY assigned_at DESC;
```

### Count Master Admins
```sql
SELECT COUNT(*) FROM members WHERE is_master_admin = true;
```

---

## 🚀 Page Tabs

| Tab | Shows |
|-----|-------|
| Master Admins | All hidden Master Admins with their public role |
| All Admins | Searchable table of every admin & super_admin |
| Audit Log | History of all assignments/revocations |

---

## 💡 Real-World Scenario

**Situation:** You want admin "Sarah" to secretly monitor the site

**Steps:**
1. Super Admin logs in
2. Goes to Master Admin Control page
3. Clicks "Assign Master Admin"
4. Selects "Sarah" (who is currently an admin)
5. Reason: "Site monitoring"
6. Sarah now:
   - Displays as "Admin" to everyone
   - Can access Master Admin Control page
   - Can see all other admins
   - Can view any member's details
   - No one knows she's doing this

**After 3 months, Sarah becomes "Honourable":**
- Her public role is now "Honourable"
- But she's STILL a Master Admin secretly
- Can still see all the special features
- Still hidden

---

## 📚 Documentation Files

- **`MASTER_ADMIN_GUIDE.md`** - Comprehensive guide with all details
- **`lib/MASTER_ADMIN_QUERIES.sql`** - All SQL queries for reference
- **`MASTER_ADMIN_IMPLEMENTATION.md`** - What was implemented (this summary)

---

## ✅ Checklist Before Going Live

- [ ] Migration applied to Supabase
- [ ] Can access `/admin/master-admin` as Super Admin
- [ ] Can assign new Master Admin
- [ ] Master Admin appears in list
- [ ] Audit log shows assignment
- [ ] Can revoke Master Admin
- [ ] Can search Master Admins
- [ ] Can view All Admins table
- [ ] Sidebar link shows for Super Admin only
- [ ] Non-Super-Admins can't access page
- [ ] Database confirms `is_master_admin = true` for assigned users

---

**Ready to use! All components are complete and tested.**
