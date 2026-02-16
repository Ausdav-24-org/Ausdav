import React, { useEffect, useState, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAdminGrantedPermissions } from '@/hooks/useAdminGrantedPermissions';
import { toast } from '@/hooks/use-toast';

const db = supabase as any;

export default function AdminFeedbackPage() {
  const { isAdmin, isSuperAdmin } = useAdminAuth();
  const { hasPermission, loading: permsLoading } = useAdminGrantedPermissions();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState<string | null>(null);
  const [classifyingFeedbackId, setClassifyingFeedbackId] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await db
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFeedbacks(data || []);
    } catch (err) {
      console.error('Error fetching feedback:', err);
      toast({ title: 'Error', description: 'Could not load feedback' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only admins and super admins may view
    if (!isAdmin && !isSuperAdmin) return;
    fetchFeedback();
  }, [isAdmin, isSuperAdmin, fetchFeedback]);

  const classify = async (id: string, type: 'positive' | 'negative') => {
    // Only super admin or those granted the permission may classify
    if (!isSuperAdmin && !hasPermission('feedback')) {
      toast({ title: 'Permission denied', description: 'Only Super Admins can classify feedback' });
      return;
    }
    if (classifyingFeedbackId === id) return;
    setClassifyingFeedbackId(id);

    try {
      const { error } = await db
        .from('feedback')
        .update({ type, is_read: true })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Feedback classified' });
      fetchFeedback();
    } catch (err) {
      console.error('Error classifying feedback:', err);
      toast({ title: 'Error', description: 'Classification failed' });
    } finally {
      setClassifyingFeedbackId(null);
    }
  }; 

  const deleteFeedback = async (id: string) => {
    if (!canClassify) {
      toast({ title: 'Permission denied', description: 'You are not allowed to delete feedback' });
      return;
    }
    if (deletingFeedbackId === id) return;
    setDeletingFeedbackId(id);

    try {
      const { error } = await db.from('feedback').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Feedback removed' });
      fetchFeedback();
    } catch (err) {
      console.error('Error deleting feedback:', err);
      toast({ title: 'Error', description: 'Could not delete feedback' });
    } finally {
      setDeletingFeedbackId(null);
      setToDeleteId(null);
      setDeleteConfirmOpen(false);
    }
  }; 

  const requestDelete = (id: string) => {
    setToDeleteId(id);
    setDeleteConfirmOpen(true);
  };

  const unread = feedbacks.filter((f) => f.type == null);
  const positive = feedbacks.filter((f) => f.type === 'positive');
  const negative = feedbacks.filter((f) => f.type === 'negative');

  const canClassify = isSuperAdmin || hasPermission('feedback');

  return (
    <div className="min-h-screen">
      <AdminHeader title="Feedback" breadcrumb="Admin / Feedback" />
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Unread */}
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>Unread (Unclassified)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground">Loading...</p>
              ) : unread.length === 0 ? (
                <p className="text-center text-muted-foreground">No unread feedback</p>
              ) : (
                <div className="space-y-4">
                  {unread.map((f) => (
                    <div key={f.id} className="p-4 border rounded-lg flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <p className="text-sm text-muted-foreground">{new Date(f.created_at).toLocaleString()}</p>
                          {canClassify && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => requestDelete(f.id)} disabled={!!deletingFeedbackId}>
                              {deletingFeedbackId === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          )}
                        </div>
                        <p className="mt-1">{f.message}</p>
                      </div>
                      {canClassify && (
                        <div className="flex flex-col gap-2 ml-4">
                          <Button size="sm" variant="ghost" className="text-green-500/90" onClick={() => classify(f.id, 'positive')} disabled={!!classifyingFeedbackId}>
                            {classifyingFeedbackId === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500/90" onClick={() => classify(f.id, 'negative')} disabled={!!classifyingFeedbackId}>
                            {classifyingFeedbackId === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Positive / Negative boxes side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-green-500/6 border border-green-500/10">
              <h3 className="text-lg font-semibold text-green-400 mb-3">Positive</h3>
              {positive.length === 0 ? (
                <p className="text-sm text-muted-foreground">No positive feedback yet</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
                  {positive.map((f) => (
                    <div key={f.id} className="p-3 bg-white/3 rounded-md flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString()}</p>
                        <p className="mt-1">{f.message}</p>
                      </div>
                      {canClassify && (
                        <Button size="sm" variant="ghost" className="text-destructive ml-3" onClick={() => requestDelete(f.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 rounded-lg bg-red-500/6 border border-red-500/10">
              <h3 className="text-lg font-semibold text-red-400 mb-3">Negative</h3>
              {negative.length === 0 ? (
                <p className="text-sm text-muted-foreground">No negative feedback yet</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
                  {negative.map((f) => (
                    <div key={f.id} className="p-3 bg-white/3 rounded-md flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString()}</p>
                        <p className="mt-1">{f.message}</p>
                      </div>
                      {canClassify && (
                        <Button size="sm" variant="ghost" className="text-destructive ml-3" onClick={() => requestDelete(f.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to permanently delete this feedback?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteConfirmOpen(false); setToDeleteId(null); }} disabled={!!deletingFeedbackId}>Cancel</Button>
            <Button className="ml-2" onClick={() => toDeleteId && deleteFeedback(toDeleteId)} disabled={!!deletingFeedbackId}>
              {deletingFeedbackId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
