import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, X, Loader2, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { compressImageBlob } from '@/lib/imageCompression';

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

type GalleryImageInsert = {
  id?: string;
  gallery_id: string;
  file_path: string;
  created_at?: string;
};

type Database = {
  public: {
    Tables: {
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

const GalleryBulkUpload: React.FC<GalleryBulkUploadProps> = ({ galleryId, eventId, year, onBack }) => {
  const queryClient = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseDb = supabase as unknown as SupabaseClient<any, any, any, any>;
  const [facebookPostUrl, setFacebookPostUrl] = useState('');
  const [facebookToken, setFacebookToken] = useState('');
  const [fetchedImages, setFetchedImages] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const uploadImagesMutation = useMutation({
    mutationFn: async (urls: string[]) => {
      const uploadPromises = urls.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to download image from Facebook');
        }
        const blob = await response.blob();
        const compressedBlob = await compressImageBlob(blob, {
          maxSize: 1600,
          quality: 0.82,
          mimeType: 'image/jpeg',
        });
        const compressedFile = new File([compressedBlob], `gallery-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const path = `${eventId}/${galleryId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('event-gallery')
          .upload(path, compressedFile, { upsert: true, contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;

        // Insert into gallery_images
        const { error: dbError } = await supabaseDb
          .from('gallery_images')
          .insert([{ gallery_id: galleryId, file_path: path }]);

        if (dbError) throw dbError;

        return path;
      });

      await Promise.all(uploadPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries', eventId] });
      queryClient.invalidateQueries({ queryKey: ['gallery-images', galleryId] });
      toast.success('Images uploaded successfully');
      setFetchedImages([]);
    },
    onError: (error) => {
      toast.error('Failed to upload images: ' + error.message);
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  useEffect(() => {
    const savedToken = localStorage.getItem('facebook-access-token');
    if (savedToken) {
      setFacebookToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (facebookToken) {
      localStorage.setItem('facebook-access-token', facebookToken);
    }
  }, [facebookToken]);

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

  const removeFile = (index: number) => {
    setFetchedImages(prev => prev.filter((_, i) => i !== index));
  };

  const extractImageUrls = (payload: any) => {
    const urls: string[] = [];
    const attachments = payload?.attachments?.data ?? [];
    for (const attachment of attachments) {
      const mediaUrl = attachment?.media?.image?.src;
      if (mediaUrl) urls.push(mediaUrl);
      const subAttachments = attachment?.subattachments?.data ?? [];
      for (const sub of subAttachments) {
        const subUrl = sub?.media?.image?.src;
        if (subUrl) urls.push(subUrl);
      }
    }
    return Array.from(new Set(urls));
  };

  const handleFetch = async () => {
    if (!facebookPostUrl.trim()) {
      toast.error('Please paste a Facebook post URL');
      return;
    }
    if (!facebookToken.trim()) {
      toast.error('Please paste a Facebook access token');
      return;
    }
    setIsFetching(true);
    try {
      const endpoint = `https://graph.facebook.com/v18.0/?id=${encodeURIComponent(facebookPostUrl.trim())}&fields=attachments{media,subattachments{media}}&access_token=${encodeURIComponent(facebookToken.trim())}`;
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || 'Failed to fetch Facebook post');
      }
      const urls = extractImageUrls(data);
      if (urls.length === 0) {
        toast.error('No images found on this post');
        return;
      }
      if (urls.length > 100) {
        toast.error('Maximum 100 images allowed');
      }
      setFetchedImages(urls.slice(0, 100));
      toast.success(`Fetched ${Math.min(urls.length, 100)} images`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch images from Facebook');
    } finally {
      setIsFetching(false);
    }
  };

  const handleUpload = () => {
    if (fetchedImages.length === 0) {
      toast.error('Please fetch at least one image');
      return;
    }
    setIsUploading(true);
    uploadImagesMutation.mutate(fetchedImages);
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
          <p className="text-muted-foreground mt-1">Gallery for {year} - {fetchedImages.length}/100 images fetched</p>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-accent" />
            Facebook Post Import
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="facebook-post-url">Facebook Post URL</Label>
            <Input
              id="facebook-post-url"
              type="url"
              placeholder="https://www.facebook.com/..."
              value={facebookPostUrl}
              onChange={(e) => setFacebookPostUrl(e.target.value)}
              disabled={isUploading || isFetching}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facebook-token">Facebook Access Token</Label>
            <Input
              id="facebook-token"
              type="password"
              placeholder="Paste access token"
              value={facebookToken}
              onChange={(e) => setFacebookToken(e.target.value)}
              disabled={isUploading || isFetching}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setFetchedImages([])}
              disabled={isUploading || isFetching || fetchedImages.length === 0}
            >
              Clear
            </Button>
            <Button
              onClick={handleFetch}
              disabled={isUploading || isFetching}
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Fetch Photos
                </>
              )}
            </Button>
          </div>

          {fetchedImages.length > 0 && (
            <div className="space-y-2">
              <Label>Fetched Images ({fetchedImages.length})</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                {fetchedImages.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Facebook image ${index + 1}`}
                      className="w-full h-20 object-cover rounded border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                    <p className="text-xs truncate mt-1">{`Image ${index + 1}`}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button onClick={handleUpload} disabled={isUploading || fetchedImages.length === 0}>
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {fetchedImages.length} Images
                </>
              )}
            </Button>
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {existingImages.map((image) => {
                const { data: imageUrl } = supabase.storage
                  .from('event-gallery')
                  .getPublicUrl(image.file_path);

                return (
                  <div key={image.id} className="relative group">
                    <img
                      src={imageUrl?.publicUrl}
                      alt="Gallery image"
                      className="w-full h-24 object-cover rounded border"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => window.open(imageUrl?.publicUrl, '_blank')}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {image.created_by && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this image?')) {
                              deleteImageMutation.mutate({ imageId: image.id, filePath: image.file_path });
                            }
                          }}
                          disabled={deleteImageMutation.isPending}
                          title="Delete image"
                        >
                          {deleteImageMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
