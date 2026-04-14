import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Loader2,
  AlertTriangle,
  Inbox,
  Check,
  X,
  Users,
  UserPlus,
  CalendarDays,
  GraduationCap,
  BookOpen,
  DollarSign,
  Megaphone,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { invokeFunction } from '@/integrations/supabase/functions';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { usePermissionRequests, PermissionRequest, AdminWithPermissions } from '@/hooks/usePermissionRequests';
import { useAdminRefresh } from '@/hooks/useAdminRefresh';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Permission items configuration
const permissionConfig: Record<string, { title: string; icon: React.ElementType; color: string }> = {
  member: { title: 'Member Handling', icon: Users, color: 'from-blue-500 to-cyan-500' },
  applicant: { title: 'Applicant Handling', icon: UserPlus, color: 'from-emerald-500 to-teal-500' },
  events: { title: 'Event Handling', icon: CalendarDays, color: 'from-purple-500 to-pink-500' },
  exam: { title: 'Exam Handling', icon: GraduationCap, color: 'from-orange-500 to-amber-500' },
  seminar: { title: 'Seminar Handling', icon: BookOpen, color: 'from-rose-500 to-red-500' },
  finance: { title: 'Finance Handling', icon: DollarSign, color: 'from-green-500 to-emerald-500' },
  announcement: { title: 'Announcement Handling', icon: Megaphone, color: 'from-indigo-500 to-violet-500' },
  feedback: { title: 'Feedback Handling', icon: Megaphone, color: 'from-emerald-500 to-green-500' },
  quiz: { title: 'Quiz Handling', icon: GraduationCap, color: 'from-cyan-500 to-blue-500' },
  results: { title: 'Results Handling', icon: TrendingUp, color: 'from-sky-500 to-indigo-500' },
};

const allPermissionKeys = Object.keys(permissionConfig);
// Keys used in the admins overview table (keep results out of admin-wide toggles)
const adminPermissionKeys = allPermissionKeys.filter(k => k !== 'results');

