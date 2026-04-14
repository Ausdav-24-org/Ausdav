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

type GalleryImageRow = {
  id: string;
  gallery_id: string;
  file_path: string;
  created_at: string;
  created_by?: string;
};

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

  const { isLoading: galleryLoading } = useQuery({
    queryKey: ['gallery', galleryId],
    queryFn: async () => {
      const { data, error } = await supabaseDb
        .from('galleries')
        .select('id, event_id, year, title, created_at, created_by')
        .eq('id', galleryId)
        .single();
      if (error) throw error;
      return data as GalleryRow;
    },
  });

  // Fetch existing gallery images
  const { data: existingImages, isLoading: imagesLoading } = useQuery({
    queryKey: ['gallery-images', galleryId],
    queryFn: async () => {
      const { data, error } = await supabaseDb
        .from('gallery_images')
        .select('id, file_path, created_at, created_by')
        .eq('gallery_id', galleryId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (GalleryImageRow & { created_by: string })[];
    },
  });

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async ({ imageId, filePath }: { imageId: string; filePath: string }) => {
      console.log('Attempting to delete image:', { imageId, filePath });

      // First delete from database to ensure we don't lose the record if storage fails
      const { error: dbError } = await supabaseDb
        .from('gallery_images')
        .delete()
        .eq('id', imageId);

      if (dbError) {
        console.error('Database deletion failed:', dbError);
        throw new Error('Failed to delete from database: ' + dbError.message);
      }

      // Then delete from storage
      const { error: storageError } = await supabase.storage
        .from('event-gallery')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage deletion failed:', storageError);
        // Don't throw here - database record is already deleted
        // Log the error but don't fail the operation
        console.warn('File may still exist in storage:', filePath);
      } else {
        console.log('Successfully deleted from storage:', filePath);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-images', galleryId] });
      queryClient.invalidateQueries({ queryKey: ['galleries', eventId] });
      toast.success('Image deleted successfully');
    },
    onError: (error) => {
      console.error('Delete operation failed:', error);
      toast.error('Failed to delete image: ' + error.message);
      // Refresh queries to show current state
      queryClient.invalidateQueries({ queryKey: ['gallery-images', galleryId] });
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Upload Images</h1>
          <p className="text-muted-foreground mt-1">Gallery for {year}</p>
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
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {existingImages.map((image, index) => {
                  const { data: imageUrl } = supabase.storage
                    .from('event-gallery')
                    .getPublicUrl(image.file_path);

                  return (
                    <div key={image.id} className="relative group">
                      <button
                        onClick={() => setSelectedGalleryImageIndex(index)}
                        className="w-full h-24 overflow-hidden rounded border hover:border-accent transition-all hover:shadow-md"
                      >
                        <img
                          src={imageUrl?.publicUrl}
                          alt="Gallery image"
                          className="w-full h-full object-cover group-hover:brightness-75 transition-all duration-300"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-4 h-4 text-black" />
                          </div>
                        </div>
                      </button>
                      {image.created_by && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this image?')) {
                              deleteImageMutation.mutate({ imageId: image.id, filePath: image.file_path });
                            }
                          }}
                          disabled={deleteImageMutation.isPending}
                          title="Delete image"
                        >
                          {deleteImageMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Gallery Lightbox Modal */}
              <Dialog open={selectedGalleryImageIndex !== null} onOpenChange={() => setSelectedGalleryImageIndex(null)}>
                <DialogContent className="max-w-4xl w-full max-h-[90vh] p-0 border-0 bg-black/95">
                  <DialogTitle className="sr-only">Gallery Image Viewer</DialogTitle>
                  <DialogDescription className="sr-only">View and navigate through gallery images with arrow keys or buttons</DialogDescription>
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    {/* Close Button */}
                    <button
                      onClick={() => setSelectedGalleryImageIndex(null)}
                      className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <X className="w-6 h-6 text-white" />
                    </button>

                    {/* Image Counter */}
                    <div className="absolute top-4 left-4 text-white text-sm font-medium bg-black/50 px-3 py-2 rounded">
                      {selectedGalleryImageIndex !== null ? selectedGalleryImageIndex + 1 : 0} / {existingImages?.length || 0}
                    </div>

                    {/* Main Image */}
                    {selectedGalleryImageIndex !== null && existingImages && existingImages[selectedGalleryImageIndex] && (
                      <div className="relative w-full h-[70vh] flex items-center justify-center flex-1">
                        {(() => {
                          const { data: imageUrl } = supabase.storage
                            .from('event-gallery')
                            .getPublicUrl(existingImages[selectedGalleryImageIndex].file_path);
                          return (
                            <img
                              src={imageUrl?.publicUrl}
                              alt={`Gallery image ${selectedGalleryImageIndex + 1}`}
                              className="max-w-full max-h-full object-contain"
                            />
                          );
                        })()}
                      </div>
                    )}

                    {/* Navigation Arrows and Dots */}
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-6 bg-gradient-to-t from-black to-transparent">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSelectedGalleryImageIndex((prev) =>
                            prev === null ? null : prev === 0 ? (existingImages?.length || 1) - 1 : prev - 1
                          )
                        }
                        className="text-white hover:bg-white/20"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </Button>

                      <div className="flex gap-2 flex-wrap justify-center max-w-2xl">
                        {existingImages?.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedGalleryImageIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              idx === selectedGalleryImageIndex ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/75'
                            }`}
                            aria-label={`Go to image ${idx + 1}`}
                          />
                        ))}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSelectedGalleryImageIndex((prev) =>
                            prev === null ? null : prev === (existingImages?.length || 1) - 1 ? 0 : (prev || 0) + 1
                          )
                        }
                        className="text-white hover:bg-white/20"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No images in this gallery yet. Upload some images above.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GalleryBulkUpload;
