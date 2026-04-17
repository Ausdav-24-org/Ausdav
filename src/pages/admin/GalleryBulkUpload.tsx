import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, X, Loader2, Trash2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

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
  post_urls: Record<string, string> | null;
};

const GalleryBulkUpload: React.FC<GalleryBulkUploadProps> = ({ galleryId, eventId, year, onBack }) => {
  const queryClient = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseDb = supabase as unknown as SupabaseClient<any, any, any, any>;
  const [postUrl, setPostUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Fetch gallery
  const { data: gallery, isLoading: galleryLoading } = useQuery({
    queryKey: ['gallery', galleryId],
    queryFn: async () => {
      const { data, error } = await supabaseDb
        .from('galleries')
        .select('id, event_id, year, title, created_at, created_by, post_urls')
        .eq('id', galleryId)
        .single();
      if (error) throw error;
      return data as GalleryRow;
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

      // Add new URL
      const updatedUrls = {
        ...currentUrls,
        [nextIndex]: newUrl,
      };

      // Update gallery
      const { error } = await supabaseDb
        .from('galleries')
        .update({ post_urls: updatedUrls })
        .eq('id', galleryId);

      if (error) throw error;

      return updatedUrls;
    },
    onSuccess: () => {
      setPostUrl('');
      queryClient.invalidateQueries({ queryKey: ['gallery', galleryId] });
      toast.success('Post URL added successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add post URL');
    },
  });

  // Remove post URL mutation
  const removePostUrlMutation = useMutation({
    mutationFn: async (index: number) => {
      if (!gallery) throw new Error('Gallery not found');

      const currentUrls = gallery.post_urls || {};
      const updatedUrls = { ...currentUrls };

      // Remove the URL at this index
      delete updatedUrls[index.toString()];

      // Re-index remaining URLs
      const reindexedUrls: Record<string, string> = {};
      let newIndex = 1;
      for (const url of Object.values(updatedUrls)) {
        reindexedUrls[newIndex] = url;
        newIndex++;
      }

      // Update gallery
      const { error } = await supabaseDb
        .from('galleries')
        .update({ post_urls: Object.keys(reindexedUrls).length > 0 ? reindexedUrls : null })
        .eq('id', galleryId);

      if (error) throw error;

      return reindexedUrls;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery', galleryId] });
      toast.success('Post URL removed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove post URL');
    },
  });

  const handleAddUrl = () => {
    if (!postUrl.trim()) {
      toast.error('Please enter a Facebook or Instagram URL');
      return;
    }
    setIsAdding(true);
    addPostUrlMutation.mutate(postUrl, {
      onSettled: () => setIsAdding(false),
    });
  };

  const postUrls = gallery?.post_urls || {};
  const urlList = Object.entries(postUrls).sort((a, b) => Number(a[0]) - Number(b[0]));

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

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Add URL Form */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Add Facebook or Instagram Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="postUrl" className="text-sm font-medium">
                Post URL
              </Label>
              <div className="flex gap-2">
                <Input
                  id="postUrl"
                  placeholder="https://facebook.com/... or https://instagram.com/..."
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
                  disabled={isAdding || addPostUrlMutation.isPending}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddUrl}
                  disabled={isAdding || addPostUrlMutation.isPending || !postUrl.trim()}
                  className="whitespace-nowrap"
                >
                  {isAdding || addPostUrlMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add URL
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add Facebook or Instagram post URLs. Images will be automatically fetched and displayed without taking storage space.
              </p>
            </div>
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
    </div>
  );
};

export default GalleryBulkUpload;
