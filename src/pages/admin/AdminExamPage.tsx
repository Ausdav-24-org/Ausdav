import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { AdminHeader } from '@/components/admin/AdminHeader';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, FileText, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { compressPDFBlob, getPDFCompressionDetails } from '@/lib/pdfCompression';

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

const SUBJECTS = [
  'Combined Mathematics',
  'Biology',
  'Physics',
  'Chemistry',
];

export default function AdminExamPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<PastPaper | null>(null);
  const [formData, setFormData] = useState({
    yrs: new Date().getFullYear(),
    subject: '',
  });
  const [examPaperFile, setExamPaperFile] = useState<File | null>(null);
  const [schemeFile, setSchemeFile] = useState<File | null>(null);

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
        const fileName = `${data.yrs}_${data.subject.replace(/\s+/g, '_')}_exam_paper.${fileExt}`;
        
        // Compress PDF before upload
        const compressedBlob = await compressPDFBlob(data.examPaperFile, { quality: 'high' });
        const originalSize = data.examPaperFile.size;
        const compressedSize = compressedBlob.size;
        const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('exam-papers')
          .upload(fileName, compressedBlob);

        if (uploadError) throw uploadError;
        examPaperPath = uploadData.path;
        
        // Show compression feedback
        if (savingsPercent > 0) {
          toast.success(`Exam paper compressed! (${savingsPercent}% smaller)`);
        }
      }

      // Upload scheme if provided
      if (data.schemeFile) {
        const fileExt = data.schemeFile.name.split('.').pop();
        const fileName = `${data.yrs}_${data.subject.replace(/\s+/g, '_')}_scheme.${fileExt}`;
        
        // Compress PDF before upload
        const compressedBlob = await compressPDFBlob(data.schemeFile, { quality: 'high' });
        const originalSize = data.schemeFile.size;
        const compressedSize = compressedBlob.size;
        const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('schemes')
          .upload(fileName, compressedBlob);

        if (uploadError) throw uploadError;
        schemePath = uploadData.path;
        
        // Show compression feedback
        if (savingsPercent > 0) {
          toast.success(`Marking scheme compressed! (${savingsPercent}% smaller)`);
        }
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
      let examPaperPath = editingPaper?.exam_paper_path;
      let schemePath = editingPaper?.scheme_path;

      // Upload new exam paper if provided
      if (data.examPaperFile) {
        const fileExt = data.examPaperFile.name.split('.').pop();
        const fileName = `${data.yrs}_${data.subject.replace(/\s+/g, '_')}_exam_paper.${fileExt}`;
        
        // Compress PDF before upload
        const compressedBlob = await compressPDFBlob(data.examPaperFile, { quality: 'high' });
        const originalSize = data.examPaperFile.size;
        const compressedSize = compressedBlob.size;
        const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('exam-papers')
          .upload(fileName, compressedBlob, { upsert: true });

        if (uploadError) throw uploadError;
        examPaperPath = uploadData.path;
        
        // Show compression feedback
        if (savingsPercent > 0) {
          toast.success(`Exam paper compressed! (${savingsPercent}% smaller)`);
        }
      }

      // Upload new scheme if provided
      if (data.schemeFile) {
        const fileExt = data.schemeFile.name.split('.').pop();
        const fileName = `${data.yrs}_${data.subject.replace(/\s+/g, '_')}_scheme.${fileExt}`;
        
        // Compress PDF before upload
        const compressedBlob = await compressPDFBlob(data.schemeFile, { quality: 'high' });
        const originalSize = data.schemeFile.size;
        const compressedSize = compressedBlob.size;
        const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('schemes')
          .upload(fileName, compressedBlob, { upsert: true });

        if (uploadError) throw uploadError;
        schemePath = uploadData.path;
        
        // Show compression feedback
        if (savingsPercent > 0) {
          toast.success(`Marking scheme compressed! (${savingsPercent}% smaller)`);
        }
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
      setEditingPaper(null);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update past paper: ' + error.message);
    },
  });

  // Delete past paper mutation
  const deleteMutation = useMutation({
    mutationFn: async (paper: PastPaper) => {
      // Delete files from storage
      if (paper.exam_paper_path) {
        await supabase.storage.from('exam-papers').remove([paper.exam_paper_path]);
      }
      if (paper.scheme_path) {
        await supabase.storage.from('schemes').remove([paper.scheme_path]);
      }

      // Delete database record
      const { error } = await supabase
        .from('past_papers')
        .delete()
        .eq('pp_id', paper.pp_id);

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
    if (!formData.subject) {
      toast.error('Please select a subject');
      return;
    }
    createMutation.mutate({ ...formData, examPaperFile, schemeFile });
  };

  const handleUpdate = () => {
    if (!editingPaper || !formData.subject) {
      toast.error('Please select a subject');
      return;
    }
    updateMutation.mutate({ id: editingPaper.pp_id, ...formData, examPaperFile, schemeFile });
  };

  const handleEdit = (paper: PastPaper) => {
    setEditingPaper(paper);
    setFormData({
      yrs: paper.yrs,
      subject: paper.subject,
    });
  };

  const handleDelete = (paper: PastPaper) => {
    if (confirm('Are you sure you want to delete this past paper? This action cannot be undone.')) {
      deleteMutation.mutate(paper);
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
    <PermissionGate permissionKey="exam" permissionName="Exam Handling">
      <div className="p-6 space-y-6">
        <AdminHeader title="Exam Management" breadcrumb="Admin / Exam Management" />
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Exam Management</h1>
          <p className="text-muted-foreground">Manage past papers, exam papers, and marking schemes</p>
        </div>
        <Dialog open={isCreateDialogOpen || !!editingPaper} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingPaper(null);
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
              <DialogTitle>{editingPaper ? 'Edit Past Paper' : 'Add New Past Paper'}</DialogTitle>
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
                <Select value={formData.subject} onValueChange={(value) => setFormData(prev => ({ ...prev, subject: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
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
                <Label htmlFor="scheme">Marking Scheme (PDF)</Label>
                <Input
                  id="scheme"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSchemeFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={editingPaper ? handleUpdate : handleCreate}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {editingPaper ? 'Update' : 'Create'}
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
              {pastPapers?.map((paper) => (
                <TableRow key={paper.pp_id}>
                  <TableCell>{paper.yrs}</TableCell>
                  <TableCell>{paper.subject}</TableCell>
                  <TableCell>
                    {paper.exam_paper_path ? (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={supabase.storage.from('exam-papers').getPublicUrl(paper.exam_paper_path).data.publicUrl}
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
                    {paper.scheme_path ? (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={supabase.storage.from('schemes').getPublicUrl(paper.scheme_path).data.publicUrl}
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
                        onClick={() => handleEdit(paper)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(paper)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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