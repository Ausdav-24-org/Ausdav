import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Plus, Pencil, Trash2, FileText, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PastPaper {
  pp_id: number;
  yrs: number;
  subject: string;
  exam_paper_bucket?: string;
  exam_paper_path: string | null;
  scheme_bucket?: string;
  scheme_path: string | null;
  created_at: string;
  updated_at: string;
}

const SUBJECT_OPTIONS = ['Physics', 'Mathematics', 'Biology', 'Chemistry'] as const;

export default function AdminPastPaperPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPastPaper, setEditingPastPaper] = useState<PastPaper | null>(null);
  const [formData, setFormData] = useState({
    yrs: new Date().getFullYear(),
    subject: '',
  });
  const [examPaperFile, setExamPaperFile] = useState<File | null>(null);
  const [schemeFile, setSchemeFile] = useState<File | null>(null);
  const { role, isAdmin, isSuperAdmin } = useAdminAuth();
  const canDelete = isAdmin || isSuperAdmin;

  const queryClient = useQueryClient();

  // Fetch past papers
  const { data: pastPapers, isLoading } = useQuery({
    queryKey: ['past-papers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('past_papers')
        .select('*')
        .order('yrs', { ascending: false });

      if (error) throw error;
      return data as PastPaper[];
    },
  });

  // Create past paper mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { examPaperFile?: File; schemeFile?: File }) => {
      let examPaperPath = null;
      let schemePath = null;

      // Upload exam paper if provided
      if (data.examPaperFile) {
        const fileExt = data.examPaperFile.name.split('.').pop();
        const fileName = `${data.yrs}_${data.subject}_exam_paper.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('exam-papers')
          .upload(fileName, data.examPaperFile);

        if (uploadError) throw uploadError;
        examPaperPath = uploadData.path;
      }

      // Upload scheme if provided
      if (data.schemeFile) {
        const fileExt = data.schemeFile.name.split('.').pop();
        const fileName = `${data.yrs}_${data.subject}_scheme.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('schemes')
          .upload(fileName, data.schemeFile);

        if (uploadError) throw uploadError;
        schemePath = uploadData.path;
      }

      // Create database record
      const { data: result, error } = await supabase
        .from('past_papers')
        .insert({
          yrs: data.yrs,
          subject: data.subject,
          exam_paper_path: examPaperPath,
          scheme_path: schemePath,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['past-papers'] });
      toast.success('Past paper created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create past paper: ' + error.message);
    },
  });

  // Update past paper mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number } & typeof formData & { examPaperFile?: File; schemeFile?: File }) => {
      let examPaperPath = editingPastPaper?.exam_paper_path;
      let schemePath = editingPastPaper?.scheme_path;

      // Upload new exam paper if provided
      if (data.examPaperFile) {
        const fileExt = data.examPaperFile.name.split('.').pop();
        const fileName = `${data.yrs}_${data.subject}_exam_paper.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('exam-papers')
          .upload(fileName, data.examPaperFile, { upsert: true });

        if (uploadError) throw uploadError;
        examPaperPath = uploadData.path;
      }

      // Upload new scheme if provided
      if (data.schemeFile) {
        const fileExt = data.schemeFile.name.split('.').pop();
        const fileName = `${data.yrs}_${data.subject}_scheme.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('schemes')
          .upload(fileName, data.schemeFile, { upsert: true });

        if (uploadError) throw uploadError;
        schemePath = uploadData.path;
      }

      // Update database record
      const { data: result, error } = await supabase
        .from('past_papers')
        .update({
          yrs: data.yrs,
          subject: data.subject,
          exam_paper_path: examPaperPath,
          scheme_path: schemePath,
        })
        .eq('pp_id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['past-papers'] });
      toast.success('Past paper updated successfully');
      setEditingPastPaper(null);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update past paper: ' + error.message);
    },
  });

  // Delete past paper mutation
  const deleteMutation = useMutation({
    mutationFn: async (pastPaper: PastPaper) => {
      // Delete files from storage
      if (pastPaper.exam_paper_path) {
        await supabase.storage.from('exam-papers').remove([pastPaper.exam_paper_path]);
      }
      if (pastPaper.scheme_path) {
        await supabase.storage.from('schemes').remove([pastPaper.scheme_path]);
      }

      // Delete database record
      const { error } = await supabase
        .from('past_papers')
        .delete()
        .eq('pp_id', pastPaper.pp_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['past-papers'] });
      toast.success('Past paper deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete past paper: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      yrs: new Date().getFullYear(),
      subject: '',
    });
    setExamPaperFile(null);
    setSchemeFile(null);
  };

  const handleCreate = () => {
    createMutation.mutate({ ...formData, examPaperFile, schemeFile });
  };

  const handleUpdate = () => {
    if (!editingPastPaper) {
      toast.error('Please select a past paper to update');
      return;
    }
    updateMutation.mutate({ id: editingPastPaper.pp_id, ...formData, examPaperFile, schemeFile });
  };

  const handleEdit = (pastPaper: PastPaper) => {
    const subject =
      SUBJECT_OPTIONS.includes(pastPaper.subject as (typeof SUBJECT_OPTIONS)[number])
        ? pastPaper.subject
        : '';
    setEditingPastPaper(pastPaper);
    setFormData({
      yrs: pastPaper.yrs,
      subject,
    });
  };

  const handleDelete = (pastPaper: PastPaper) => {
    if (confirm('Are you sure you want to delete this past paper? This action cannot be undone.')) {
      deleteMutation.mutate(pastPaper);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <PermissionGate permissionKey="exam" permissionName="Past Paper Handling">
      <div className="p-6 space-y-6">
        <AdminHeader title="Past Paper Management" breadcrumb="Admin / Past Paper Management" />
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Past Paper Management</h1>
          <p className="text-muted-foreground">Manage past papers and schemes</p>
        </div>
        <Dialog open={isCreateDialogOpen || !!editingPastPaper} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingPastPaper(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Past Paper
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingPastPaper ? 'Edit Past Paper' : 'Add New Past Paper'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.yrs}
                  onChange={(e) => setFormData(prev => ({ ...prev, yrs: parseInt(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Select
                  value={formData.subject}
                  onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, subject: value }))
                  }
                >
                  <SelectTrigger id="subject">
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="exam-paper">Exam Paper (PDF)</Label>
                <Input
                  id="exam-paper"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setExamPaperFile(e.target.files?.[0] || null)}
                />
              </div>
              <div>
                <Label htmlFor="scheme">Scheme (PDF)</Label>
                <Input
                  id="scheme"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSchemeFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={editingPastPaper ? handleUpdate : handleCreate}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {editingPastPaper ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Past Papers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Exam Paper</TableHead>
                <TableHead>Scheme</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastPapers?.map((pastPaper) => (
                <TableRow key={pastPaper.pp_id}>
                  <TableCell>{pastPaper.yrs}</TableCell>
                  <TableCell>{pastPaper.subject}</TableCell>
                  <TableCell>
                    {pastPaper.exam_paper_path ? (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={supabase.storage.from('exam-papers').getPublicUrl(pastPaper.exam_paper_path).data.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">No file</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pastPaper.scheme_path ? (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={supabase.storage.from('schemes').getPublicUrl(pastPaper.scheme_path).data.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">No file</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(pastPaper)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(pastPaper)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </PermissionGate>
  );
}
