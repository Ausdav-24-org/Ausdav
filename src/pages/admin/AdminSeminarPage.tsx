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
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('seminar-papers')
          .upload(fileName, data.seminarPaperFile);

        if (uploadError) throw uploadError;
        seminarPaperPath = uploadData.path;
      }

      // Upload answers if provided
      if (data.answersFile) {
        const fileExt = data.answersFile.name.split('.').pop();
        const fileName = `${data.yrs}_answers.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('answers')
          .upload(fileName, data.answersFile);

        if (uploadError) throw uploadError;
        answersPath = uploadData.path;
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
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('seminar-papers')
          .upload(fileName, data.seminarPaperFile, { upsert: true });

        if (uploadError) throw uploadError;
        seminarPaperPath = uploadData.path;
      }

      // Upload new answers if provided
      if (data.answersFile) {
        const fileExt = data.answersFile.name.split('.').pop();
        const fileName = `${data.yrs}_answers.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('answers')
          .upload(fileName, data.answersFile, { upsert: true });

        if (uploadError) throw uploadError;
        answersPath = uploadData.path;
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
      <div className="p-6 space-y-6">
        <AdminHeader title="Seminar Management" breadcrumb="Admin / Seminar Management" />
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Seminar Management</h1>
          <p className="text-muted-foreground">Manage seminar papers and answers</p>
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSeminar ? 'Edit Seminar' : 'Add New Seminar'}</DialogTitle>
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
                <Label htmlFor="seminar-paper">Seminar Paper (PDF)</Label>
                <Input
                  id="seminar-paper"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSeminarPaperFile(e.target.files?.[0] || null)}
                />
              </div>
              <div>
                <Label htmlFor="answers">Answers (PDF)</Label>
                <Input
                  id="answers"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setAnswersFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={editingSeminar ? handleUpdate : handleCreate}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {editingSeminar ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seminars</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
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