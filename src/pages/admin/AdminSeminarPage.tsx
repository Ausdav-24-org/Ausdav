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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, FileText, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { compressPDFBlob } from '@/lib/pdfCompression';

interface Seminar {
  sem_id: number;
  yrs: number;
  seminar_paper_bucket: string;
  seminar_paper_path: string | null;
  answers_bucket: string;
  answers_path: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminSeminarPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSeminar, setEditingSeminar] = useState<Seminar | null>(null);
  const [formData, setFormData] = useState({
    yrs: new Date().getFullYear(),
  });
  const [seminarPaperFile, setSeminarPaperFile] = useState<File | null>(null);
  const [answersFile, setAnswersFile] = useState<File | null>(null);
  const { role, isAdmin, isSuperAdmin } = useAdminAuth();
  const canDelete = isAdmin || isSuperAdmin;

  const queryClient = useQueryClient();

  // Fetch seminars
  const { data: seminars, isLoading } = useQuery({
    queryKey: ['seminars'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seminars')
        .select('*')
        .order('yrs', { ascending: false });

      if (error) throw error;
      return data as Seminar[];
    },
  });

  // Create seminar mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { seminarPaperFile?: File; answersFile?: File }) => {
      let seminarPaperPath = null;
      let answersPath = null;

      // Upload seminar paper if provided
      if (data.seminarPaperFile) {
        const fileExt = data.seminarPaperFile.name.split('.').pop();
        const fileName = `${data.yrs}_seminar_paper.${fileExt}`;
        
        // Compress PDF before upload
        const compressedBlob = await compressPDFBlob(data.seminarPaperFile, { quality: 'high' });
        const originalSize = data.seminarPaperFile.size;
        const compressedSize = compressedBlob.size;
        const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('seminar-papers')
          .upload(fileName, compressedBlob);

        if (uploadError) throw uploadError;
        seminarPaperPath = uploadData.path;
        
        // Show compression feedback
        if (savingsPercent > 0) {
          toast.success(`Seminar paper compressed! (${savingsPercent}% smaller)`);
        }
      }

      // Upload answers if provided
      if (data.answersFile) {
        const fileExt = data.answersFile.name.split('.').pop();
        const fileName = `${data.yrs}_answers.${fileExt}`;
        
        // Compress PDF before upload
        const compressedBlob = await compressPDFBlob(data.answersFile, { quality: 'high' });
        const originalSize = data.answersFile.size;
        const compressedSize = compressedBlob.size;
        const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('answers')
          .upload(fileName, compressedBlob);

        if (uploadError) throw uploadError;
        answersPath = uploadData.path;
        
        // Show compression feedback
        if (savingsPercent > 0) {
          toast.success(`Answers compressed! (${savingsPercent}% smaller)`);
        }
      }

      // Create database record
      const { data: result, error } = await supabase
        .from('seminars')
        .insert({
          yrs: data.yrs,
          seminar_paper_path: seminarPaperPath,
          answers_path: answersPath,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seminars'] });
      toast.success('Seminar created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create seminar: ' + error.message);
    },
  });

  // Update seminar mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number } & typeof formData & { seminarPaperFile?: File; answersFile?: File }) => {
      let seminarPaperPath = editingSeminar?.seminar_paper_path;
      let answersPath = editingSeminar?.answers_path;

      // Upload new seminar paper if provided
      if (data.seminarPaperFile) {
        const fileExt = data.seminarPaperFile.name.split('.').pop();
        const fileName = `${data.yrs}_seminar_paper.${fileExt}`;
        
        // Compress PDF before upload
        const compressedBlob = await compressPDFBlob(data.seminarPaperFile, { quality: 'high' });
        const originalSize = data.seminarPaperFile.size;
        const compressedSize = compressedBlob.size;
        const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('seminar-papers')
          .upload(fileName, compressedBlob, { upsert: true });

        if (uploadError) throw uploadError;
        seminarPaperPath = uploadData.path;
        
        // Show compression feedback
        if (savingsPercent > 0) {
          toast.success(`Seminar paper compressed! (${savingsPercent}% smaller)`);
        }
      }

      // Upload new answers if provided
      if (data.answersFile) {
        const fileExt = data.answersFile.name.split('.').pop();
        const fileName = `${data.yrs}_answers.${fileExt}`;
        
        // Compress PDF before upload
        const compressedBlob = await compressPDFBlob(data.answersFile, { quality: 'high' });
        const originalSize = data.answersFile.size;
        const compressedSize = compressedBlob.size;
        const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('answers')
          .upload(fileName, compressedBlob, { upsert: true });

        if (uploadError) throw uploadError;
        answersPath = uploadData.path;
        
        // Show compression feedback
        if (savingsPercent > 0) {
          toast.success(`Answers compressed! (${savingsPercent}% smaller)`);
        }
      }

      // Update database record
      const { data: result, error } = await supabase
        .from('seminars')
        .update({
          yrs: data.yrs,
          seminar_paper_path: seminarPaperPath,
          answers_path: answersPath,
        })
        .eq('sem_id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seminars'] });
      toast.success('Seminar updated successfully');
      setEditingSeminar(null);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update seminar: ' + error.message);
    },
  });

  // Delete seminar mutation
  const deleteMutation = useMutation({
    mutationFn: async (seminar: Seminar) => {
      // Delete files from storage
      if (seminar.seminar_paper_path) {
        await supabase.storage.from('seminar-papers').remove([seminar.seminar_paper_path]);
      }
      if (seminar.answers_path) {
        await supabase.storage.from('answers').remove([seminar.answers_path]);
      }

      // Delete database record
      const { error } = await supabase
        .from('seminars')
        .delete()
        .eq('sem_id', seminar.sem_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seminars'] });
      toast.success('Seminar deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete seminar: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      yrs: new Date().getFullYear(),
    });
    setSeminarPaperFile(null);
    setAnswersFile(null);
  };

  const handleCreate = () => {
    createMutation.mutate({ ...formData, seminarPaperFile, answersFile });
  };

  const handleUpdate = () => {
    if (!editingSeminar) {
      toast.error('Please select a seminar to update');
      return;
    }
    updateMutation.mutate({ id: editingSeminar.sem_id, ...formData, seminarPaperFile, answersFile });
  };

  const handleEdit = (seminar: Seminar) => {
    setEditingSeminar(seminar);
    setFormData({
      yrs: seminar.yrs,
    });
  };

  const handleDelete = (seminar: Seminar) => {
    if (confirm('Are you sure you want to delete this seminar? This action cannot be undone.')) {
      deleteMutation.mutate(seminar);
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
    <PermissionGate permissionKey="seminar" permissionName="Seminar Handling">
      <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <AdminHeader title="Seminar Management" breadcrumb="Admin / Seminar Management" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Seminar Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage seminar papers and answers</p>
        </div>
        <Dialog open={isCreateDialogOpen || !!editingSeminar} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingSeminar(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Seminar
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90vw] sm:w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 gap-3 sm:gap-4">
            <DialogHeader className="space-y-1 sm:space-y-2">
              <DialogTitle className="text-base sm:text-lg">{editingSeminar ? 'Edit Seminar' : 'Add New Seminar'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 sm:space-y-3">
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="year" className="text-xs sm:text-sm font-medium">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.yrs}
                  onChange={(e) => setFormData(prev => ({ ...prev, yrs: parseInt(e.target.value) }))}
                  className="text-xs sm:text-sm h-8 sm:h-9"
                />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="seminar-paper" className="text-xs sm:text-sm font-medium">Seminar Paper (PDF)</Label>
                <Input
                  id="seminar-paper"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSeminarPaperFile(e.target.files?.[0] || null)}
                  className="text-xs sm:text-sm h-8 sm:h-9"
                />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="answers" className="text-xs sm:text-sm font-medium">Answers (PDF)</Label>
                <Input
                  id="answers"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setAnswersFile(e.target.files?.[0] || null)}
                  className="text-xs sm:text-sm h-8 sm:h-9"
                />
              </div>
              <div className="flex gap-2 pt-1 sm:pt-2">
                <Button
                  onClick={editingSeminar ? handleUpdate : handleCreate}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  {editingSeminar ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="px-2 sm:px-4 md:px-6 py-3 sm:py-4">
          <CardTitle className="text-xl sm:text-2xl">Seminars</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 overflow-x-auto">
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Seminar Paper</TableHead>
                <TableHead>Answers</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seminars?.map((seminar) => (
                <TableRow key={seminar.sem_id}>
                  <TableCell>{seminar.yrs}</TableCell>
                  <TableCell>
                    {seminar.seminar_paper_path ? (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={supabase.storage.from('seminar-papers').getPublicUrl(seminar.seminar_paper_path).data.publicUrl}
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
                    {seminar.answers_path ? (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={supabase.storage.from('answers').getPublicUrl(seminar.answers_path).data.publicUrl}
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
                        onClick={() => handleEdit(seminar)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      {canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(seminar)}
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