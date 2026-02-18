import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAdminRefresh } from '@/hooks/useAdminRefresh';
import { compressImageBlob } from '@/lib/imageCompression';

interface Announcement {
  id: string;
  title_en: string;
  title_ta: string | null;
  description_en: string | null;
  description_ta: string | null;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
  start_at: string | null;
  end_at: string | null;
  is_permanent: boolean;
  img_bucket?: string | null;
  img_path?: string | null;
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title_en: '',
    title_ta: '',
    description_en: '',
    description_ta: '',
    category: 'General',
    is_active: true,
    start_at: '',
    end_at: '',
    is_permanent: false,
    img_bucket: 'announcements',
    img_path: '',
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const mapped: Announcement[] = (data || []).map((a: any) => ({
        id: a.id ?? a.announcement_id ?? a.announcementId ?? '',
        title_en: a.title_en ?? a.title ?? '',
        title_ta: a.title_ta ?? null,
        description_en: a.description_en ?? a.message_en ?? a.description ?? null,
        description_ta: a.description_ta ?? a.message_ta ?? null,
        category: a.category ?? 'General',
        is_active: a.is_active ?? true,
        created_at: a.created_at ?? new Date().toISOString(),
        updated_at: a.updated_at ?? null,
        start_at: a.start_at ?? null,
        end_at: a.end_at ?? null,
        is_permanent: a.is_permanent ?? false,
        img_bucket: a.img_bucket ?? 'announcements',
        img_path: a.img_path ?? null,
      }));
      setAnnouncements(mapped);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  };

  const announcementPk = 'announcement_id';

  // external refresh support
  const fetchRef = useRef<() => Promise<void>>(() => Promise.resolve());
  fetchRef.current = fetchAnnouncements;
  useAdminRefresh(() => {
    fetchRef.current?.();
  });

  const toInputValue = (iso: string) => new Date(iso).toISOString().slice(0, 16);

  const toIsoOrNull = (value: string) => (value ? new Date(value).toISOString() : null);

  const resetForm = () => {
    setFormData({
      title_en: '',
      title_ta: '',
      description_en: '',
      description_ta: '',
      category: 'General',
      is_active: true,
      start_at: '',
      end_at: '',
      is_permanent: false,
      img_bucket: 'announcements',
      img_path: '',
    });
    setEditingId(null);
    setImageFile(null);
    setImagePreviewUrl(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (announcement: Announcement) => {
    setFormData({
      title_en: announcement.title_en,
      title_ta: announcement.title_ta || '',
      description_en: announcement.description_en || '',
      description_ta: announcement.description_ta || '',
      category: announcement.category || 'General',
      is_active: announcement.is_active,
      start_at: announcement.start_at ? toInputValue(announcement.start_at) : '',
      end_at: announcement.end_at ? toInputValue(announcement.end_at) : '',
      is_permanent: announcement.is_permanent,
      img_bucket: announcement.img_bucket || 'announcements',
      img_path: announcement.img_path || '',
    });
    setEditingId(announcement.id);
    if (announcement.img_path) {
      const { data } = supabase.storage
        .from(announcement.img_bucket || 'announcements')
        .getPublicUrl(announcement.img_path);
      setImagePreviewUrl(data?.publicUrl || null);
    } else {
      setImagePreviewUrl(null);
    }
    setImageFile(null);
    setDialogOpen(true);
  };

  const uploadImageIfNeeded = async () => {
    if (!imageFile) {
      return formData.img_path
        ? { bucket: formData.img_bucket || 'announcements', path: formData.img_path }
        : null;
    }

    const compressedBlob = await compressImageBlob(imageFile, {
      maxSize: 1600,
      quality: 0.82,
      mimeType: 'image/jpeg',
    });
    const compressedFile = new File([compressedBlob], `announcement-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const bucket = 'announcements';
    const path = `announcements/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, compressedFile, { upsert: true, contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    return { bucket, path };
  };

  const handleSave = async () => {
    if (!formData.title_en) {
      toast.error('Title (English) is required');
      return;
    }

    if (!formData.category) {
      toast.error('Category is required');
      return;
    }

    setSaving(true);
    try {
      const uploaded = await uploadImageIfNeeded();

      const img_bucket = uploaded?.bucket || formData.img_bucket || 'announcements';
      const img_path = uploaded?.path || formData.img_path || null;

      const payload = {
        title_en: formData.title_en,
        title_ta: formData.title_ta || null,
        description_en: formData.description_en || null,
        description_ta: formData.description_ta || null,
        category: formData.category,
        is_active: formData.is_active,
        start_at: toIsoOrNull(formData.start_at),
        end_at: formData.is_permanent ? null : toIsoOrNull(formData.end_at),
        is_permanent: formData.is_permanent,
        img_bucket,
        img_path,
      };

      if (editingId) {
        const { error } = await (supabase as any)
          .from('announcements')
          .update(payload as Partial<Announcement>)
          .eq(announcementPk, editingId);
        if (error) throw error;
        toast.success('Announcement updated');
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert(payload as any);
        if (error) throw error;
        toast.success('Announcement created');
      }
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const [togglingAnnouncementId, setTogglingAnnouncementId] = useState<string | null>(null);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);

  const toggleActive = async (announcement: Announcement) => {
    if (togglingAnnouncementId === announcement.id) return;
    setTogglingAnnouncementId(announcement.id);
    try {
      const { error } = await (supabase as any)
        .from('announcements')
        .update({ is_active: !announcement.is_active })
        .eq('announcement_id', announcement.id);

      if (error) throw error;
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === announcement.id ? { ...a, is_active: !a.is_active } : a
        )
      );
      toast.success(announcement.is_active ? 'Announcement hidden' : 'Announcement visible');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update');
    } finally {
      setTogglingAnnouncementId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    if (deletingAnnouncementId === id) return;
    setDeletingAnnouncementId(id);

    try {
      const { error } = await (supabase as any)
        .from('announcements')
        .delete()
        .eq('announcement_id', id);
      if (error) throw error;
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success('Announcement deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    } finally {
      setDeletingAnnouncementId(null);
    }
  };



  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'urgent':
        return 'bg-red-500/20 text-red-400';
      case 'event':
        return 'bg-purple-500/20 text-purple-400';
      case 'exam':
        return 'bg-blue-500/20 text-blue-400';
      case 'notice':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <PermissionGate permissionKey="announcement" permissionName="Announcement Handling">
      <div className="min-h-screen">
        <AdminHeader title="Announcements" breadcrumb="Content" />

      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            Manage announcements that appear on the public website carousel.
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : announcements.length === 0 ? (
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardContent className="p-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No announcements yet</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                Create First Announcement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement, index) => (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={cn(
                  'bg-card/50 backdrop-blur-sm border-border transition-opacity',
                  !announcement.is_active && 'opacity-60'
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getCategoryColor(announcement.category)}>
                            {announcement.category}
                          </Badge>
                          {!announcement.is_active && (
                            <Badge className="bg-muted text-muted-foreground">
                              Hidden
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold">{announcement.title_en}</h3>
                        {announcement.title_ta && (
                          <p className="text-sm text-muted-foreground">
                            {announcement.title_ta}
                          </p>
                        )}
                        {announcement.description_en && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {announcement.description_en}
                          </p>
                        )}
                        {announcement.description_ta && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {announcement.description_ta}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActive(announcement)}
                          disabled={togglingAnnouncementId === announcement.id}
                        >
                          {togglingAnnouncementId === announcement.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : announcement.is_active ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleDelete(announcement.id)}
                          disabled={deletingAnnouncementId === announcement.id}
                        >
                          {deletingAnnouncementId === announcement.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(announcement)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Announcement' : 'Create Announcement'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title (English) *</Label>
                <Input
                  value={formData.title_en}
                  onChange={(e) =>
                    setFormData({ ...formData, title_en: e.target.value })
                  }
                  placeholder="Announcement title"
                />
              </div>
              <div className="space-y-2">
                <Label>Title (Tamil)</Label>
                <Input
                  value={formData.title_ta}
                  onChange={(e) =>
                    setFormData({ ...formData, title_ta: e.target.value })
                  }
                  placeholder="தமிழ் தலைப்பு"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="General"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Description (English)</Label>
                <Textarea
                  value={formData.description_en}
                  onChange={(e) =>
                    setFormData({ ...formData, description_en: e.target.value })
                  }
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (Tamil)</Label>
                <Textarea
                  value={formData.description_ta}
                  onChange={(e) =>
                    setFormData({ ...formData, description_ta: e.target.value })
                  }
                  placeholder="விருப்பமான விளக்கம்"
                  rows={3}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Active</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  {formData.is_active ? 'Visible' : 'Hidden'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Start At</Label>
                <Input
                  type="datetime-local"
                  value={formData.start_at}
                  onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>End At</Label>
                <Input
                  type="datetime-local"
                  value={formData.end_at}
                  onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                  disabled={formData.is_permanent}
                />
              </div>

              <div className="space-y-2">
                <Label>Permanent</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={formData.is_permanent}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        is_permanent: checked,
                        end_at: checked ? '' : formData.end_at,
                      })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.is_permanent ? 'No end date' : 'Ends at time'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Announcement Image</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setImageFile(file || null);
                    setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
                  }}
                />
                {imagePreviewUrl && (
                  <img
                    src={imagePreviewUrl}
                    alt="Preview"
                    className="h-16 w-16 rounded object-cover border"
                  />
                )}
              </div>
              {formData.img_path && !imagePreviewUrl && (
                <div className="text-sm text-muted-foreground">
                  Existing image stored at {formData.img_path}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingId ? (
                'Update'
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PermissionGate>
  );
}
