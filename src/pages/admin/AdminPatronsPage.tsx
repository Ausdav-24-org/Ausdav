import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Trash2, PlusCircle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { compressImageBlob } from '@/lib/imageCompression';

const IconUser = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
    <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
  </svg>
);

type PatronRow = {
  id: string;
  name: string;
  designation: string | null;
  image_paths: string[] | null;
  created_at: string;
  display_order?: number;
  is_active?: boolean;
  image_alt?: string | null;
  linkedin_id?: string | null;
};

export default function AdminPatronsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { isSuperAdmin } = useAdminAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PatronRow | null>(null);
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [linkedinId, setLinkedinId] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [imageAlt, setImageAlt] = useState('');

  const { data: patrons, isLoading } = useQuery<PatronRow[]>({
    queryKey: ['patrons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patrons' as any)
        .select('id, name, designation, image_paths, created_at, display_order, is_active, image_alt, linkedin_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PatronRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // optionally upload file
      let path: string | null = null;
      if (file) {
        const compressedBlob = await compressImageBlob(file, {
          maxSize: 1600,
          quality: 0.82,
          mimeType: 'image/jpeg',
        });
        const compressedFile = new File([compressedBlob], `patron-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const filePath = `patrons/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error: uploadErr } = await supabase.storage.from('patrons').upload(filePath, compressedFile, { upsert: true, contentType: 'image/jpeg' });
        if (uploadErr) throw uploadErr;
        path = filePath;
      }

      if (editing) {
        // update
        const updateObj: any = {
          name,
          designation: designation || null,
          display_order: displayOrder,
          is_active: isActive,
          image_alt: imageAlt || null,
          linkedin_id: linkedinId || null,
        };
        if (path) updateObj.image_paths = [path];
        const { error } = await supabase.from('patrons' as any).update(updateObj).eq('id', editing.id);
        if (error) throw error;
        return { action: 'updated' };
      } else {
        const insertObj: any = {
          name,
          designation: designation || null,
          image_paths: path ? [path] : [],
          display_order: displayOrder,
          is_active: isActive,
          image_alt: imageAlt || null,
          linkedin_id: linkedinId || null,
        };
        const { error } = await supabase.from('patrons' as any).insert([insertObj]);
        if (error) throw error;
        return { action: 'created' };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrons'] });
      toast.success('Patron saved');
      setOpen(false);
      setEditing(null);
      setName('');
      setDesignation('');
      setFile(null);
      setLinkedinId('');
      setDisplayOrder(0);
      setIsActive(true);
      setImageAlt('');
    },
    onError: (err: any) => {
      console.error('Save patron failed', err);
      toast.error(err.message || 'Failed to save patron');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (p: PatronRow) => {
      // delete DB row
      const { error } = await supabase.from('patrons' as any).delete().eq('id', p.id);
      if (error) throw error;
      // remove image file if present
      if (p.image_paths && p.image_paths.length > 0) {
        try {
          await supabase.storage.from('patrons').remove([p.image_paths[0]]);
        } catch (e) {
          console.warn('Failed to remove storage file', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrons'] });
      toast.success('Patron deleted');
    },
    onError: (err: any) => {
      console.error('Delete patron failed', err);
      toast.error(err.message || 'Failed to delete patron');
    },
  });

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDesignation('');
    setFile(null);
    setLinkedinId('');
    setDisplayOrder(0);
    setIsActive(true);
    setImageAlt('');
    setOpen(true);
  };

  const openEdit = (p: PatronRow) => {
    setEditing(p);
    setName(p.name);
    setDesignation(p.designation || '');
    setFile(null);
    setLinkedinId(p.linkedin_id || '');
    setDisplayOrder(p.display_order ?? 0);
    setIsActive(p.is_active ?? true);
    setImageAlt(p.image_alt || '');
    setOpen(true);
  };

  return (
    <PermissionGate permissionKey="patrons" permissionName="Patrons">
      <div className="min-h-screen">
        <AdminHeader title="Patrons" breadcrumb="Admin / Patrons" />
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Manage Patrons</h2>
            {isSuperAdmin && (
              <Button onClick={openCreate}>
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Patron
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Patrons</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : patrons && patrons.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {patrons.map((p) => {
                    const hasImage = Array.isArray(p.image_paths) && p.image_paths.length > 0 && p.image_paths[0];
                    const { data: urlData } = supabase.storage.from('patrons').getPublicUrl(hasImage ? p.image_paths![0] : '');
                    const publicUrl = hasImage ? urlData?.publicUrl : null;
                    return (
                      <div key={p.id} className="p-4 border rounded space-y-2">
                                <div className="flex items-center gap-4">
                                                {publicUrl ? (
                                                  <img src={publicUrl} alt={p.image_alt || p.name} className="w-16 h-16 object-cover rounded" />
                                                ) : (
                                                  <div className={isDark ? 'w-16 h-16 rounded flex items-center justify-center bg-gray-700 text-white' : 'w-16 h-16 rounded flex items-center justify-center bg-gray-200 text-gray-600'}>
                                                    <IconUser />
                                                  </div>
                                                )}
                                  <div>
                                    <div className="font-medium">{p.name}</div>
                                    <div className="text-sm text-muted-foreground">{p.designation}</div>
                                    <div className="text-xs text-muted-foreground mt-1">Order: {p.display_order ?? 0} • {p.is_active ? 'Active' : 'Hidden'}</div>
                                  </div>
                                </div>
                        <div className="flex gap-2 justify-end">
                          <Button onClick={() => openEdit(p)}>Edit</Button>
                          <Button variant="destructive" onClick={() => { if (confirm('Delete patron?')) deleteMutation.mutate(p); }}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No patrons yet.</div>
              )}
            </CardContent>
          </Card>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Patron' : 'Add Patron'}</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
                </div>
                  <div>
                    <Label>Display Order</Label>
                    <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value || 0))} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="patron-active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    <label htmlFor="patron-active" className="text-sm">Active</label>
                  </div>
                  <div>
                    <Label>Image Alt Text</Label>
                    <Input value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} />
                  </div>
                  <div>
                    <Label>LinkedIn ID / URL</Label>
                    <Input value={linkedinId} onChange={(e) => setLinkedinId(e.target.value)} placeholder="https://linkedin.com/in/username or username" />
                  </div>
                <div>
                  <Label>Profile Image</Label>
                  <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        </div>
    </PermissionGate>
  );
}
