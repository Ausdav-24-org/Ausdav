import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

interface AdminMember {
  mem_id: number;
  fullname: string;
  username: string;
  role: string;
  designation?: string | null;
}

const OPTIONS: { value: string; label: string }[] = [
  { value: 'president', label: 'President' },
  { value: 'vice_president', label: 'Vice President' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'vice_secretary', label: 'Vice Secretary' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'assistant_treasurer', label: 'Assistant Treasurer' },
  { value: 'editor', label: 'Editor' },
  { value: 'web_designer', label: 'Web Designer' },
  { value: 'general_committee_member', label: 'General Committee Member' },
  { value: 'education_committee_member', label: 'Education Committee Member' },
  { value: 'university_representative', label: 'University Representative' },
];

export default function AdminDesignationsPage() {
  const { isSuperAdmin, isMasterAdmin } = useAdminAuth();
  const [admins, setAdmins] = useState<AdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isSuperAdmin || isMasterAdmin) fetchAdmins();
  }, []);

  if (!isSuperAdmin && !isMasterAdmin) {
    return (
      <div className="p-8">
        <h3 className="text-lg font-medium">Access denied</h3>
        <p className="text-sm text-muted-foreground mt-2">Only super admins or master admins can view or assign designations.</p>
      </div>
    );
  }

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('members' as any)
        .select('mem_id, fullname, username, role, designation')
        .in('role', ['admin', 'super_admin'])
        .order('fullname', { ascending: true });
      if (error) throw error;
      const rows = ((data ?? []) as unknown) as AdminMember[];
      setAdmins(rows);
    } catch (err: any) {
      console.error('Failed to fetch admins', err);
      toast.error('Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const updateDesignation = async (mem_id: number, designation: string | null) => {
    if (!isSuperAdmin && !isMasterAdmin) {
      toast.error('Only super admins or master admins can update designations');
      return;
    }
    setSavingIds((s) => [...s, mem_id]);
    try {
      const { error } = await supabase
        .from('members' as any)
        .update({ designation })
        .eq('mem_id', mem_id);
      if (error) throw error;
      setAdmins((prev) => prev.map((a) => (a.mem_id === mem_id ? { ...a, designation } : a)));
      toast.success('Designation updated');
    } catch (err: any) {
      console.error('Update designation failed', err);
      toast.error(err?.message || 'Failed to update designation');
    } finally {
      setSavingIds((s) => s.filter((id) => id !== mem_id));
    }
  };

  const filteredAdmins = admins.filter((a) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.fullname.toLowerCase().includes(q) ||
      a.username.toLowerCase().includes(q) ||
      (a.designation ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
        <AdminHeader title="Designations" breadcrumb="Admin / Designations" />

      <Card>
        <CardHeader>
          <CardTitle>Assign Designations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4">Only super admins can assign designations to admins.</p>

          <div className="relative w-full sm:max-w-md mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, username, or designation..."
              className="pl-10 w-full text-xs sm:text-sm"
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px] text-xs sm:text-sm p-2 sm:p-3">Name</TableHead>
                  <TableHead className="hidden sm:table-cell min-w-[120px] text-xs sm:text-sm p-2 sm:p-3">Username</TableHead>
                  <TableHead className="hidden md:table-cell min-w-[100px] text-xs sm:text-sm p-2 sm:p-3">Role</TableHead>
                  <TableHead className="min-w-[160px] text-xs sm:text-sm p-2 sm:p-3">Designation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map((a) => (
                  <TableRow key={a.mem_id}>
                    <TableCell className="text-xs sm:text-sm p-2 sm:p-3">
                      <div>
                        <p className="font-medium">{a.fullname}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground p-2 sm:p-3">{a.username}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs sm:text-sm p-2 sm:p-3">
                      <Badge className="capitalize text-xs">{a.role.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm p-2 sm:p-3">
                      <Select
                        value={a.designation ?? 'none'}
                        onValueChange={(val) => updateDesignation(a.mem_id, val === 'none' ? null : val)}
                      >
                        <SelectTrigger className="w-full sm:w-48 text-xs sm:text-sm">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAdmins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 sm:py-8 text-xs sm:text-sm">
                      {loading ? 'Loading...' : searchQuery ? 'No admins match your search' : 'No admins found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
