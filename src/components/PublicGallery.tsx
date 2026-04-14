import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface PublicGalleryProps {
  eventId: number;
  year?: number;
  title?: string;
  className?: string;
}

type GalleryRow = {
  id: string;
  event_id: number;
  year: number;
  title: string | null;
  created_at: string;
};

type GalleryImageRow = {
  id: string;
  gallery_id: string;
  file_path: string;
  created_at: string;
};

const PublicGallery: React.FC<PublicGalleryProps> = ({ eventId, year, title, className = '' }) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseDb = supabase as unknown as SupabaseClient<any, any, any, any>;

  // Fetch galleries for the event
  const { data: galleries, isLoading: galleriesLoading } = useQuery({
    queryKey: ['galleries-public', eventId, year],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabaseDb.from('galleries').select('*').eq('event_id', String(eventId));
      if (year) {
        query = query.eq('year', year);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data as GalleryRow[]) || [];
    },
  });

  // Fetch images for each gallery
  const { data: images, isLoading: imagesLoading } = useQuery({
    queryKey: ['gallery-images-public', galleries?.map((g) => g.id).join(',')],
    queryFn: async () => {
      if (!galleries || galleries.length === 0) return [];

      const allImages: GalleryImageRow[] = [];
      for (const gallery of galleries) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseDb as any)
          .from('gallery_images')
          .select('id, gallery_id, file_path, created_at')
          .eq('gallery_id', gallery.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching gallery images:', error);
          continue;
        }
        if (data) {
          allImages.push(...(data as GalleryImageRow[]));
        }
      }
      return allImages;
    },
    enabled: !!galleries && galleries.length > 0,
  });

  const imageUrls = images?.map((img) => ({
    id: img.id,
    path: img.file_path,
    url: supabase.storage.from('event-gallery').getPublicUrl(img.file_path).data.publicUrl,
  })) || [];

  if (galleriesLoading || imagesLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className={`text-center py-12 text-muted-foreground ${className}`}>
        <p>No images in this gallery yet.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      {title && (
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground">{title}</h2>
          {year && (
            <p className="text-sm text-muted-foreground mt-1">
              Gallery • {year} {galleries && galleries.length > 0 && `• ${images.length} photos`}
            </p>
          )}
        </div>
      )}

      {/* Thumbnail Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
        {imageUrls.map((image, index) => (
          <button
            key={image.id}
            onClick={() => setSelectedImageIndex(index)}
            className="group relative overflow-hidden rounded-lg aspect-square bg-muted hover:bg-accent transition-all duration-300 transform hover:scale-105 cursor-pointer shadow-md hover:shadow-lg"
          >
            <img
              src={image.url}
              alt={`Gallery image ${index + 1}`}
              className="w-full h-full object-cover group-hover:brightness-75 transition-all duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 3a7 7 0 100 14 7 7 0 000-14zm3.5 7a.5.5 0 11-1 0 .5.5 0 011 0zm-7 0a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImageIndex !== null && (
        <Dialog open={selectedImageIndex !== null} onOpenChange={() => setSelectedImageIndex(null)}>
          <DialogContent className="max-w-4xl w-full max-h-[90vh] p-0 border-0 bg-black/95">
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              {/* Close Button */}
              <button
                onClick={() => setSelectedImageIndex(null)}
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              {/* Image Counter */}
              <div className="absolute top-4 left-4 text-white text-sm font-medium bg-black/50 px-3 py-2 rounded">
                {selectedImageIndex + 1} / {imageUrls.length}
              </div>

              {/* Main Image */}
              <div className="relative w-full h-[70vh] flex items-center justify-center flex-1">
                <img
                  src={imageUrls[selectedImageIndex].url}
                  alt={`Gallery image ${selectedImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              {/* Navigation */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-6 bg-gradient-to-t from-black to-transparent">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setSelectedImageIndex((prev) =>
                      prev === null ? null : prev === 0 ? imageUrls.length - 1 : prev - 1
                    )
                  }
                  className="text-white hover:bg-white/20"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>

                <div className="flex gap-2 flex-wrap justify-center max-w-2xl">
                  {imageUrls.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === selectedImageIndex ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/75'
                      }`}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setSelectedImageIndex((prev) =>
                      prev === null ? null : prev === imageUrls.length - 1 ? 0 : prev + 1
                    )
                  }
                  className="text-white hover:bg-white/20"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </div>

              {/* Keyboard Navigation Help */}
              <div className="absolute bottom-4 text-xs text-white/50 text-center">
                Use arrow keys or click buttons to navigate
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default PublicGallery;
