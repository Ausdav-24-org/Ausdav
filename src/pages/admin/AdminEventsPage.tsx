import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PermissionGate } from '@/components/admin/PermissionGate';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AdminHeader } from '@/components/admin/AdminHeader';
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
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Calendar, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import GalleryBulkUpload from './GalleryBulkUpload';
import { compressImageBlob } from '@/lib/imageCompression';

interface Event {
  id: number;
  title_en: string;
  title_ta: string | null;
  description_en: string | null;
  description_ta: string | null;
  event_date: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
  image_bucket: string | null;
  image_path: string | null;
}

interface Gallery {
  id: string;
  event_id: number;
  year: number;
  title: string | null;
  description_en: string | null;
  description_ta: string | null;
  max_images?: number | null;
  created_at: string;
}

type EventInsert = {
  id?: string;
  title_en: string;
  title_ta?: string | null;
  description_en?: string | null;
  description_ta?: string | null;
  event_date: string;
  location?: string | null;
  is_active?: boolean;
  created_at?: string;
  image_bucket?: string | null;
  image_path?: string | null;
};

type GalleryInsert = {
  id?: string;
  event_id: number;
  year: number;
  title?: string | null;
  description_en?: string | null;
  description_ta?: string | null;
  created_at?: string;
};

type GalleryImageRow = {
  id: string;
  gallery_id: string;
  file_path: string;
  created_at: string;
};

type GalleryImageInsert = {
  id?: string;
  gallery_id: string;
  file_path: string;
  created_at?: string;
};

