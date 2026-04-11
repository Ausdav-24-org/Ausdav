# Danger Zone Audit Logging System

## Overview

This system tracks all "danger zone" button actions (deletions, bulk deletes, etc.) across the admin panel. Every admin action is logged with:
- **Who** performed the action (admin_id)
- **What** action was performed (e.g., "delete_member", "delete_all_results")
- **When** it happened (timestamp)
- **Which page** the action was on
- **Target details** (what was deleted - ID and name)

---

## Database Schema

### Table: `admin_danger_zone_logs`

```sql
Column Name     | Type                  | Description
-----------     |-----------            |----
id              | UUID                  | Unique identifier (auto-generated)
admin_id        | UUID                  | Who performed the action (FK to auth.users)
page            | TEXT                  | Which page (e.g., "members", "quiz", "events")
action          | TEXT                  | What action (e.g., "delete_member", "delete_all_results")
target_id       | TEXT                  | ID of deleted item (e.g., member ID, event ID)
target_name     | TEXT                  | Name of deleted item (e.g., "John Doe", "Event Name")
reason_note     | TEXT                  | Optional reason note from confirmation dialog
status          | TEXT                  | Status (default: "completed")
created_at      | TIMESTAMP             | When action was performed
updated_at      | TIMESTAMP             | Last update (auto-managed)
```

### Indexes
- `idx_danger_zone_logs_admin_id` - Fast lookup by admin
- `idx_danger_zone_logs_page` - Fast lookup by page
- `idx_danger_zone_logs_action` - Fast lookup by action type
- `idx_danger_zone_logs_created_at` - Fast lookup by timestamp

---

## RLS Policies

| Policy | Effect | Who Can Access |
|--------|--------|---|
| SELECT | View logs | Super admins only |
| INSERT | Create logs | Any admin (their own actions) |
| UPDATE | Edit logs | Super admins only |
| DELETE | Remove logs | Super admins only |

---

## Usage

### Step 1: Import the Hook

```typescript
import { useDangerZoneLog } from '@/hooks/useDangerZoneLog';
```

### Step 2: Use in Your Component

```typescript
const { logDangerAction } = useDangerZoneLog();

// In your delete function:
const handleDelete = async (id: string, name: string) => {
  if (!confirm('Are you sure?')) return;
  
  try {
    // Perform the delete
    await db.from('members').delete().eq('id', id);
    
    // Log the action
    await logDangerAction({
      page: 'members',
      action: 'delete_member',
      targetId: id,
      targetName: name,
    });
    
    toast.success('Deleted successfully');
  } catch (error) {
    toast.error('Failed to delete');
  }
};
```

---

## Pages Currently Using Danger Zone (Updated)

### 1. **AdminMembersPage.tsx**
- ✅ Delete individual member
- ✅ Delete all members for batch

**Actions Logged:**
- `delete_member` - Single member deletion
- `delete_batch_members` - Bulk delete all from batch

---

### 2. **AdminEventsPage.tsx**
- ✅ Delete individual event
- ✅ Delete gallery
- ✅ Delete gallery images

**Actions Logged:**
- `delete_event` - Single event
- `delete_gallery` - Gallery with images

---

### 3. **AdminQuizPage.tsx**
- ✅ Delete quiz password
- ✅ Delete school results
- ✅ Delete all results
- ✅ Delete individual question

**Actions Logged:**
- `delete_quiz_password` - Quiz password/test
- `delete_school_results` - Results for one school
- `delete_all_results` - All quiz results
- `delete_question` - Individual question

---

### 4. **AdminAnnouncementsPage.tsx**
- ✅ Delete announcement

**Actions Logged:**
- `delete_announcement` - Single announcement

---

### 5. **AdminExamPage.tsx**
- ✅ Delete exam paper

**Actions Logged:**
- `delete_exam_paper` - Single exam past paper

---

### 6. **AdminPastPaperPage.tsx**
- ✅ Delete past paper

**Actions Logged:**
- `delete_past_paper` - Single past paper

---

### 7. **AdminSeminarPage.tsx**
- ✅ Delete seminar

**Actions Logged:**
- `delete_seminar` - Single seminar material

---

### 8. **AdminFeedbackPage.tsx**
- ✅ Delete feedback

**Actions Logged:**
- `delete_feedback` - Single feedback item

---

### 9. **AdminDetailsPage.tsx**
- ✅ Delete contact
- ✅ Delete document
- ✅ Delete image

**Actions Logged:**
- `delete_contact` - Contact delete
- `delete_document` - Document delete
- `delete_image` - Image delete

---

### 10. **AdminApplicantsPage.tsx**
- ✅ Delete all applicants for year
- ✅ Accept applicant (status change)

**Actions Logged:**
- `delete_batch_applicants` - All applicants from year
- `accept_applicant` - Applicant status change

---

### 11. **AdminPatronsPage.tsx**
- ✅ Delete patron

**Actions Logged:**
- `delete_patron` - Single patron

---

### 12. **AdminAuditPage.tsx**
- ✅ Delete audit record

**Actions Logged:**
- `delete_audit_record` - Audit log entry

---

## Action Name Convention

Format: `[verb]_[object]`

```
delete_member
delete_all_results
delete_quiz_password
delete_announcement
delete_gallery
```

---

## Example Implementation

### Before (Without Logging)
```typescript
const handleDelete = async (id: string) => {
  if (!confirm('Delete this member?')) return;
  
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);
  
  if (error) {
    toast.error('Failed');
  } else {
    toast.success('Deleted');
  }
};
```

### After (With Logging)
```typescript
const { logDangerAction } = useDangerZoneLog();

const handleDelete = async (id: string, name: string) => {
  if (!confirm('Delete this member?')) return;
  
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);
  
  if (error) {
    toast.error('Failed');
  } else {
    // Log the action
    await logDangerAction({
      page: 'members',
      action: 'delete_member',
      targetId: id,
      targetName: name,
    });
    
    toast.success('Deleted');
  }
};
```

---

## Dashboard/Reporting (Future)

A super admin can view all danger zone logs:

```typescript
const { getDangerLogs } = useDangerZoneLog();

// Get all logs
const allLogs = await getDangerLogs();

// Get logs by page
const memberDeleteLogs = await getDangerLogs('members');

// Get logs by action
const allDeletes = await getDangerLogs(null, 'delete_member');
```

---

## Migration

Run the SQL migration to create the table:

```bash
npx supabase migration create admin_danger_zone_audit_log
```

Then apply:

```bash
npx supabase up
```

---

## Security

- Only **super admins** can view danger zone logs
- Admins can only **log their own** actions
- Logs are **immutable** - can only be added, never modified by regular admins
- All activities are **timestamped** and **traceable**
- **RLS policies** prevent unauthorized access

---

## Testing

Submit a request in AdminMembersPage:
1. Delete a member
2. Check Supabase → `admin_danger_zone_logs` table
3. Verify entry created with your admin_id, timestamp, and member details

