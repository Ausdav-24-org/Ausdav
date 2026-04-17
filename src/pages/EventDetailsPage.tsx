import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowLeft, Share2, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { extractImagesFromFacebookPosts } from '@/utils/facebookImageExtractor';

interface EventRow {
  id: string;
  title_en: string;
  title_ta: string | null;
  description_en: string | null;
  description_ta: string | null;
  event_date: string;
  location: string | null;
  is_active: boolean;
  image_bucket: string | null;
  image_path: string | null;
}

interface GalleryRow {
  id: string;
  event_id: string;
  year: number;
  title: string | null;
  description_en: string | null;
  description_ta: string | null;
  post_urls?: Record<string, string>; // Facebook post URLs {1: url, 2: url}
}

const buildPublicUrl = (bucket: string, path: string | null) => {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
};

const EventDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { data: event, isLoading: eventLoading, error: eventError } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      if (!id) throw new Error('Event ID is required');
      const { data, error } = await (supabase as any)
        .from('events')
        .select('id,title_en,title_ta,description_en,description_ta,event_date,location,is_active,image_bucket,image_path')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as EventRow;
    },
    enabled: !!id,
  });

  const { data: galleries = [], isLoading: galleriesLoading } = useQuery({
    queryKey: ['event-galleries', id],
    queryFn: async () => {
      if (!id) return [] as GalleryRow[];
      try {
        const { data, error } = await (supabase as any)
          .from('galleries')
          .select(`
            id,
            event_id,
            year,
            title,
            description_en,
            description_ta,
            post_urls
          `)
          .eq('event_id', id)
          .order('year', { ascending: false });
        if (error) throw error;
        return (data || []) as unknown as GalleryRow[];
      } catch (error: any) {
        // If table is missing (remote-only), just return empty so UI still renders event
        if (error?.message?.includes('relation "galleries" does not exist')) return [] as GalleryRow[];
        throw error;
      }
    },
    enabled: !!id,
  });

  const orderedGalleries = useMemo(() => {
    const sorted = [...galleries].sort((a, b) => b.year - a.year);
    return sorted;
  }, [galleries]);

  const activeGallery = useMemo(() => {
    if (!orderedGalleries.length) return null;
    if (selectedYear) return orderedGalleries.find(g => g.year === selectedYear) || orderedGalleries[0];
    return orderedGalleries[0];
  }, [orderedGalleries, selectedYear]);

  // Fetch images from Facebook post URLs
  const { data: galleryImages = [], isLoading: imagesLoading } = useQuery({
    queryKey: ['event-gallery-images', activeGallery?.id],
    queryFn: async () => {
      if (!activeGallery?.post_urls || Object.keys(activeGallery.post_urls).length === 0) {
        return [];
      }

      const images = await extractImagesFromFacebookPosts(activeGallery.post_urls);
      return images;
    },
    enabled: !!activeGallery?.post_urls,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  if (eventLoading) {
    return (
      <div className="container mx-auto px-4 pt-28 pb-12">
        <div className="text-center">Loading event details...</div>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="container mx-auto px-4 pt-28 pb-12">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Event not found</h1>
          <Button asChild>
            <Link to="/events">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Events
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const coverImage = buildPublicUrl(event.image_bucket || 'events', event.image_path);
  const eventTitle = language === 'ta' && event.title_ta ? event.title_ta : event.title_en;
  const eventDesc = language === 'ta' && event.description_ta ? event.description_ta : event.description_en;

  return (
    <div className="container mx-auto px-4 pt-28 pb-12">
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link to="/events">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {language === 'ta' ? 'நிகழ்வுகளுக்கு திரும்பு' : 'Back to Events'}
          </Link>
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        {/* <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(event.event_date).toLocaleDateString(language === 'en' ? 'en-US' : 'ta-LK', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </Badge>
          {event.location && (
            <Badge variant="outline" className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {event.location}
            </Badge>
          )}
        </div> */}

        <h1 className="text-4xl font-bold mb-4">{eventTitle}</h1>

        {eventDesc && (
          <p className="text-lg text-muted-foreground mb-6">{eventDesc}</p>
        )}

        {coverImage && (
          <div className="mb-8 overflow-hidden rounded-xl shadow-lg">
            <img
              src={coverImage}
              alt={eventTitle}
              className="w-full h-64 md:h-80 lg:h-96 object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
              onClick={() => window.open(coverImage, '_blank')}
            />
          </div>
        )}
      </motion.div>

      {/* Facebook Gallery Section - Images Fetched from Post URLs */}
      {activeGallery && activeGallery.post_urls && Object.keys(activeGallery.post_urls).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-12">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-primary/30">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Share2 className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {language === 'ta' ? 'படங்கள்' : 'Gallery'} — {activeGallery.year}
            </h2>
          </div>

          {/* Loading State */}
          {imagesLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">
                {language === 'ta' ? 'படங்களை பெறுகிறது...' : 'Loading images...'}
              </span>
            </div>
          )}

          {/* Images Grid */}
          {!imagesLoading && galleryImages.length > 0 && (
            <FacebookGalleryGrid images={galleryImages} language={language} />
          )}

          {/* Empty State */}
          {!imagesLoading && galleryImages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
              <p className="font-medium mb-2">{language === 'ta' ? 'விரைவில் வரும்' : 'Coming Soon'}</p>
              <p className="text-sm">
                {language === 'ta' ? 'இந்த கேலரிக்கான படங்கள் விரைவில் சேர்க்கப்படும்.' : 'Images will be added to this gallery soon.'}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Gallery years pagination */}
      {orderedGalleries.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-3">{language === 'ta' ? 'கேலரி வருடங்கள்' : 'Gallery Years'}</h3>
          <div className="flex flex-wrap gap-2">
            {orderedGalleries.map((g) => (
              <Button
                key={g.year}
                variant={g.year === (activeGallery?.year || orderedGalleries[0].year) ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedYear(g.year)}
                className="flex items-center gap-2"
              >
                {g.year}
                <span className="text-xs text-muted-foreground">({Object.keys(g.post_urls || {}).length})</span>
              </Button>
            ))}
          </div>
        </motion.div>
      )}

      {galleriesLoading && (
        <div className="text-sm text-muted-foreground mt-4">Loading gallery…</div>
      )}
    </div>
  );
};

// Gallery Grid Component with Image Preview Modal
interface FacebookGalleryGridProps {
  images: Array<{ postUrl: string; imageUrl: string }>;
  language: string;
}

const FacebookGalleryGrid: React.FC<FacebookGalleryGridProps> = ({ images, language }) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  return (
    <>
      {/* Images Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
        {images.map((image, index) => (
          <div
            key={`${image.postUrl}-${index}`}
            className="group relative overflow-hidden rounded-lg aspect-square bg-muted hover:bg-accent transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
          >
            <img
              src={image.imageUrl}
              alt={`Gallery image ${index + 1}`}
              className="w-full h-full object-cover group-hover:brightness-75 transition-all duration-300 cursor-pointer"
              loading="lazy"
              onClick={() => setSelectedImageIndex(index)}
              onError={(e) => {
                // Fallback to a placeholder if image fails to load
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E';
              }}
            />
            
            {/* Overlay with icons and button */}
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40">
              {/* View icon (top center) */}
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 3a7 7 0 100 14 7 7 0 000-14zm3.5 7a.5.5 0 11-1 0 .5.5 0 011 0zm-7 0a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
              </div>
              
              {/* View More Button (bottom) */}
              <a
                href={image.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                {language === 'ta' ? 'மேலும்' : 'More'}
              </a>
            </div>
          </div>
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
                {selectedImageIndex + 1} / {images.length}
              </div>

              {/* Main Image */}
              <div className="relative w-full h-[70vh] flex items-center justify-center flex-1">
                <img
                  src={images[selectedImageIndex].imageUrl}
                  alt={`Gallery image ${selectedImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              {/* Navigation and View More */}
              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center p-6 bg-gradient-to-t from-black to-transparent">
                {/* View More Button */}
                <a
                  href={images[selectedImageIndex].postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-6"
                >
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    {language === 'ta' ? 'மேலும் பார்க்க' : 'View More'}
                  </Button>
                </a>

                {/* Navigation Controls */}
                <div className="flex items-center justify-between gap-6 w-full">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setSelectedImageIndex((prev) =>
                        prev === null ? null : prev === 0 ? images.length - 1 : prev - 1
                      )
                    }
                    className="text-white hover:bg-white/20"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>

                  <div className="flex gap-2 flex-wrap justify-center max-w-2xl">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === selectedImageIndex ? 'bg-white w-8' : 'bg-white/50 hover:bg-white/75'
                        }`}
                      />
                    ))}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setSelectedImageIndex((prev) =>
                        prev === null ? null : prev === images.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="text-white hover:bg-white/20"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default EventDetailsPage;