type Database = {
  public: {
    Tables: {
      events: {
        Row: Event;
        Insert: EventInsert;
        Update: Partial<EventInsert>;
      };
      galleries: {
        Row: Gallery;
        Insert: GalleryInsert;
        Update: Partial<GalleryInsert>;
      };
      gallery_images: {
        Row: GalleryImageRow;
        Insert: GalleryImageInsert;
        Update: Partial<GalleryImageInsert>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type EventFormState = {
  title_en: string;
  title_ta: string;
  description_en: string;
  description_ta: string;
  event_date: string; // still required by schema, defaulted silently
  location: string;
  is_active: boolean;
  image_bucket: string;
  image_path: string | null;
};

const AdminEventsPage: React.FC = () => {
  const queryClient = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseDb = supabase as unknown as SupabaseClient<any, any, any, any>;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
  const [selectedEventForGallery, setSelectedEventForGallery] = useState<Event | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [createdGalleryId, setCreatedGalleryId] = useState<string | null>(null);
  const [newGalleryYear, setNewGalleryYear] = useState('');
  const [newGalleryDescriptionEn, setNewGalleryDescriptionEn] = useState('');
  const [newGalleryDescriptionTa, setNewGalleryDescriptionTa] = useState('');
  const [formData, setFormData] = useState<EventFormState>({
    title_en: '',
    title_ta: '',
    description_en: '',
    description_ta: '',
    event_date: new Date().toISOString().split('T')[0],
    location: '',
    is_active: true,
    image_bucket: 'events',
    image_path: null,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const validateForm = () => {
    if (!formData.title_en.trim()) {
      toast.error('Title (English) is required');
      return false;
    }
    if (!formData.event_date) {
      toast.error('Event date is required');
      return false;
    }
    return true;
  };

  // Fetch galleries for a specific year
  const { data: galleries, isLoading: galleriesLoading } = useQuery({
    queryKey: ['galleries', selectedEventForGallery?.id ?? null],
    queryFn: async () => {
      if (!selectedEventForGallery) return [];
      const year = new Date(selectedEventForGallery.event_date).getFullYear();
      const { data, error } = await supabaseDb
        .from('galleries')
        .select('id, event_id, year, title, description_en, description_ta, max_images, created_at')
        .eq('event_id', selectedEventForGallery.id)
        .eq('year', year)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Gallery[];
    },
    enabled: !!selectedEventForGallery && galleryDialogOpen,
  });

  // Fetch events using raw query
  const { data: events, isLoading } = useQuery({
    queryKey: ['admin-events'],
    queryFn: async () => {
      const { data, error } = await supabaseDb
        .from('events')
        .select('id,title_en,title_ta,description_en,description_ta,event_date,location,is_active,created_at,image_bucket,image_path')
        .order('event_date', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Event[];
    },
  });

  // Create event mutation
  const createMutation = useMutation({
    mutationFn: async (data: EventFormState) => {
      const { error } = await supabase
        .from('events')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast.success('Event created successfully');
      resetForm();
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast.error('Failed to create event: ' + error.message);
      setIsSubmitting(false);
    },
  });

  // Update event mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EventFormState }) => {
      const { error } = await supabase
        .from('events')
        .update(data)
        .eq('id', id.toString());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast.success('Event updated successfully');
      resetForm();
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast.error('Failed to update event: ' + error.message);
      setIsSubmitting(false);
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Create gallery mutation
  const createGalleryMutation = useMutation({
    mutationFn: async ({ year, title, description_en, description_ta }: { year: number; title: string; description_en?: string | null; description_ta?: string | null }) => {
      if (!selectedEventForGallery) throw new Error('No event selected');
      const { data, error } = await supabaseDb
        .from('galleries')
        .insert([{ 
          event_id: selectedEventForGallery.id, 
          year, 
          title,
          description_en,
          description_ta
        }])
        .select()
        .single();
      if (error) throw error;
      return data as Gallery;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['galleries', selectedEventForGallery?.id ?? null] });
      toast.success('Gallery created successfully');
      setCreatedGalleryId(data.id);
      setShowBulkUpload(true);
    },
    onError: (error) => {
      toast.error('Failed to create gallery: ' + error.message);
    },
  });

  // Delete gallery mutation
  const deleteGalleryMutation = useMutation({
    mutationFn: async (galleryId: string) => {
      console.log('Starting gallery deletion for:', galleryId);

      // First, get all images associated with this gallery
      const { data: galleryImages, error: fetchError } = await supabaseDb
        .from('gallery_images')
        .select('id, file_path')
        .eq('gallery_id', galleryId);

      if (fetchError) {
        console.error('Failed to fetch gallery images:', fetchError);
        throw new Error('Failed to fetch gallery images: ' + fetchError.message);
      }

      console.log('Found images to delete:', galleryImages?.length || 0);

      // Delete images from storage if any exist
      if (galleryImages && galleryImages.length > 0) {
        const filePaths = galleryImages.map(img => img.file_path);
        console.log('Deleting files from storage:', filePaths);

        const { error: storageError } = await supabase.storage
          .from('event-gallery')
          .remove(filePaths);

        if (storageError) {
          console.error('Storage deletion failed:', storageError);
          // Continue with database deletion even if storage fails
          console.warn('Continuing with database deletion despite storage error');
        } else {
          console.log('Successfully deleted files from storage');
        }

        // Delete all gallery_images records
        const { error: imagesDeleteError } = await supabaseDb
          .from('gallery_images')
          .delete()
          .eq('gallery_id', galleryId);

        if (imagesDeleteError) {
          console.error('Failed to delete gallery images from database:', imagesDeleteError);
          throw new Error('Failed to delete gallery images: ' + imagesDeleteError.message);
        }

        console.log('Successfully deleted gallery images from database');
      }

      // Finally, delete the gallery record
      const { error: galleryDeleteError } = await supabaseDb
        .from('galleries')
        .delete()
        .eq('id', galleryId);

      if (galleryDeleteError) {
        console.error('Failed to delete gallery:', galleryDeleteError);
        throw new Error('Failed to delete gallery: ' + galleryDeleteError.message);
      }

      console.log('Successfully deleted gallery record');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries', selectedEventForGallery?.id ?? null] });
      toast.success('Gallery and all associated images deleted successfully');
    },
    onError: (error) => {
      console.error('Gallery deletion failed:', error);
      toast.error('Failed to delete gallery: ' + error.message);
      // Refresh queries to show current state
      queryClient.invalidateQueries({ queryKey: ['galleries', selectedEventForGallery?.id ?? null] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data: eventData, error: fetchError } = await supabaseDb
        .from('events')
        .select('image_bucket,image_path')
        .eq('id', id)
        .maybeSingle();
      if (fetchError) throw fetchError;

      await deleteEventGalleryAssets(id);

      if (eventData?.image_path) {
        await deleteEventImage(eventData.image_bucket || 'events', eventData.image_path);
      }

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id.toString());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast.success('Event deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete event: ' + error.message);
    },
  });

  // Toggle active status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const { error } = await supabase
        .from('events')
        .update({ is_active })
        .eq('id', id.toString());
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      toast.success('Event status updated');
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title_en: '',
      title_ta: '',
      description_en: '',
      description_ta: '',
      event_date: new Date().toISOString().split('T')[0],
      location: '',
      is_active: true,
      image_bucket: 'events',
      image_path: null,
    });
    setImageFile(null);
    setImagePreviewUrl(null);
    setEditingEvent(null);
    setIsDialogOpen(false);
    setIsSubmitting(false);
  };

  const handleGalleryClick = (event: Event) => {
    setSelectedEventForGallery(event);
    setNewGalleryYear(new Date(event.event_date).getFullYear().toString());
    setGalleryDialogOpen(true);
    setShowBulkUpload(false);
    setCreatedGalleryId(null);
  };

  const handleCreateGallery = () => {
    const year = parseInt(newGalleryYear);
    if (!year || year < 1900 || year > 2100) {
      toast.error('Please enter a valid year');
      return;
    }
    createGalleryMutation.mutate({
      year,
      title: `Gallery ${year}`,
      description_en: newGalleryDescriptionEn || null,
      description_ta: newGalleryDescriptionTa || null
    });
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title_en: event.title_en,
      title_ta: event.title_ta || '',
      description_en: event.description_en || '',
      description_ta: event.description_ta || '',
      event_date: event.event_date,
      location: event.location || '',
      is_active: event.is_active,
      image_bucket: event.image_bucket || 'events',
      image_path: event.image_path,
    });
    setImageFile(null);
    if (event.image_path) {
      const { data } = supabase.storage
        .from(event.image_bucket || 'events')
        .getPublicUrl(event.image_path);
      setImagePreviewUrl(data?.publicUrl ?? null);
    } else {
      setImagePreviewUrl(null);
    }
    setIsDialogOpen(true);
  };

  const uploadImageIfNeeded = async (): Promise<{ bucket: string; path: string } | null> => {
    if (!imageFile) {
      return formData.image_path ? { bucket: formData.image_bucket, path: formData.image_path } : null;
    }

    const compressedBlob = await compressImageBlob(imageFile, {
      maxSize: 1600,
      quality: 0.82,
      mimeType: 'image/jpeg',
    });
    const compressedFile = new File([compressedBlob], `event-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const bucket = 'events';
    const path = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, compressedFile, { upsert: true, contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    return { bucket, path };
  };

  const deleteEventImage = async (bucket: string, path: string) => {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.warn('Failed to delete old event image:', error);
      toast.error('Failed to delete old event image from storage');
    }
  };

  const deleteEventGalleryAssets = async (eventId: number) => {
    const { data: galleriesForEvent, error: galleriesError } = await supabaseDb
      .from('galleries')
      .select('id')
      .eq('event_id', eventId);

    if (galleriesError) {
      console.warn('Failed to fetch galleries for event:', galleriesError);
      toast.error('Failed to delete event galleries');
      return;
    }

    const galleries = galleriesForEvent || [];
    if (galleries.length === 0) return;

    for (const gallery of galleries) {
      const { data: galleryImages, error: imagesError } = await supabaseDb
        .from('gallery_images')
        .select('file_path')
        .eq('gallery_id', gallery.id);

      if (imagesError) {
        console.warn('Failed to fetch gallery images:', imagesError);
        toast.error('Failed to delete gallery images');
      } else {
        const filePaths = (galleryImages || []).map((img) => img.file_path);
        if (filePaths.length > 0) {
          for (let i = 0; i < filePaths.length; i += 100) {
            const chunk = filePaths.slice(i, i + 100);
            const { error: storageError } = await supabase.storage
              .from('event-gallery')
              .remove(chunk);

            if (storageError) {
              console.warn('Failed to delete gallery images from storage:', storageError);
              toast.error('Failed to delete gallery images from storage');
            }
          }
        }
      }

      const { error: deleteImagesError } = await supabaseDb
        .from('gallery_images')
        .delete()
        .eq('gallery_id', gallery.id);

      if (deleteImagesError) {
        console.warn('Failed to delete gallery images from database:', deleteImagesError);
        toast.error('Failed to delete gallery images from database');
      }

      const { error: deleteGalleryError } = await supabaseDb
        .from('galleries')
        .delete()
        .eq('id', gallery.id);

      if (deleteGalleryError) {
        console.warn('Failed to delete gallery:', deleteGalleryError);
        toast.error('Failed to delete gallery');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSaving) return; // guard against double submits

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const uploaded = await uploadImageIfNeeded();

      let image_bucket = formData.image_bucket;
      let image_path = formData.image_path;

      if (uploaded) {
        image_bucket = uploaded.bucket;
        image_path = uploaded.path;
      }

      const payload: EventFormState = {
        ...formData,
        event_date: formData.event_date || new Date().toISOString().split('T')[0],
        location: formData.location,
        image_bucket,
        image_path,
      };

      if (editingEvent) {
        const oldImageBucket = editingEvent.image_bucket || 'events';
        const oldImagePath = editingEvent.image_path;
        await updateMutation.mutateAsync({ id: editingEvent.id, data: payload });
        if (
          imageFile &&
          oldImagePath &&
          (oldImageBucket !== image_bucket || oldImagePath !== image_path)
        ) {
          await deleteEventImage(oldImageBucket, oldImagePath);
        }
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Failed to save event');
      setIsSubmitting(false);
    }
  };

  return (
    <PermissionGate permissionKey="events" permissionName="Event Handling">
      <div className="space-y-6">
        <AdminHeader title="Events" breadcrumb="Admin / Events" />
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Events Management</h1>
          <p className="text-muted-foreground mt-1">Create and manage events for the organization</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => resetForm()}
              className="gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitting || isSaving}
              aria-busy={isSubmitting || isSaving}
              aria-disabled={isSubmitting || isSaving}
            >
              {(isSubmitting || isSaving) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {(isSubmitting || isSaving) ? 'Saving...' : 'Add Event'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title_en">Title (English) *</Label>
                  <Input
                    id="title_en"
                    value={formData.title_en}
                    onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                    required
                    placeholder="Event title in English"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title_ta">Title (Tamil)</Label>
                  <Input
                    id="title_ta"
                    value={formData.title_ta}
                    onChange={(e) => setFormData({ ...formData, title_ta: e.target.value })}
                    placeholder="தமிழ் தலைப்பு"
                    className="font-tamil"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="description_en">Description (English)</Label>
                  <Textarea
                    id="description_en"
                    value={formData.description_en}
                    onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                    placeholder="Event description in English"
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description_ta">Description (Tamil)</Label>
                  <Textarea
                    id="description_ta"
                    value={formData.description_ta}
                    onChange={(e) => setFormData({ ...formData, description_ta: e.target.value })}
                    placeholder="தமிழ் விளக்கம்"
                    rows={4}
                    className="font-tamil"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-image">Event Image (optional)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="event-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setImageFile(file);
                    }}
                  />
                  {imagePreviewUrl && !imageFile && (
                    <Button type="button" variant="outline" asChild size="sm">
                      <a href={imagePreviewUrl} target="_blank" rel="noreferrer">
                        <ImageIcon className="w-4 h-4 mr-2" />View
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || isSaving}
                  aria-busy={isSubmitting || isSaving}
                  aria-disabled={isSubmitting || isSaving}
                  className="gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {(isSubmitting || isSaving) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Gallery Management Dialog */}
      <Dialog open={galleryDialogOpen} onOpenChange={(open) => {
        setGalleryDialogOpen(open);
        if (!open) {
          setNewGalleryYear('');
          setNewGalleryDescriptionEn('');
          setNewGalleryDescriptionTa('');
          setSelectedEventForGallery(null);
          setShowBulkUpload(false);
          setCreatedGalleryId(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showBulkUpload ? 'Bulk Image Upload' : `Gallery Management - ${selectedEventForGallery ? new Date(selectedEventForGallery.event_date).getFullYear() : ''}`}
            </DialogTitle>
          </DialogHeader>
          {showBulkUpload && selectedEventForGallery ? (
            <GalleryBulkUpload
              galleryId={createdGalleryId || galleries?.[0]?.id || ''}
              eventId={selectedEventForGallery.id}
              year={new Date(selectedEventForGallery.event_date).getFullYear()}
              onBack={() => setShowBulkUpload(false)}
            />
          ) : (
            <div className="space-y-4">
              {galleriesLoading ? (
                <div className="text-center py-8">Loading galleries...</div>
              ) : galleries && galleries.length > 0 ? (
                <div className="space-y-4">
                  {galleries.map((gallery) => (
                    <Card key={gallery.id}>
                      <CardHeader>
                        <CardTitle>{gallery.title || `Gallery ${gallery.year}`}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p>Year: {gallery.year}</p>
                        <p>Created: {format(new Date(gallery.created_at), 'MMM d, yyyy')}</p>
                        <div className="flex gap-2 mt-2">
                          <Button
                            onClick={() => {
                              setCreatedGalleryId(gallery.id);
                              setShowBulkUpload(true);
                            }}
                          >
                            Add Images
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this gallery? This will also delete all images in the gallery.')) {
                                deleteGalleryMutation.mutate(gallery.id);
                              }
                            }}
                            disabled={deleteGalleryMutation.isPending}
                          >
                            {deleteGalleryMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No gallery for this year</h3>
                  <p className="text-muted-foreground mb-4">Create a new gallery to start adding images</p>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Create New Gallery</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="gallery-year">Year</Label>
                    <Input
                      id="gallery-year"
                      type="number"
                      placeholder="Enter year"
                      value={newGalleryYear}
                      onChange={(e) => setNewGalleryYear(e.target.value)}
                      min="1900"
                      max="2100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gallery-description-en">Description (English)</Label>
                    <Textarea
                      id="gallery-description-en"
                      placeholder="Enter gallery description in English"
                      value={newGalleryDescriptionEn}
                      onChange={(e) => setNewGalleryDescriptionEn(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="gallery-description-ta">Description (Tamil)</Label>
                    <Textarea
                      id="gallery-description-ta"
                      placeholder="Enter gallery description in Tamil"
                      value={newGalleryDescriptionTa}
                      onChange={(e) => setNewGalleryDescriptionTa(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleCreateGallery}
                    disabled={createGalleryMutation.isPending}
                    className="w-full"
                  >
                    {createGalleryMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Gallery'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            All Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading events...</div>
          ) : events && events.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Gallery</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{event.title_en}</div>
                        {event.title_ta && (
                          <div className="text-sm text-muted-foreground font-tamil">{event.title_ta}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {format(new Date(event.event_date), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleGalleryClick(event)}
                        title="Manage Gallery"
                      >
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={event.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: event.id, is_active: checked })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(event)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this event?')) {
                              deleteMutation.mutate(event.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No events yet</h3>
              <p className="text-muted-foreground mb-4">Create your first event to get started</p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                disabled={isSubmitting || isSaving}
                aria-busy={isSubmitting || isSaving}
                aria-disabled={isSubmitting || isSaving}
                className="gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {(isSubmitting || isSaving) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {(isSubmitting || isSaving) ? 'Saving...' : 'Add Event'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </PermissionGate>
  );
};

export default AdminEventsPage;
