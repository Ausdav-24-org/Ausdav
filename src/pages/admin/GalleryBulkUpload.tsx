import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Upload, X, Loader2, Trash2, Eye, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { importFacebookUrl, type FacebookImportResponse, type FacebookContentType } from '@/services/facebookImportService';

interface GalleryBulkUploadProps {
  galleryId: string;
  eventId: number;
  year: number;
  onBack: () => void;
}

type GalleryRow = {
  id: string;
  event_id: number;
  year: number;
  title: string | null;
  created_at: string;
  created_by: string | null;
};

const GalleryBulkUpload: React.FC<GalleryBulkUploadProps> = ({ galleryId, eventId, year, onBack }) => {
  const queryClient = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseDb = supabase as unknown as SupabaseClient<any, any, any, any>;
  const [facebookUrl, setFacebookUrl] = useState('');
  const [contentType, setContentType] = useState<FacebookContentType>('auto_detect');
  const [forceResync, setForceResync] = useState(false);
  const [lastImport, setLastImport] = useState<FacebookImportResponse | null>(null);
  const [selectedGalleryImageIndex, setSelectedGalleryImageIndex] = useState<number | null>(null);

  const { data: gallery, isLoading: galleryLoading } = useQuery({
    queryKey: ['gallery', galleryId],
    queryFn: async () => {
      const { data, error } = await supabaseDb
        .from('galleries')
        .select('id, event_id, year, title, created_at, created_by, post_urls')
        .eq('id', galleryId)
        .single();
      if (error) throw error;
      return data as GalleryRow & { post_urls?: Record<string, string> };
    },
  });

  // Query for existing images
  const { data: existingImages, isLoading: imagesLoading } = useQuery({
    queryKey: ['gallery-images', galleryId],
    queryFn: async () => {
      const { data, error } = await supabaseDb
        .from('gallery_images')
        .select('*')
        .eq('gallery_id', galleryId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!galleryId,
  });

  // URL list from gallery
  const urlList = gallery?.post_urls 
    ? Object.entries(gallery.post_urls).sort((a, b) => Number(a[0]) - Number(b[0]))
    : [];

  // Remove post URL mutation
  const removePostUrlMutation = useMutation({
    mutationFn: async (index: number) => {
      if (!gallery) throw new Error('Gallery not found');

      const currentUrls = gallery.post_urls || {};
      const { [index]: removed, ...remainingUrls } = currentUrls;

      const { error } = await supabaseDb
        .from('galleries')
        .update({ post_urls: remainingUrls })
        .eq('id', galleryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery', galleryId] });
      toast.success('URL removed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove URL');
    },
  });

  // Add post URL mutation
  const addPostUrlMutation = useMutation({
    mutationFn: async (newUrl: string) => {
      if (!gallery) throw new Error('Gallery not found');

      // Validate Facebook URL
      if (
        !newUrl.includes('facebook.com') &&
        !newUrl.includes('fb.me') &&
        !newUrl.includes('instagram.com')
      ) {
        throw new Error('Please enter a valid Facebook or Instagram URL');
      }

      // Get current URLs or initialize empty object
      const currentUrls = gallery.post_urls || {};

      // Find next available index
      const nextIndex = Math.max(0, ...Object.keys(currentUrls).map(Number)) + 1;

      // Update gallery with new URL
      const { error } = await supabaseDb
        .from('galleries')
        .update({ post_urls: { ...currentUrls, [nextIndex]: newUrl } })
        .eq('id', galleryId);

      if (error) throw error;

      return nextIndex;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery', galleryId] });
      toast.success('URL added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add URL');
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!facebookUrl.trim()) {
        throw new Error('Please paste a Facebook URL');
      }

      return importFacebookUrl({
        facebook_url: facebookUrl.trim(),
        content_type: contentType,
        event_id: eventId,
        gallery_id: galleryId,
        force_resync: forceResync,
      });
    },
    onSuccess: (result) => {
      setLastImport(result);
      queryClient.invalidateQueries({ queryKey: ['gallery-images', galleryId] });
      queryClient.invalidateQueries({ queryKey: ['galleries', eventId] });

      if (result.already_imported) {
        toast.info(result.message);
      } else {
        toast.success(result.message);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Facebook import failed');
    },
  });

  const clearImportForm = () => {
    setFacebookUrl('');
    setContentType('auto_detect');
    setForceResync(false);
    setLastImport(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Add Facebook Posts</h1>
              <p className="text-sm text-muted-foreground">
                Gallery • {year} {gallery?.title && `• ${gallery.title}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-accent" />
            Facebook Import
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
              Paste a Facebook post or album URL. The backend auto-fetches media via Graph API using server-side tokens only.
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook-url">facebook_url</Label>
              <Input
                id="facebook-url"
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://www.facebook.com/..."
                disabled={importMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content-type">content_type</Label>
              <select
                id="content-type"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={contentType}
                onChange={(e) => setContentType(e.target.value as FacebookContentType)}
                disabled={importMutation.isPending}
              >
                <option value="auto_detect">auto_detect</option>
                <option value="post">post</option>
                <option value="album">album</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={forceResync}
                  onChange={(e) => setForceResync(e.target.checked)}
                  disabled={importMutation.isPending}
                />
                Allow re-sync (import only missing images)
              </label>
              <span className="text-muted-foreground">Event linked: {eventId}</span>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={clearImportForm}
                disabled={importMutation.isPending}
              >
                Clear
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || !facebookUrl.trim()}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Facebook Media
                  </>
                )}
              </Button>
            </div>

            {lastImport && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="text-sm">
                  <p>
                    <strong>Detected source:</strong> {lastImport.detected_type}
                  </p>
                  <p>
                    <strong>Facebook object id:</strong> {lastImport.facebook_object_id}
                  </p>
                  <p>
                    <strong>Imported images:</strong> {lastImport.imported_count}
                  </p>
                  {typeof lastImport.skipped_count === 'number' && (
                    <p>
                      <strong>Skipped duplicates:</strong> {lastImport.skipped_count}
                    </p>
                  )}
                  {lastImport.source_url && (
                    <a
                      href={lastImport.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      Open source on Facebook
                    </a>
                  )}
                </div>

                {lastImport.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {lastImport.images.map((img) => (
                      <div key={img.id} className="overflow-hidden rounded border">
                        <img src={img.public_url} alt="Imported from Facebook" className="h-24 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {galleryLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking gallery linkage...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Existing Images Management */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-accent" />
            Gallery Images ({existingImages?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {imagesLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading images...
            </div>
          ) : existingImages && existingImages.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {existingImages.map((img) => (
                <div key={img.id} className="overflow-hidden rounded border">
                  <img src={img.public_url} alt="Gallery image" className="h-24 w-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No images in this gallery yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* URLs List */}
      {urlList.length > 0 ? (
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">
              Added URLs ({urlList.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {urlList.map(([index, url]) => (
                <div key={index} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex-shrink-0 font-mono text-xs bg-primary/20 px-2 py-1 rounded text-primary">
                      {index}
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-sm text-blue-500 hover:underline"
                    >
                      {url}
                    </a>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePostUrlMutation.mutate(Number(index))}
                    disabled={removePostUrlMutation.isPending}
                    className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 bg-muted/30 backdrop-blur-sm">
          <CardContent className="py-8">
            <div className="text-center space-y-2">
              <LinkIcon className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
              <p className="text-muted-foreground">No post URLs added yet</p>
              <p className="text-xs text-muted-foreground">Add Facebook or Instagram post URLs above</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="border-blue-500/20 bg-blue-500/5 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm">
            <h4 className="font-semibold text-blue-900 dark:text-blue-300">How it works:</h4>
            <ul className="space-y-1 text-blue-900/80 dark:text-blue-300/80 list-disc list-inside">
              <li>Add Facebook or Instagram post URLs</li>
              <li>Images are fetched directly from the source (no storage needed)</li>
              <li>Duplicate images are automatically removed</li>
              <li>Public gallery displays all images merged by date</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GalleryBulkUpload;