const AdminPermissionsPage: React.FC = () => {
  const { isSuperAdmin } = useAdminAuth();
  const { permissions, loading: permissionsLoading, togglePermission } = useAdminPermissions();
  const {
    requests,
    adminsWithPermissions,
    loading: requestsLoading,
    approveRequest,
    rejectRequest,
    grantPermission,
    revokePermission,
    refresh,
  } = usePermissionRequests();

  useAdminRefresh(() => {
    try {
      refresh();
      fetchMembersAndPermissions();
    } catch (e) {
      // ignore
    }
  });

  // Fetch members and their granted permissions for keys 'quiz', 'events', 'seminar' and 'exam'
  async function fetchMembersAndPermissions() {
    setMembersLoading(true);
    try {
      const { data, error } = await invokeFunction('fetch-members', {});
      if (error) throw error;
      const raw: any[] = (data?.members || []) as any[];
      // Only include members with role === 'member' (exclude 'honourable' etc.)
      const filteredRaw = raw.filter(r => r.role === 'member');
      const rows: MemberRow[] = filteredRaw.map((r) => ({
        mem_id: r.mem_id,
        auth_user_id: r.auth_user_id || null,
        fullname: r.fullname || r.full_name || r.name || '',
        username: r.username || r.user_name || '',
      }));
      setMembersList(rows);

      const authIds = rows.map(r => r.auth_user_id).filter(Boolean) as string[];
      if (authIds.length === 0) {
        setMemberPermMap({});
        return;
      }

      const { data: perms, error: permsErr } = await supabase
        .from('admin_granted_permissions')
        .select('admin_id,permission_key')
        .in('admin_id', authIds)
        .in('permission_key', ['applicant','quiz', 'events', 'seminar', 'exam'])
        .eq('is_active', true);

      if (permsErr) throw permsErr;

      const map: Record<string, string[]> = {};
      (perms || []).forEach((p: any) => {
        map[p.admin_id] = map[p.admin_id] || [];
        map[p.admin_id].push(p.permission_key);
      });
      setMemberPermMap(map);
    } catch (err) {
      console.error('Failed to load members permissions', err);
      setMembersList([]);
      setMemberPermMap({});
    } finally {
      setMembersLoading(false);
    }
  }

  // Load on mount
  useEffect(() => { fetchMembersAndPermissions(); }, []);

  const [reviewingRequest, setReviewingRequest] = useState<PermissionRequest | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [requestsExpanded, setRequestsExpanded] = useState(true);
  const [selectedAdminForGrant, setSelectedAdminForGrant] = useState<AdminWithPermissions | null>(null);
  const [selectedPermissionToGrant, setSelectedPermissionToGrant] = useState<string>('');

  // --- Members permission review state (only show Quiz & Event columns) ---
  type MemberRow = { mem_id: number; auth_user_id: string | null; fullname: string; username: string };
  const [membersList, setMembersList] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [memberPermMap, setMemberPermMap] = useState<Record<string, string[]>>({});

  const loading = permissionsLoading || requestsLoading || membersLoading;

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <AdminHeader title="Permission Management" breadcrumb="Settings / Permissions" />
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <ShieldX className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">
            Only Super Administrators can manage permissions.
          </p>
        </div>
      </div>
    );
  }

  const handleToggle = async (permissionKey: string, currentValue: boolean) => {
    const success = await togglePermission(permissionKey, !currentValue);
    if (success) {
      toast.success(`Permission ${!currentValue ? 'enabled' : 'disabled'} successfully`);
    } else {
      toast.error('Failed to update permission');
    }
  };

  const handleReviewRequest = (request: PermissionRequest, action: 'approve' | 'reject') => {
    setReviewingRequest(request);
    setReviewAction(action);
    setReviewNote('');
  };

  const handleConfirmReview = async () => {
    if (!reviewingRequest || !reviewAction) return;

    setProcessing(true);

    const result = reviewAction === 'approve'
      ? await approveRequest(reviewingRequest.id, reviewNote)
      : await rejectRequest(reviewingRequest.id, reviewNote);

    if (result.success) {
      toast.success(`Permission request ${reviewAction === 'approve' ? 'approved' : 'rejected'} successfully`);
      setReviewingRequest(null);
      setReviewAction(null);
      setReviewNote('');
    } else {
      toast.error(result.error || `Failed to ${reviewAction} request`);
    }

    setProcessing(false);
  };

  const handleGrantPermission = async (adminId: string, permissionKey: string) => {
    const result = await grantPermission(adminId, permissionKey);
    if (result.success) {
      toast.success('Permission granted successfully');
      setSelectedAdminForGrant(null);
      setSelectedPermissionToGrant('');
    } else {
      toast.error(result.error || 'Failed to grant permission');
    }
  };

  const handleRevokePermission = async (adminId: string, permissionKey: string) => {
    const result = await revokePermission(adminId, permissionKey);
    if (result.success) {
      toast.success('Permission revoked successfully');
    } else {
      toast.error(result.error || 'Failed to revoke permission');
    }
  };

  const getPermissionIcon = (key: string) => {
    const icons: Record<string, string> = {
      finance_approval: '💰',
      member_management: '👥',
      announcements: '📢',
      feedback: '📢',
      events_management: '📅',
      exam_management: '📝',
      seminar_management: '🎓',
    };
    return icons[key] || '⚙️';
  };

  const getPermissionConfig = (key: string) => {
    return permissionConfig[key] || { title: key, icon: Shield, color: 'from-gray-500 to-gray-600' };
  };

  return (
    <div className="p-6 space-y-6">
      <AdminHeader title="Permission Management" breadcrumb="Settings / Permissions" />
      
      {/* Info Banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-4 p-4">
          <AlertTriangle className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium">Admin Permission Control</p>
            <p className="text-sm text-muted-foreground">
              Manage permission requests from admins and directly grant or revoke permissions.
              Super Admins always have full access regardless of these settings.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Permission Requests Box */}
          <Card className={cn(
            'border-2 transition-colors',
            requests.length > 0 ? 'border-amber-500/50' : 'border-border'
          )}>
            <Collapsible open={requestsExpanded} onOpenChange={setRequestsExpanded}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-lg',
                        requests.length > 0 ? 'bg-amber-500/20' : 'bg-muted'
                      )}>
                        <Inbox className={cn(
                          'w-5 h-5',
                          requests.length > 0 ? 'text-amber-500' : 'text-muted-foreground'
                        )} />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Permission Requests
                          {requests.length > 0 && (
                            <Badge className="bg-amber-500 text-white">
                              {requests.length} pending
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          Review and process permission requests from admins
                        </CardDescription>
                      </div>
                    </div>
                    {requestsExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {requests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No pending permission requests</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {requests.map((request) => {
                        const config = getPermissionConfig(request.permission_key);
                        const Icon = config.icon;
                        return (
                          <motion.div
                            key={request.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1">
                                <div className={cn(
                                  'p-2 rounded-lg bg-gradient-to-br text-white',
                                  config.color
                                )}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium">{request.admin_name}</span>
                                    <span className="text-xs text-muted-foreground">@{request.admin_username}</span>
                                  </div>
                                  <p className="text-sm font-medium text-primary mb-1">
                                    Requesting: {config.title}
                                  </p>
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {request.reason}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    {new Date(request.created_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-500 border-green-500/50 hover:bg-green-500/10"
                                  onClick={() => handleReviewRequest(request, 'approve')}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-500 border-red-500/50 hover:bg-red-500/10"
                                  onClick={() => handleReviewRequest(request, 'reject')}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Review Dialog */}
          <Dialog open={!!reviewingRequest} onOpenChange={() => setReviewingRequest(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {reviewAction === 'approve' ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <X className="w-5 h-5 text-red-500" />
                  )}
                  {reviewAction === 'approve' ? 'Approve' : 'Reject'} Permission Request
                </DialogTitle>
                <DialogDescription>
                  {reviewingRequest && (
                    <>
                      <strong>{reviewingRequest.admin_name}</strong> is requesting access to{' '}
                      <strong>{getPermissionConfig(reviewingRequest.permission_key).title}</strong>
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Note (optional)</label>
                  <Textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder={reviewAction === 'approve' 
                      ? "Add a note for the admin..."
                      : "Provide a reason for rejection..."
                    }
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewingRequest(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmReview}
                  disabled={processing}
                  className={reviewAction === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {reviewAction === 'approve' ? 'Approve' : 'Reject'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Admin Permissions Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Admin Permissions Overview
              </CardTitle>
              <CardDescription>
                View and manage permissions for all admins. Click to grant or revoke permissions directly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {adminsWithPermissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No admins found</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-auto max-h-80 scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 sticky top-0 z-10">
                        <TableHead className="w-[200px]">Admin</TableHead>
                        {allPermissionKeys.map((key) => {
                          const config = getPermissionConfig(key);
                          const Icon = config.icon;
                          return (
                            <TableHead key={key} className="text-center w-[100px]">
                              <div className="flex flex-col items-center gap-1">
                                <Icon className="w-4 h-4" />
                                <span className="text-xs">{config.title.split(' ')[0]}</span>
                              </div>
                            </TableHead>
                          );
                        })}
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminsWithPermissions.map((admin) => (
                        <TableRow key={admin.auth_user_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{admin.fullname}</p>
                              <p className="text-xs text-muted-foreground">@{admin.username}</p>
                            </div>
                          </TableCell>
                          {allPermissionKeys.map((key) => {
                            const hasPermission = admin.permissions.includes(key);
                            return (
                              <TableCell key={key} className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    'h-8 w-8 rounded-full transition-colors',
                                    hasPermission
                                      ? 'bg-green-500/20 text-green-500 hover:bg-red-500/20 hover:text-red-500'
                                      : 'bg-muted text-muted-foreground hover:bg-green-500/20 hover:text-green-500'
                                  )}
                                  onClick={() => 
                                    hasPermission
                                      ? handleRevokePermission(admin.auth_user_id, key)
                                      : handleGrantPermission(admin.auth_user_id, key)
                                  }
                                  title={hasPermission ? 'Click to revoke' : 'Click to grant'}
                                >
                                  {hasPermission ? (
                                    <ShieldCheck className="w-4 h-4" />
                                  ) : (
                                    <ShieldX className="w-4 h-4" />
                                  )}
                                </Button>
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {admin.permissions.length}/{allPermissionKeys.length}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Members Permission Review (only Quiz + Event + Actions) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Members Permission Review
              </CardTitle>
              <CardDescription>
                Review and grant/revoke the <strong>Applicants</strong>, <strong>Quiz</strong>, <strong>Event</strong>, <strong>Seminar</strong> and <strong>Past Paper</strong> permissions for members.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                </div>
              ) : membersList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No members found</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-auto max-h-80 scrollbar-thin">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 sticky top-0 z-10">
                        <TableHead className="w-[240px]">Member</TableHead>

                        <TableHead className="text-center w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <UserPlus className="w-4 h-4" />
                            <span className="text-xs">Applicants</span>
                          </div>
                        </TableHead>

                        <TableHead className="text-center w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <CalendarDays className="w-4 h-4" />
                            <span className="text-xs">Event</span>
                          </div>
                        </TableHead>
                        <TableHead className="text-center w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <GraduationCap className="w-4 h-4" />
                            <span className="text-xs">Quiz</span>
                          </div>
                        </TableHead>
                        <TableHead className="text-center w-[100px]">
                          <div className="flex flex-col items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            <span className="text-xs">Seminar</span>
                          </div>
                        </TableHead>
                        <TableHead className="text-center w-[120px]">
                          <div className="flex flex-col items-center gap-1">
                            <FileText className="w-4 h-4" />
                            <span className="text-xs">Past Papers</span>
                          </div>
                        </TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membersList.map((m) => {
                        const key = m.auth_user_id || `no-id-${m.mem_id}`;
                        const perms = (m.auth_user_id && memberPermMap[m.auth_user_id]) || [];
                        const hasApplicant = perms.includes('applicant');
                        const hasEvent = perms.includes('events');
                        const hasQuiz = perms.includes('quiz');
                        const hasSeminar = perms.includes('seminar');
                        const hasExam = perms.includes('exam');

                        const handleMemberToggle = async (permKey: string, current: boolean) => {
                          if (!m.auth_user_id) {
                            toast.error('Member has no linked auth account');
                            return;
                          }
                          if (current) {
                            await handleRevokePermission(m.auth_user_id, permKey);
                          } else {
                            await handleGrantPermission(m.auth_user_id, permKey);
                          }
                          // refresh member permission map after action
                          fetchMembersAndPermissions();
                        };

                        return (
                          <TableRow key={key}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{m.fullname}</p>
                                <p className="text-xs text-muted-foreground">@{m.username}</p>
                              </div>
                            </TableCell>

                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMemberToggle('applicant', hasApplicant)}
                                className={cn(
                                  'h-8 w-8 rounded-full transition-colors',
                                  hasApplicant
                                    ? 'bg-green-500/20 text-green-500 hover:bg-red-500/20 hover:text-red-500'
                                    : 'bg-muted text-muted-foreground hover:bg-green-500/20 hover:text-green-500'
                                )}
                                disabled={!m.auth_user_id}
                                title={!m.auth_user_id ? 'Member has no auth account' : hasApplicant ? 'Click to revoke' : 'Click to grant'}
                              >
                                {hasApplicant ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                              </Button>
                            </TableCell>



                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMemberToggle('events', hasEvent)}
                                className={cn(
                                  'h-8 w-8 rounded-full transition-colors',
                                  hasEvent
                                    ? 'bg-green-500/20 text-green-500 hover:bg-red-500/20 hover:text-red-500'
                                    : 'bg-muted text-muted-foreground hover:bg-green-500/20 hover:text-green-500'
                                )}
                                disabled={!m.auth_user_id}
                                title={!m.auth_user_id ? 'Member has no auth account' : hasEvent ? 'Click to revoke' : 'Click to grant'}
                              >
                                {hasEvent ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                              </Button>
                            </TableCell>

                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMemberToggle('quiz', hasQuiz)}
                                className={cn(
                                  'h-8 w-8 rounded-full transition-colors',
                                  hasQuiz
                                    ? 'bg-green-500/20 text-green-500 hover:bg-red-500/20 hover:text-red-500'
                                    : 'bg-muted text-muted-foreground hover:bg-green-500/20 hover:text-green-500'
                                )}
                                disabled={!m.auth_user_id}
                                title={!m.auth_user_id ? 'Member has no auth account' : hasQuiz ? 'Click to revoke' : 'Click to grant'}
                              >
                                {hasQuiz ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                              </Button>
                            </TableCell>

                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMemberToggle('seminar', hasSeminar)}
                                className={cn(
                                  'h-8 w-8 rounded-full transition-colors',
                                  hasSeminar
                                    ? 'bg-green-500/20 text-green-500 hover:bg-red-500/20 hover:text-red-500'
                                    : 'bg-muted text-muted-foreground hover:bg-green-500/20 hover:text-green-500'
                                )}
                                disabled={!m.auth_user_id}
                                title={!m.auth_user_id ? 'Member has no auth account' : hasSeminar ? 'Click to revoke' : 'Click to grant'}
                              >
                                {hasSeminar ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                              </Button>
                            </TableCell>

                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleMemberToggle('exam', hasExam)}
                                className={cn(
                                  'h-8 w-8 rounded-full transition-colors',
                                  hasExam
                                    ? 'bg-green-500/20 text-green-500 hover:bg-red-500/20 hover:text-red-500'
                                    : 'bg-muted text-muted-foreground hover:bg-green-500/20 hover:text-green-500'
                                )}
                                disabled={!m.auth_user_id}
                                title={!m.auth_user_id ? 'Member has no auth account' : hasExam ? 'Click to revoke' : 'Click to grant'}
                              >
                                {hasExam ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                              </Button>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {(hasApplicant ? 1 : 0) + (hasEvent ? 1 : 0) + (hasQuiz ? 1 : 0) + (hasSeminar ? 1 : 0) + (hasExam ? 1 : 0)}/5
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Global Permission Toggles (Original functionality) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Global Permission Settings
              </CardTitle>
              <CardDescription>
                Enable or disable permission categories globally for all admin users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {permissions.map((permission, index) => (
                  <motion.div
                    key={permission.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className={cn(
                      'p-4 rounded-lg border transition-colors',
                      permission.is_enabled ? 'border-green-500/30' : 'border-border/50'
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getPermissionIcon(permission.permission_key)}</span>
                          <div>
                            <p className="font-medium text-sm">{permission.display_name}</p>
                            <p className="text-xs text-muted-foreground">{permission.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={permission.is_enabled}
                          onCheckedChange={() => handleToggle(permission.permission_key, permission.is_enabled)}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Permission Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-amber-500/10">
                  <p className="text-2xl font-bold text-amber-500">
                    {requests.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending Requests</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-500/10">
                  <p className="text-2xl font-bold text-blue-500">
                    {adminsWithPermissions.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Admins</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-500/10">
                  <p className="text-2xl font-bold text-green-500">
                    {permissions.filter(p => p.is_enabled).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Enabled Globally</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted">
                  <p className="text-2xl font-bold text-muted-foreground">
                    {permissions.filter(p => !p.is_enabled).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Disabled Globally</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminPermissionsPage;
