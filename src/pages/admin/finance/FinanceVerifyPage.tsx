import { useState, useEffect } from 'react';
import {
  CheckSquare,
  Check,
  X,
  Loader2,
  Eye,
  AlertCircle,
  Receipt,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FinanceRecord {
  fin_id: number;
  submitted_by: string | null;
  exp_type: 'income' | 'expense';
  party_role: 'payer' | 'payee';
  amount: number;
  txn_date: string | null;
  category: string;
  description: string;
  photo_path: string | null;
  approved: boolean;
  created_at: string;
  submitter_name?: string;
}

export default function FinanceVerifyPage() {
  const { user, isSuperAdmin, isAdmin } = useAdminAuth();
  const [submissions, setSubmissions] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<FinanceRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  
  // Global finance submissions toggle
  const [allowFinanceSubmissions, setAllowFinanceSubmissions] = useState(false);
  const [togglingSubmissions, setTogglingSubmissions] = useState(false);

  useEffect(() => {
    fetchSubmissions();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('allow_finance_submissions')
        .eq('id', 1)
        .single();
      
      setAllowFinanceSubmissions(settings?.allow_finance_submissions ?? false);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const toggleFinanceSubmissions = async () => {
    if (!isSuperAdmin && !isAdmin) {
      toast.error('Only admins can toggle this setting');
      return;
    }

    setTogglingSubmissions(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .update({ allow_finance_submissions: !allowFinanceSubmissions })
        .eq('id', 1)
        .select('allow_finance_submissions')
        .single();

      if (error) throw error;

      setAllowFinanceSubmissions(data?.allow_finance_submissions ?? false);
      toast.success(
        data?.allow_finance_submissions
          ? 'Finance submissions enabled for all members'
          : 'Finance submissions disabled for all members'
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to update setting');
    } finally {
      setTogglingSubmissions(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      // Fetch unapproved finance records that have a submitter (member submissions)
      const { data, error } = await supabase
        .from('finance')
        .select('*')
        .eq('approved', false)
        .not('submitted_by', 'is', null)
        .is('rejection_reason', null) // Only pending, not rejected
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch submitter names from members table
      const submitterIds = [...new Set(data?.map((s) => s.submitted_by).filter(Boolean))];
      const { data: membersData } = await supabase
        .from('members')
        .select('auth_user_id, fullname')
        .in('auth_user_id', submitterIds as string[]);

      const submissionsWithNames = (data || []).map((sub) => ({
        ...sub,
        submitter_name: membersData?.find((m) => m.auth_user_id === sub.submitted_by)?.fullname || 'Unknown',
      }));

      setSubmissions(submissionsWithNames);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to fetch submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (submission: FinanceRecord) => {
    setProcessing(true);
    try {
      // Approve the finance record by setting approved = true
      const { error } = await supabase
        .from('finance')
        .update({
          approved: true,
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        })
        .eq('fin_id', submission.fin_id);

      if (error) throw error;

      toast.success('Submission approved and added to ledger');
      setSubmissions((prev) => prev.filter((s) => s.fin_id !== submission.fin_id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve submission');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSubmission) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('finance')
        .update({
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          rejection_reason: rejectReason,
        })
        .eq('fin_id', selectedSubmission.fin_id);

      if (error) throw error;

      toast.success('Submission rejected');
      setSubmissions((prev) => prev.filter((s) => s.fin_id !== selectedSubmission.fin_id));
      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedSubmission(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject submission');
    } finally {
      setProcessing(false);
    }
  };

  const viewReceipt = async (photoPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('finance-photos')
        .createSignedUrl(photoPath, 300); // 5 min expiry

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      toast.error('Failed to load receipt');
    }
  };

  return (
    <PermissionGate permissionKey="finance" permissionName="Finance Handling">
      <div className="min-h-screen">
        <AdminHeader title="Verify Submissions" breadcrumb="Finance" />

        <div className="p-6 space-y-6">
          {/* Finance Submissions Toggle Card */}
          {(isSuperAdmin || isAdmin) && (
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">Member Finance Submissions</CardTitle>
                      <CardDescription>
                        Allow all members to submit finance records for verification
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {togglingSubmissions ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Switch
                        checked={allowFinanceSubmissions}
                        onCheckedChange={toggleFinanceSubmissions}
                      />
                    )}
                    <Badge
                      className={cn(
                        allowFinanceSubmissions
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      )}
                    >
                      {allowFinanceSubmissions ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Pending Submissions */}
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                Pending Submissions
                {submissions.length > 0 && (
                  <Badge className="ml-2 bg-yellow-500/20 text-yellow-400">
                    {submissions.length} pending
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-12">
                  <Check className="h-12 w-12 mx-auto text-green-400 mb-4" />
                  <p className="text-muted-foreground">All submissions verified!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((sub) => (
                      <TableRow key={sub.fin_id}>
                        <TableCell>
                          <p className="font-medium">{sub.submitter_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(sub.created_at).toLocaleDateString()}
                          </p>
                        </TableCell>
                        <TableCell>
                          {sub.txn_date ? new Date(sub.txn_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              sub.exp_type === 'income'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            )}
                          >
                            {sub.exp_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{sub.category}</TableCell>
                        <TableCell className="max-w-xs truncate" title={sub.description}>{sub.description}</TableCell>
                        <TableCell className="font-medium">
                          Rs. {sub.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {sub.photo_path ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewReceipt(sub.photo_path!)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-400 border-green-400/30 hover:bg-green-500/10"
                              onClick={() => handleApprove(sub)}
                              disabled={processing}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                              onClick={() => {
                                setSelectedSubmission(sub);
                                setRejectDialogOpen(true);
                              }}
                              disabled={processing}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-400" />
                Reject Submission
              </DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this submission. The submitter
                will be notified.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="reject-reason">Rejection Reason *</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter the reason for rejection..."
                className="mt-2"
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectReason('');
                  setSelectedSubmission(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Reject Submission'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}
