import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

type GalleryRow = {
  id: string;
  event_id: number;
  year: number;
  title: string | null;
  embed_codes: Record<string, string>; // JSON object {1: code, 2: code, ...}
  created_at: string;
  created_by: string | null;
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
  const [embedCode, setEmbedCode] = useState('');
  const [embedPreview, setEmbedPreview] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedGalleryImageIndex, setSelectedGalleryImageIndex] = useState<number | null>(null);
  const [galleryEmbed, setGalleryEmbed] = useState<GalleryRow | null>(null);
  const [embedCodeNumber, setEmbedCodeNumber] = useState('1'); // Which embed code slot

  // Fetch gallery with embed_codes
  const { data: gallery, isLoading: galleryLoading } = useQuery({
    queryKey: ['gallery', galleryId],
    queryFn: async () => {
      const { data, error } = await supabaseDb
        .from('galleries')
        .select('id, event_id, year, title, embed_codes, created_at, created_by')
        .eq('id', galleryId)
        .single();
      if (error) throw error;
      setGalleryEmbed(data as GalleryRow);
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

  // Save embed code to galleries table
  const saveEmbedCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!galleryEmbed) throw new Error('Gallery not loaded');

      const currentCodes = galleryEmbed.embed_codes || {};
      const newCodes = {
        ...currentCodes,
        [embedCodeNumber]: code,
      };

      const { error } = await supabaseDb
        .from('galleries')
        .update({ embed_codes: newCodes })
        .eq('id', galleryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery', galleryId] });
      queryClient.invalidateQueries({ queryKey: ['galleries', eventId] });
      toast.success(`Embed code #${embedCodeNumber} saved successfully`);
      // Fetch updated gallery
      supabaseDb
        .from('galleries')
        .select('id, event_id, year, title, embed_codes, created_at, created_by')
        .eq('id', galleryId)
        .single()
        .then(({ data }) => setGalleryEmbed(data as GalleryRow));
    },
    onError: (error) => {
      console.error('Save embed code failed:', error);
      toast.error('Failed to save embed code: ' + error.message);
    },
  });

  // Delete embed code from galleries table
  const deleteEmbedCodeMutation = useMutation({
    mutationFn: async (codeNumber: string) => {
      if (!galleryEmbed) throw new Error('Gallery not loaded');

      const newCodes = { ...galleryEmbed.embed_codes };
      delete newCodes[codeNumber];

      const { error } = await supabaseDb
        .from('galleries')
        .update({ embed_codes: newCodes })
        .eq('id', galleryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery', galleryId] });
      queryClient.invalidateQueries({ queryKey: ['galleries', eventId] });
      toast.success('Embed code deleted successfully');
      // Fetch updated gallery
      supabaseDb
        .from('galleries')
        .select('id, event_id, year, title, embed_codes, created_at, created_by')
        .eq('id', galleryId)
        .single()
        .then(({ data }) => setGalleryEmbed(data as GalleryRow));
    },
    onError: (error) => {
      console.error('Delete embed code failed:', error);
      toast.error('Failed to delete embed code: ' + error.message);
    },
  });

  // Extract post ID from Facebook URL
  const extractPostIdFromUrl = (url: string): string | null => {
    try {
      // Handle various Facebook URL formats
      // Format 1: facebook.com/photo.php?fbid=123456789
      const fbidMatch = url.match(/fbid=(\d+)/);
      if (fbidMatch) return fbidMatch[1];
      
      // Format 2: facebook.com/username/posts/123456789
      const postsMatch = url.match(/\/posts\/(\d+)/);
      if (postsMatch) return postsMatch[1];
      
      // Format 3: facebook.com/permalink.php?story_fbid=123456789
      const storyMatch = url.match(/story_fbid=(\d+)/);
      if (storyMatch) return storyMatch[1];
      
      // Format 4: facebook.com/media/set/?set=123456789
      const setMatch = url.match(/set=(\d+)/);
      if (setMatch) return setMatch[1];

      return null;
    } catch {
      return null;
    }
  };

  // Parse Facebook embed code to extract post ID or validate embed
  const parseEmbedCode = (code: string): { postId?: string; isValid: boolean } => {
    try {
      const trimmedCode = code.trim();

      // Method 1: Extract from fb-post div with data-href
      // Format: <div class="fb-post" data-href="https://www.facebook.com/..."/>
      const dataHrefMatch = trimmedCode.match(/data-href=["']([^"']+)["']/i);
      if (dataHrefMatch) {
        const url = dataHrefMatch[1];
        const postId = extractPostIdFromUrl(url);
        return { postId, isValid: true };
      }

      // Method 2: Extract from iframe embed code
      // Format: <iframe src="https://www.facebook.com/plugins/post.php?href=...
      const iframeHrefMatch = trimmedCode.match(/href=([^&\s"']+)/i);
      if (iframeHrefMatch && trimmedCode.includes('facebook.com/plugins')) {
        try {
          const url = decodeURIComponent(iframeHrefMatch[1]);
          const postId = extractPostIdFromUrl(url);
          return { postId, isValid: true };
        } catch {
          return { isValid: true }; // Still valid iframe, just can't extract ID
        }
      }

      // Method 3: Check if it's an iframe element at all
      if (trimmedCode.includes('<iframe') && trimmedCode.includes('facebook.com')) {
        return { isValid: true };
      }

      // Method 4: Check for SDK script with fb-root
      if (trimmedCode.includes('fb-root') || trimmedCode.includes('facebook.com') && trimmedCode.includes('sdk.js')) {
        return { isValid: true };
      }

      // Method 5: Just check if it contains facebook.com and HTML tags
      if (trimmedCode.includes('facebook.com') && (trimmedCode.includes('<') || trimmedCode.includes('http'))) {
        return { isValid: true };
      }

      return { isValid: false };
    } catch {
      return { isValid: false };
    }
  };

  // Handle embed code preview
  const handleEmbedPreview = () => {
    if (!embedCode.trim()) {
      toast.error('Please paste the Facebook embed code');
      return;
    }

    const { isValid } = parseEmbedCode(embedCode);
    
    if (!isValid) {
      toast.error(
        'Invalid embed code. Make sure you copied the complete code from Facebook:\n\n' +
        '1. Go to a Facebook post → Click "..." → Select "Embed"\n' +
        '2. Copy the entire code block (including <div> and <script> tags)\n' +
        '3. Paste it in the text area above'
      );
      return;
    }

    // Store the embed code for preview
    setEmbedPreview(embedCode);
    setShowPreviewModal(true);
    toast.success('Facebook post embed loaded successfully');
  };

  // Save embed code to database
  const handleSaveEmbedCode = async () => {
    if (!embedCode.trim()) {
      toast.error('Nothing to save');
      return;
    }

    const { isValid } = parseEmbedCode(embedCode);
    if (!isValid) {
      toast.error('Invalid embed code');
      return;
    }

    saveEmbedCodeMutation.mutate(embedCode);
  };

  // Clear embed preview
  const handleClearEmbed = () => {
    setEmbedCode('');
    setEmbedPreview('');
    setShowPreviewModal(false);
  };

  // Check if embed code already exists
  const embedCodeExists = galleryEmbed?.embed_codes && galleryEmbed.embed_codes[embedCodeNumber];
  const totalEmbedCodes = galleryEmbed?.embed_codes ? Object.keys(galleryEmbed.embed_codes).length : 0;

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
            {/* Official Facebook Embed Method */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-2">📍 Steps to Get Embed Code:</h3>
                <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside mb-3">
                  <li>Go to any <strong>public Facebook post</strong></li>
                  <li>Click the three dots <strong>(...)</strong> in top-right corner</li>
                  <li>Select <strong>"Embed"</strong></li>
                  <li>Click <strong>"Copy Code"</strong> and paste it below</li>
                </ol>
                
                <div className="bg-white dark:bg-black/30 rounded p-2 mt-3 border border-blue-100 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">✓ Valid code starts with:</p>
                  <code className="text-xs text-blue-700 dark:text-blue-300 whitespace-pre-wrap break-words">
{`<div id="fb-root"></div>`}
                  </code>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">or</p>
                  <code className="text-xs text-blue-700 dark:text-blue-300 whitespace-pre-wrap break-words">
{`<iframe src="https://www.facebook.com/plugins..."`}
                  </code>
                </div>

                {/* How it works for non-Facebook users */}
                <div className="bg-green-50 dark:bg-green-950 rounded p-3 border border-green-200 dark:border-green-800">
                  <details className="cursor-pointer">
                    <summary className="font-semibold text-xs text-green-900 dark:text-green-100 hover:text-green-700 dark:hover:text-green-200">
                      💡 How Does This Work for Users Without Facebook Account?
                    </summary>
                    <div className="mt-3 text-xs text-green-800 dark:text-green-300 space-y-2">
                      <p className="font-semibold mt-2">✅ What Non-Facebook Users CAN Do:</p>
                      <ul className="list-disc list-inside ml-2 space-y-1">
                        <li>View the embedded post with images & text</li>
                        <li>See like counts & comment counts</li>
                        <li>Read all comments from Facebook</li>
                        <li>Click links in the post</li>
                        <li>Share link with friends via email/messaging</li>
                      </ul>

                      <p className="font-semibold mt-2">❌ What They CANNOT Do (Without Account):</p>
                      <ul className="list-disc list-inside ml-2 space-y-1">
                        <li>Click the "Like" button on post</li>
                        <li>Post comments</li>
                        <li>Share directly to their Facebook timeline</li>
                      </ul>

                      <p className="font-semibold mt-2">🔧 How It Works Technically:</p>
                      <ol className="list-decimal list-inside ml-2 space-y-1">
                        <li><code className="bg-white dark:bg-black/30 px-1">fb-root</code> - Container for Facebook code</li>
                        <li><code className="bg-white dark:bg-black/30 px-1">fb-post</code> div - Placeholder for your post</li>
                        <li>Facebook SDK - Automatically loads & renders the post</li>
                        <li>Users see actual post from Facebook servers</li>
                        <li>Always updated (if post changes on Facebook)</li>
                      </ol>

                      <p className="italic mt-2 text-green-700 dark:text-green-400">
                        📖 Full guide: <code className="bg-white dark:bg-black/30 px-2 py-1 rounded">FACEBOOK_EMBED_METHODS_GUIDE.md</code>
                      </p>
                    </div>
                  </details>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="embed-code">Facebook Embed Code</Label>
                <textarea
                  id="embed-code"
                  placeholder='Paste the COMPLETE code from Facebook (entire block from "Copy Code")'
                  value={embedCode}
                  onChange={(e) => setEmbedCode(e.target.value)}
                  className="w-full h-40 p-3 border rounded-md bg-background text-foreground text-xs font-mono"
                />
                <p className="text-xs text-muted-foreground">Paste the entire code block, not just the URL</p>
              </div>

              {/* Embed number selector */}
              <div className="space-y-2">
                <Label htmlFor="embed-number">Embed Code Slot (for multiple embeds)</Label>
                <select
                  id="embed-number"
                  value={embedCodeNumber}
                  onChange={(e) => setEmbedCodeNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm"
                >
                  {['1', '2', '3', '4', '5'].map((num) => (
                    <option key={num} value={num}>
                      Embed Code #{num}
                      {galleryEmbed?.embed_codes?.[num] ? ' (Already saved)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Choose a slot to organize multiple Facebook posts</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleClearEmbed}
                  disabled={!embedCode}
                >
                  Clear
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleEmbedPreview}
                  disabled={!embedCode}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Post
                </Button>
                <Button
                  onClick={() => handleSaveEmbedCode()}
                  disabled={!embedCode || saveEmbedCodeMutation.isPending}
                >
                  {saveEmbedCodeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Save to Gallery
                    </>
                  )}
                </Button>
              </div>

              {/* Saved Embed Codes List */}
              {totalEmbedCodes > 0 && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
                  <h3 className="font-semibold text-sm text-green-900 dark:text-green-100 mb-3">
                    ✓ Saved Embed Codes ({totalEmbedCodes})
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(galleryEmbed?.embed_codes || {}).map(([num, code]) => (
                      <div
                        key={num}
                        className="flex items-center justify-between p-2 bg-white dark:bg-black/30 rounded border border-green-100 dark:border-green-800"
                      >
                        <span className="text-sm font-medium text-green-900 dark:text-green-100">
                          Embed #{num}: {code.substring(0, 50)}...
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete embed code #${num}?`)) {
                              deleteEmbedCodeMutation.mutate(num);
                            }
                          }}
                          disabled={deleteEmbedCodeMutation.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Embed Preview Modal */}
              <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-black/95 border border-gray-200 dark:border-gray-800">
                  <DialogTitle className="sr-only">Facebook Post Preview</DialogTitle>
                  <DialogDescription className="sr-only">Preview of the Facebook post embed that will be added to your website</DialogDescription>
                  {/* Facebook Post Content */}
                  <div className="py-4">
                    <div 
                      className="flex justify-center"
                      dangerouslySetInnerHTML={{ __html: embedPreview }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
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
