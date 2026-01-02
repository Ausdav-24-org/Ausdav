import { useEffect, useState, useRef } from 'react';
import {
  Users,
  Search,
  MoreVertical,
  UserPlus,
  Check,
  X,
  Loader2,
  Mail,
  Download,
  Upload,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRefresh } from '@/hooks/useAdminRefresh';
import { invokeFunction } from '@/integrations/supabase/functions';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';

interface Member {
  mem_id: number;
  auth_user_id: string | null;
  fullname: string;
  username: string;
  phone: string;
  batch: number | null;
  created_at: string;
  role: string;
  designation: string;
  // Legacy flags kept for UI continuity; members table does not provide these.
  is_active?: boolean;
  can_submit_finance?: boolean;
}

type RawMember = Pick<
  Member,
  'mem_id' | 'auth_user_id' | 'fullname' | 'username' | 'phone' | 'batch' | 'created_at' | 'role' | 'designation'
>;

export default function AdminMembersPage() {
  const { isSuperAdmin, isAdmin, role } = useAdminAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [committeeChangingPhase, setCommitteeChangingPhase] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBatch, setFilterBatch] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterDesignation, setFilterDesignation] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const fetchRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('member');
  const [inviting, setInviting] = useState(false);
  // CSV import
  const [importOpen, setImportOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewErrorsCount, setPreviewErrorsCount] = useState(0);

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    // When committee phase setting is loaded/changed, refresh members to apply filter
    if (committeeChangingPhase !== null) {
      fetchMembers();
    }
  }, [committeeChangingPhase]);

  useEffect(() => {
    // load committee phase setting
    (async () => {
      try {
        const res = await supabase.from('app_settings').select('committee_changing_phase').eq('id', 1).maybeSingle();
        // supabase returns { data, error } — guard against missing column or error
        // prefer explicit names to avoid type inference issues
        const settingRow = (res as any).data;
        const settingErr = (res as any).error;
        if (settingErr) {
          console.warn('app_settings query error', settingErr);
          setCommitteeChangingPhase(null);
        } else {
          setCommitteeChangingPhase(settingRow?.committee_changing_phase ?? null);
        }
      } catch (err) {
        console.warn('Unable to load committee_changing_phase setting', err);
        setCommitteeChangingPhase(null);
      }
    })();
  }, []);

  const fetchMembers = async () => {
    try {
      // Use edge function so service-role can return all rows (including null auth_user_id)
      const { data, error } = await invokeFunction('fetch-members', {});
      if (error) throw error;

      const rows = ((data?.members ?? []) as unknown) as RawMember[];
      const normalized: Member[] = rows.map((m) => ({
        ...m,
        // Keep legacy flags defined to avoid UI undefined access; server table lacks these.
        is_active: true,
        can_submit_finance: false,
      }));

      // If committee changing phase is disabled (false), hide honourable members from the list
      if (committeeChangingPhase === false) {
        setMembers(normalized.filter((r) => r.role !== 'honourable') as Member[]);
      } else {
        setMembers(normalized as Member[]);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  // keep a stable reference for external refresh triggers
  fetchRef.current = fetchMembers;
  useAdminRefresh(() => {
    fetchRef.current?.();
  });

  const toggleActive = async () => {
    toast.error('Activation toggle is not supported with the current members schema.');
  };

  const toggleFinancePermission = async () => {
    toast.error('Finance permission toggle is not supported with the current members schema.');
  };

  const changeRole = async (member: Member, newRole: string) => {
    // Only super admins may change roles
    if (!isSuperAdmin) {
      console.error('changeRole blocked: isSuperAdmin=', isSuperAdmin, 'role=', role);
      toast.error('Only super admins can change roles');
      return;
    }

    try {
      // If committee changing phase is disabled, do not allow promoting to honourable
      if (committeeChangingPhase === false && newRole === 'honourable') {
        toast.error('Committee changing phase is disabled — cannot promote to Honourable');
        return;
      }
      const targetIds = selectedIds && selectedIds.length > 0 ? selectedIds : [member.mem_id];

      // Client-side guard: Honourable role is immutable once assigned
      if (newRole !== 'honourable') {
        const honourableSelected = members.find((m) => targetIds.includes(m.mem_id) && m.role === 'honourable');
        if (honourableSelected) {
          toast.error('Honourable role is immutable and cannot be changed');
          return;
        }
      }

      // Client-side guard: only allow promoting to honourable if all targets are currently 'admin'
      if (newRole === 'honourable') {
        const nonAdmin = members.find((m) => targetIds.includes(m.mem_id) && m.role !== 'admin');
        if (nonAdmin) {
          toast.error('Only members with role "admin" may be promoted to Honourable');
          return;
        }
      }

      const { data, error } = await invokeFunction('update-member-role', {
        mem_ids: targetIds,
        new_role: newRole,
      });
      if (error) throw error;
      const updated = data?.updated ?? [];
      if (!updated || (Array.isArray(updated) && updated.length === 0)) {
        toast.error('No rows updated — check your permissions or server logs');
        return;
      }
      const updatedIds = (updated as any[]).map((u) => u.mem_id);
      setMembers((prev) => prev.map((m) => (updatedIds.includes(m.mem_id) ? { ...m, role: newRole } : m)));
      setSelectedIds([]);
      toast.success('Role updated successfully');
    } catch (error: any) {
      console.error('Change role failed', error);
      toast.error(error.message || 'Failed to update role');
    }
  };

  const changeRoleBulk = async (newRole: string) => {
    if (committeeChangingPhase === false && newRole === 'honourable') {
      toast.error('Committee changing phase is disabled — cannot promote to Honourable');
      return;
    }
    // If any selected are honourable and we're trying to change them, block early
    if (newRole !== 'honourable') {
      const honourableSelected = members.find((m) => selectedIds.includes(m.mem_id) && m.role === 'honourable');
      if (honourableSelected) {
        toast.error('Cannot change role of Honourable members');
        return;
      }
    }

    // For promoting to honourable, require all selected be 'admin'
    if (newRole === 'honourable') {
      const nonAdmin = members.find((m) => selectedIds.includes(m.mem_id) && m.role !== 'admin');
      if (nonAdmin) {
        toast.error('Only members with role "admin" may be promoted to Honourable');
        return;
      }
    }

    // changeRole reads `selectedIds` when present, so a dummy member param is fine
    await changeRole({} as Member, newRole);
  };

  const deleteMember = async (member: Member) => {
    const targetIds = selectedIds && selectedIds.length > 0 ? selectedIds : [member.mem_id];
    // Check permissions: admins may only delete members (role === 'member')
    const targets = members.filter((m) => targetIds.includes(m.mem_id));
    if (!isSuperAdmin) {
      const invalid = targets.find((t) => t.role !== 'member');
      if (invalid) {
        toast.error('Insufficient permissions: admins can only remove members');
        return;
      }
    }

    const ok = window.confirm(`Delete ${targetIds.length} member(s)? This cannot be undone.`);
    if (!ok) return;
    try {
      const { data, error } = await invokeFunction('delete-members', { mem_ids: targetIds });
      if (error) throw error;
      const deleted = data?.deleted ?? [];
      if (!deleted || (Array.isArray(deleted) && deleted.length === 0)) {
        toast.error('No rows deleted — check your permissions or server logs');
        return;
      }
      const deletedIds = (deleted as any[]).map((d) => d.mem_id);
      setMembers((prev) => prev.filter((m) => !deletedIds.includes(m.mem_id)));
      setSelectedIds([]);
      toast.success('Member(s) removed');
    } catch (err: any) {
      console.error('Delete member failed', err);
      toast.error(err?.message || 'Failed to delete member');
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName) {
      toast.error('Please fill in all fields');
      return;
    }

    setInviting(true);
    try {
      // Note: In production, you would use an edge function to send invites
      // For now, we'll create the user directly (super_admin only)
      toast.info('Invite functionality requires email service setup');
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const downloadCsvTemplate = () => {
    const headers = [
      'fullname',
      'username',
      'nic',
      'gender',
      'role',
      'batch',
      'university',
      'school',
      'phone',
      'designation',
      'uni_degree',
      'profile_bucket',
      'profile_path',
    ];
    const sample = [
      'Anitha Kumar',
      'anitha.k',
      '912345678V',
      'female',
      'member',
      '2019',
      'University of Colombo',
      'Science',
      '0771234567',
      'lecturer',
      'BSc',
      'member-profiles',
      'profiles/anitha.jpg',
    ];

    const csvContent = headers.join(',') + '\n' + sample.map((v) => `"${v}"`).join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `members_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  function parseFileToPreview(file: File) {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as string[][];
        if (!rows || rows.length < 2) return;
        const headers = rows[0].map((h) => String(h).trim().toLowerCase());
        const expected = ['fullname','username','nic','gender','role','batch','university','school','phone','designation','uni_degree','profile_bucket','profile_path'];
        const headerMap: Record<string, number> = {};
        expected.forEach((col) => {
          const idx = headers.indexOf(col);
          if (idx !== -1) headerMap[col] = idx;
        });

        const preview: any[] = [];
        let errorsCount = 0;
        for (let i = 1; i < rows.length; i++) {
          const values = rows[i].map((v) => String(v).trim().replace(/^"|"$/g, ''));
          const get = (k: string) => (headerMap[k] !== undefined ? values[headerMap[k]] : '');
          const data = {
            fullname: get('fullname'),
            username: get('username'),
            nic: get('nic'),
            gender: get('gender'),
            role: get('role') || 'member',
            batch: get('batch'),
            university: get('university'),
            school: get('school'),
            phone: get('phone') || '',
            designation: get('designation') || 'none',
            uni_degree: get('uni_degree') || '',
            profile_bucket: get('profile_bucket') || '',
            profile_path: get('profile_path') || '',
          };

          const rowErrors: string[] = [];
          if (!data.fullname) rowErrors.push('fullname missing');
          if (!data.username) rowErrors.push('username missing');
          if (!data.nic) rowErrors.push('nic missing');
          if (!data.gender) rowErrors.push('gender missing');
          if (!data.batch || Number.isNaN(Number(data.batch))) rowErrors.push('batch invalid');
          if (!data.university) rowErrors.push('university missing');
          if (!data.school) rowErrors.push('school missing');

          const action = members.find((m) => m.username === data.username) ? 'update' : 'insert';

          if (rowErrors.length) errorsCount += 1;
          preview.push({ data, errors: rowErrors, action });
        }

        setPreviewRows(preview);
        setPreviewErrorsCount(errorsCount);
      },
      error: (err) => {
        console.error('CSV parse error', err);
        toast.error('Failed to parse CSV');
      },
    });
  }

  const handleMembersCsvImport = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setImporting(true);
    try {
      // If user used preview, use that parsed rows; else parse now using PapaParse
      let parsed: any[] = [];
      if (previewRows && previewRows.length > 0) {
        parsed = previewRows.filter((r) => (r.errors || []).length === 0).map((r) => r.data);
        if (parsed.length === 0) throw new Error('No valid rows to import from preview');
      } else {
        const text = await csvFile.text();
        const res = Papa.parse<string[]>(text, { skipEmptyLines: true });
        if (res.errors && res.errors.length) throw new Error(res.errors[0].message || 'CSV parse error');
        const rows = res.data as string[][];
        if (rows.length < 2) throw new Error('CSV contains no data rows');
        const headers = rows[0].map((h) => h.trim().toLowerCase());
        const expected = ['fullname','username','nic','gender','role','batch','university','school','phone','designation','uni_degree','profile_bucket','profile_path'];
        const headerMap: Record<string, number> = {};
        expected.forEach((col) => {
          const idx = headers.indexOf(col);
          if (idx === -1) {
            if (!['uni_degree','profile_bucket','profile_path'].includes(col)) {
              throw new Error(`Missing required column: ${col}`);
            }
          } else {
            headerMap[col] = idx;
          }
        });

        for (let i = 1; i < rows.length; i++) {
          const values = rows[i].map((v) => String(v).trim().replace(/^"|"$/g, ''));
          const get = (k: string) => (headerMap[k] !== undefined ? values[headerMap[k]] : '');
          const fullname = get('fullname');
          const username = get('username');
          const nic = get('nic');
          const genderRaw = get('gender');
          const role = get('role') || 'member';
          const batchRaw = get('batch');
          const university = get('university');
          const school = get('school');
          const phone = get('phone') || '';
          const designation = get('designation') || 'none';
          if (!fullname || !username || !nic || !genderRaw || !batchRaw || !university || !school) {
            continue;
          }
          const gender = ['male','m','1','true'].includes(genderRaw.toLowerCase());
          const batch = parseInt(batchRaw, 10);
          if (Number.isNaN(batch)) continue;
          const row: any = { fullname, username, nic, gender, role, batch, university, school, phone, designation };
          const uni_degree = get('uni_degree'); if (uni_degree) row.uni_degree = uni_degree;
          const profile_bucket = get('profile_bucket'); if (profile_bucket) row.profile_bucket = profile_bucket;
          const profile_path = get('profile_path'); if (profile_path) row.profile_path = profile_path;
          parsed.push(row);
        }
      }

      if (parsed.length === 0) throw new Error('No valid rows parsed from CSV');

      // Send to server-side function to enforce super-admin check and perform service-role upsert
      // Remove any mem_id/auth_user_id keys just in case
      const cleaned = parsed.map((r) => {
        const c = { ...r } as Record<string, any>;
        delete c.mem_id;
        delete c.auth_user_id;
        return c;
      });

      const { data, error } = await invokeFunction('import-members', { members: cleaned });
      if (error) throw error;

      const inserted = data?.inserted ?? data ?? [];
      toast.success(`Imported ${Array.isArray(inserted) ? inserted.length : parsed.length} members successfully`);
      setImportOpen(false);
      setCsvFile(null);
      fetchMembers();
    } catch (err: any) {
      console.error('CSV import error', err);
      toast.error(err?.message || 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBatch =
      filterBatch === 'all' || String(member.batch) === filterBatch;
    const matchesRole = filterRole === 'all' || member.role === filterRole;
    const matchesDesignation = filterDesignation === 'all' || member.designation === filterDesignation;
    return matchesSearch && matchesBatch && matchesRole && matchesDesignation;
  });

  const uniqueBatches = [...new Set(members.map((m) => m.batch).filter((b) => b !== null))];
  const uniqueDesignations = [...new Set(members.map((m) => m.designation).filter((d) => d && d !== 'none'))];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-500/20 text-red-400';
      case 'admin':
        return 'bg-primary/20 text-primary';
      case 'member':
        return 'bg-green-500/20 text-green-400';
      case 'honourable':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <PermissionGate permissionKey="member" permissionName="Member Handling">
      <div className="min-h-screen">
        <AdminHeader title="Members" breadcrumb="Management" />

      <div className="p-6 space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50"
              />
            </div>

            <Select value={filterBatch} onValueChange={setFilterBatch}>
              <SelectTrigger className="w-[140px] bg-background/50">
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {uniqueBatches.map((batch) => (
                  <SelectItem key={batch} value={String(batch)}>
                    {batch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[180px] bg-background/50">
                <SelectValue placeholder="Everyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="member">Members</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="honourable">Honourables</SelectItem>
                <SelectItem value="super_admin">Super Admins</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterDesignation} onValueChange={setFilterDesignation}>
              <SelectTrigger className="w-[160px] bg-background/50">
                <SelectValue placeholder="All Designations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Designations</SelectItem>
                {uniqueDesignations.map((designation) => (
                  <SelectItem key={designation} value={designation}>
                    {designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isSuperAdmin && (
            <div className="flex gap-2">
              <Button onClick={downloadCsvTemplate} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
              <Button onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </div>
          )}
          {/* Bulk actions when rows selected */}
          {selectedIds.length > 0 && isSuperAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Change Role</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {(() => {
                    const selectedTargets = members.filter((m) => selectedIds.includes(m.mem_id));
                    const hasHonourableSelected = selectedTargets.some((t) => t.role === 'honourable');
                    const allAdminSelected = selectedTargets.length > 0 && selectedTargets.every((t) => t.role === 'admin');
                    const callerIsAdminOnly = isAdmin && !isSuperAdmin;
                    const hasNonMember = selectedTargets.find((t) => t.role !== 'member');

                    if (callerIsAdminOnly && hasNonMember) {
                      return null;
                    }

                    return (
                      <>
                        <DropdownMenuItem onClick={() => changeRoleBulk('member')} disabled={hasHonourableSelected} className="hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer disabled:cursor-not-allowed">Set as Member</DropdownMenuItem>
                        {committeeChangingPhase !== false && (
                          <DropdownMenuItem onClick={() => changeRoleBulk('honourable')} disabled={!allAdminSelected} className="hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer disabled:cursor-not-allowed">Set as Honourable</DropdownMenuItem>
                        )}
                        {isSuperAdmin && (
                          <>
                            <DropdownMenuItem onClick={() => changeRoleBulk('admin')} disabled={hasHonourableSelected} className="hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer disabled:cursor-not-allowed">Set as Admin</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => changeRoleBulk('super_admin')} disabled={hasHonourableSelected} className="hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer disabled:cursor-not-allowed">Set as Super Admin</DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer" onClick={async () => { await deleteMember({} as Member); }}>Remove selected</DropdownMenuItem>
                      </>
                    );
                  })()}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Members Table */}
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                      <TableHead>
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          checked={filteredMembers.length > 0 && filteredMembers.every((m) => selectedIds.includes(m.mem_id))}
                          onChange={() => {
                            if (filteredMembers.length > 0 && filteredMembers.every((m) => selectedIds.includes(m.mem_id))) {
                              setSelectedIds([]);
                            } else {
                              setSelectedIds(filteredMembers.map((m) => m.mem_id));
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.mem_id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Select ${member.username}`}
                          checked={selectedIds.includes(member.mem_id)}
                          onChange={() => {
                            if (selectedIds.includes(member.mem_id)) {
                              setSelectedIds((prev) => prev.filter((id) => id !== member.mem_id));
                            } else {
                              setSelectedIds((prev) => [...prev, member.mem_id]);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{member.fullname}</p>
                          <p className="text-sm text-muted-foreground">{member.username}</p>
                        </div>
                      </TableCell>

                      <TableCell>{member.batch ?? '-'}</TableCell>

                      <TableCell>{member.designation ? member.designation.replace(/_/g, ' ') : '-'}</TableCell>

                      <TableCell>
                        <Badge className={cn('capitalize', getRoleBadgeColor(member.role || ''))}>
                          {member.role?.replace('_', ' ') || 'Unknown'}
                        </Badge>
                      </TableCell>

                      {/* Status and Finance columns removed per admin UI requirements */}

                      <TableCell className="text-right">
                        {(isSuperAdmin || (isAdmin && member.role === 'member')) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isSuperAdmin && (
                                <>
                                      {member.role === 'honourable' ? (
                                        <>
                                          <DropdownMenuItem disabled className="cursor-not-allowed">Honourable (immutable)</DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                        </>
                                      ) : (
                                        <>
                                          <DropdownMenuItem onClick={() => changeRole(member, 'member')} className="hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer">Set as Member</DropdownMenuItem>
                                          {committeeChangingPhase !== false && (
                                            member.role === 'admin' ? (
                                              <DropdownMenuItem onClick={() => changeRole(member, 'honourable')} className="hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer">Set as Honourable</DropdownMenuItem>
                                            ) : (
                                              <DropdownMenuItem disabled className="cursor-not-allowed">Set as Honourable (admins only)</DropdownMenuItem>
                                            )
                                          )}
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={() => changeRole(member, 'admin')} className="hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer">Set as Admin</DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => changeRole(member, 'super_admin')} className="hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer">Set as Super Admin</DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                        </>
                                      )}
                                </>
                              )}
                              {isSuperAdmin || (isAdmin && member.role === 'member') ? (
                                <DropdownMenuItem onClick={() => deleteMember(member)} className="text-red-600 hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer">
                                  Remove
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No members found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
            <div>
              <p className="text-sm text-muted-foreground">
                Required columns: fullname, username, nic, gender, role, batch, university, school, phone, designation. Optional: uni_degree, profile_bucket, profile_path.
              </p>
            </div>

            {previewRows.length > 0 && (
              <div className="mt-4 max-h-64 overflow-auto">
                <div className="mb-2 text-sm">Preview: {previewRows.length} rows — {previewErrorsCount} errors</div>
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-muted/10">
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Username</th>
                      <th className="p-2 text-left">Full name</th>
                      <th className="p-2 text-left">Action</th>
                      <th className="p-2 text-left">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, idx) => (
                      <tr key={idx} className={r.errors && r.errors.length ? 'bg-red-50' : ''}>
                        <td className="p-2 align-top">{idx + 1}</td>
                        <td className="p-2 align-top">{r.data.username}</td>
                        <td className="p-2 align-top">{r.data.fullname}</td>
                        <td className="p-2 align-top">{r.action}</td>
                        <td className="p-2 align-top text-xs text-red-600">{(r.errors || []).join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

        {/* Import Dialog (uses previewRows) */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Members from CSV</DialogTitle>
              <DialogDescription>Upload a CSV matching the members schema. Use the template for column order.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label>CSV File</Label>
                <input
                  type="file"
                  accept="text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setCsvFile(f);
                    if (f) parseFileToPreview(f);
                  }}
                  className="mt-2"
                />
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Required columns: fullname, username, nic, gender, role, batch, university, school, phone, designation. Optional: uni_degree, profile_bucket, profile_path.
                </p>
              </div>

              {previewRows.length > 0 && (
                <div className="mt-4 max-h-64 overflow-auto">
                  <div className="mb-2 text-sm">Preview: {previewRows.length} rows — {previewErrorsCount} errors</div>
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-muted/10">
                        <th className="p-2 text-left">#</th>
                        <th className="p-2 text-left">Username</th>
                        <th className="p-2 text-left">Full name</th>
                        <th className="p-2 text-left">Action</th>
                        <th className="p-2 text-left">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, idx) => (
                        <tr key={idx} className={r.errors && r.errors.length ? 'bg-red-50' : ''}>
                          <td className="p-2 align-top">{idx + 1}</td>
                          <td className="p-2 align-top">{r.data.username}</td>
                          <td className="p-2 align-top">{r.data.fullname}</td>
                          <td className="p-2 align-top">{r.action}</td>
                          <td className="p-2 align-top text-xs text-red-600">{(r.errors || []).join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setImportOpen(false); setCsvFile(null); setPreviewRows([]); }}>
                Cancel
              </Button>
              <Button onClick={handleMembersCsvImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Invite Dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New Member</DialogTitle>
              <DialogDescription>
                Send an invitation email to add a new member to the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">Full Name</Label>
                <Input
                  id="invite-name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder=""
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder=""
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="honourable">Honourable</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    {isSuperAdmin && (
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invite
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
    </PermissionGate>
  );
}
