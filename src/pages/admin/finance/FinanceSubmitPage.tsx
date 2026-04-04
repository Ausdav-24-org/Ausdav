import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt,
  Upload,
  Loader2,
  Check,
  X,
  Clock,
  FileText,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { compressImageBlob } from '@/lib/imageCompression';


interface FinanceRecord {
  fin_id: number;
  exp_type: 'income' | 'expense';
  party_role: 'payer' | 'payee';
  amount: number;
  txn_date: string | null;
  category: string;
  description: string;
  approved: boolean;
  rejection_reason: string | null;
  created_at: string;
}

export default function FinanceSubmitPage() {
  const { user } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<FinanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [allowFinanceSubmissions, setAllowFinanceSubmissions] = useState<boolean | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [formData, setFormData] = useState({
    exp_type: 'income' as 'income' | 'expense',
    amount: '',
    txn_date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchSubmissions();
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
      setAllowFinanceSubmissions(false);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('finance')
        .select('*')
        .eq('submitted_by', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.category || !formData.amount || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      let photo_path: string | null = null;

      // Upload receipt photo if provided
      if (receiptFile && user) {
        // Compress receipt image before uploading
        const compressedBlob = await compressImageBlob(receiptFile, {
          maxSize: 1200,
          quality: 0.92,
          mimeType: "image/jpeg",
        });

        const compressedSize = compressedBlob.size;
        const originalSize = receiptFile.size;
        const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);

        const fileName = `${user.id}/${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('finance-photos')
          .upload(fileName, compressedBlob, {
            contentType: 'image/jpeg',
          });

        if (uploadError) throw uploadError;
        
        if (savingsPercent > 0) {
          toast.success(`Receipt compressed! (${savingsPercent}% smaller)`);
        }
        
        photo_path = fileName;
      }

      // Determine party_role based on exp_type
      const party_role = formData.exp_type === 'income' ? 'payer' : 'payee';

      const { error } = await supabase.from('finance').insert({
        submitted_by: user?.id,
        exp_type: formData.exp_type,
        party_role: party_role,
        amount: parseFloat(formData.amount),
        txn_date: formData.txn_date,
        category: formData.category,
        description: formData.description,
        photo_path,
        approved: false, // Member submissions are always unapproved initially
      });

      if (error) throw error;

      toast.success('Submission sent for approval');
      setFormData({
        exp_type: 'income',
        amount: '',
        txn_date: new Date().toISOString().split('T')[0],
        category: '',
        description: '',
      });
      setReceiptFile(null);
      fetchSubmissions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (approved: boolean, rejectionReason: string | null) => {
    if (approved) {
      return <Check className="h-4 w-4 text-green-400" />;
    } else if (rejectionReason) {
      return <X className="h-4 w-4 text-red-400" />;
    }
    return <Clock className="h-4 w-4 text-yellow-400" />;
  };

  const getStatusBadge = (approved: boolean, rejectionReason: string | null) => {
    if (approved) {
      return 'bg-green-500/20 text-green-400';
    } else if (rejectionReason) {
      return 'bg-red-500/20 text-red-400';
    }
    return 'bg-yellow-500/20 text-yellow-400';
  };

  const getStatusText = (approved: boolean, rejectionReason: string | null) => {
    if (approved) return 'approved';
    if (rejectionReason) return 'rejected';
    return 'pending';
  };

  // Show loading state while checking settings
  if (loadingSettings) {
    return (
      <div className="min-h-screen">
        <AdminHeader title="Submit Finance" breadcrumb="Finance" />
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!allowFinanceSubmissions) {
    return (
      <div className="min-h-screen">
        <AdminHeader title="Submit Finance" breadcrumb="Finance" />
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full bg-card/50 backdrop-blur-sm border-border">
            <CardContent className="p-8 text-center">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Submissions Closed</h2>
              <p className="text-muted-foreground">
                Finance submissions are currently disabled. Please check back later
                or contact an administrator for more information.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AdminHeader title="Submit Finance" breadcrumb="Finance" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Submission Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  New Submission
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Transaction Type *</Label>
                      <Select
                        value={formData.exp_type}
                        onValueChange={(v) =>
                          setFormData({ ...formData, exp_type: v as any })
                        }
                      >
                        <SelectTrigger className="bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Amount (Rs.) *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        placeholder="0.00"
                        className="bg-background/50"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date *</Label>
                      <Input
                        type="date"
                        value={formData.txn_date}
                        onChange={(e) =>
                          setFormData({ ...formData, txn_date: e.target.value })
                        }
                        className="bg-background/50"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Event *</Label>
                    <Input
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      placeholder="e.g. Pentathlon"
                      className="bg-background/50"
                      required
                    />
                  </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Details about this transaction..."
                      className="bg-background/50"
                      rows={3}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Receipt Image</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setReceiptFile(e.target.files?.[0] || null)
                        }
                        className="bg-background/50"
                      />
                    </div>
                    {receiptFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {receiptFile.name}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Submit for Approval
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Submission History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Your Submissions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No submissions yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.slice(0, 10).map((sub) => (
                        <TableRow key={sub.fin_id}>
                          <TableCell className="text-sm">
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
                          <TableCell className="font-medium">
                            Rs. {sub.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(sub.approved, sub.rejection_reason)}
                              <Badge className={cn('capitalize', getStatusBadge(sub.approved, sub.rejection_reason))}>
                                {getStatusText(sub.approved, sub.rejection_reason)}
                              </Badge>
                            </div>
                            {sub.rejection_reason && (
                              <p className="text-xs text-red-400 mt-1">
                                {sub.rejection_reason}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
