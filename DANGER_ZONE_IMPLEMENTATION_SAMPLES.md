# Implementation Examples

## AdminMembersPage - Delete Member

### Add Import
```typescript
import { useDangerZoneLog } from '@/hooks/useDangerZoneLog';
```

### Inside Component Function
```typescript
export default function AdminMembersPage() {
  // ... existing code ...
  const { logDangerAction } = useDangerZoneLog();
  
  // ... existing code ...
  
  // Update deleteMember function
  const deleteMember = async (mem_id: number, fullname: string) => {
    if (!window.confirm(`Are you sure you want to delete ${fullname}? This action cannot be undone.`)) return;

    try {
      setDeleting(mem_id);
      const { error } = await (supabase as any)
        .from('members')
        .delete()
        .eq('mem_id', mem_id);

      if (error) throw error;

      // Log the danger action
      await logDangerAction({
        page: 'members',
        action: 'delete_member',
        targetId: String(mem_id),
        targetName: fullname,
      });

      toast.success(`${fullname} deleted successfully`);
      await fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete member');
    } finally {
      setDeleting(null);
    }
  };
}
```

---

## AdminQuizPage - Delete All Results

### Add Import
```typescript
import { useDangerZoneLog } from '@/hooks/useDangerZoneLog';
```

### Inside Component Function
```typescript
export default function AdminQuizPage() {
  // ... existing code ...
  const { logDangerAction } = useDangerZoneLog();
  
  // ... existing code ...
  
  // Update handleDeleteAllResults function
  const handleDeleteAllResults = async () => {
    const confirmDelete = window.confirm(
      'Permanently delete ALL quiz results and answers for ALL schools? This cannot be undone.'
    );
    if (!confirmDelete) return;

    setDeletingAllResults(true);
    try {
      // Delete all results
      const { error: rErr } = await supabase
        .from("school_quiz_results")
        .delete()
        .gt("id", 0); // Delete all
      if (rErr) throw rErr;

      // Delete all answers
      const { error: aErr } = await supabase
        .from("school_quiz_answers" as any)
        .delete()
        .gt("id", 0); // Delete all
      if (aErr) console.error("Error deleting answers:", aErr);

      // Log the massive deletion
      await logDangerAction({
        page: 'quiz',
        action: 'delete_all_results',
        targetId: 'all',
        targetName: 'ALL QUIZ RESULTS',
        reasonNote: 'Bulk deletion of all quiz data',
      });

      toast.success('All quiz results deleted');
      fetchSchoolResults();
      fetchSchoolAnswersMap().catch(() => {});
    } catch (err) {
      console.error("Error deleting all results:", err);
      toast.error("Failed to delete results");
    } finally {
      setDeletingAllResults(false);
    }
  };
}
```

---

## AdminEventsPage - Delete Event

### Add Import
```typescript
import { useDangerZoneLog } from '@/hooks/useDangerZoneLog';
```

### Inside Component Function
```typescript
export default function AdminEventsPage() {
  // ... existing code ...
  const { logDangerAction } = useDangerZoneLog();
  
  // ... existing code ...
  
  // Update delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (event: any) => {
      // Perform deletion
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id);

      if (error) throw error;

      // Log the action
      await logDangerAction({
        page: 'events',
        action: 'delete_event',
        targetId: event.id,
        targetName: event.title,
      });

      return event;
    },
    onSuccess: () => {
      toast.success("Event deleted successfully");
      setEvents(prev => prev.filter(e => e.id !== selectedEvent?.id));
      setSelectedEvent(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete event");
    },
  });
}
```

---

## AdminAnnouncementsPage - Delete Announcement

### Add Import
```typescript
import { useDangerZoneLog } from '@/hooks/useDangerZoneLog';
```

### Inside Component Function
```typescript
export default function AdminAnnouncementsPage() {
  // ... existing code ...
  const { logDangerAction } = useDangerZoneLog();
  
  // ... existing code ...
  
  // Update handleDelete function
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    if (deletingAnnouncementId === id) return;
    setDeletingAnnouncementId(id);

    try {
      const { error } = await (supabase as any)
        .from('announcements')
        .delete()
        .eq('announcement_id', id);
      if (error) throw error;

      // Find the announcement title for logging
      const announcement = announcements.find(a => a.id === id);

      // Log the action
      await logDangerAction({
        page: 'announcements',
        action: 'delete_announcement',
        targetId: id,
        targetName: announcement?.title || 'Unknown',
      });

      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success('Announcement deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    } finally {
      setDeletingAnnouncementId(null);
    }
  };
}
```

---

## AdminDetailsPage - Delete Contact

### Add Import
```typescript
import { useDangerZoneLog } from '@/hooks/useDangerZoneLog';
```

### Inside Component Function
```typescript
export default function AdminDetailsPage() {
  // ... existing code ...
  const { logDangerAction } = useDangerZoneLog();
  
  // ... existing code ...
  
  // Update deleteContact function
  const deleteContact = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;

    try {
      setLoading(true);
      const { error } = await (supabase as any)
        .from('admin_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Find contact for logging
      const contact = contacts.find(c => c.id === id);

      // Log the action
      await logDangerAction({
        page: 'admin-details',
        action: 'delete_contact',
        targetId: String(id),
        targetName: contact?.name || 'Unknown',
      });

      toast({ title: 'Success', description: 'Contact deleted successfully' });
      await loadContacts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete contact',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
}
```

---

## AdminApplicantsPage - Delete All Applicants

### Add Import
```typescript
import { useDangerZoneLog } from '@/hooks/useDangerZoneLog';
```

### Inside Component Function
```typescript
export default function AdminApplicantsPage() {
  // ... existing code ...
  const { logDangerAction } = useDangerZoneLog();
  
  // ... existing code ...
  
  // Update deleteAllForYear function
  const deleteAllForYear = async () => {
    if (!window.confirm(
      `Permanently delete all ${yearApplicants.length} applicants from ${selectedYear}? This cannot be undone.`
    )) return;

    setDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from('applicants')
        .delete()
        .eq('batch', selectedYear);

      if (error) throw error;

      // Log the bulk deletion
      await logDangerAction({
        page: 'applicants',
        action: 'delete_batch_applicants',
        targetId: String(selectedYear),
        targetName: `${yearApplicants.length} applicants from ${selectedYear}`,
        reasonNote: 'Batch deletion of all applicants for year',
      });

      toast.success(`Deleted all ${yearApplicants.length} applicants from ${selectedYear}`);
      await loadApplicants();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete applicants');
    } finally {
      setDeleting(false);
    }
  };
}
```

---

## Summary

All updates follow this pattern:

1. **Import** the hook
2. **Call** `logDangerAction()` after successful deletion
3. **Provide**:
   - `page`: Current page name
   - `action`: What was deleted
   - `targetId`: ID of deleted item
   - `targetName`: Name/description of deleted item
   - `reasonNote` (optional): Reason for bulk deletions

Every danger zone action is now **fully audited and traceable**! ✅

