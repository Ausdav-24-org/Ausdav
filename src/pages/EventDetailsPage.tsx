import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

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

interface GalleryImageRow {
  id: string;
  file_path: string;
  caption: string | null;
  sort_order: number | null;
}

interface GalleryRow {
  id: string;
  event_id: string;
  year: number;
  title: string | null;
  description_en: string | null;
  description_ta: string | null;
  gallery_images: GalleryImageRow[];
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
            gallery_images (id, file_path, caption, sort_order)
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

  const activeImages = useMemo(() => {
    if (!activeGallery) return [] as GalleryImageRow[];
    return [...(activeGallery.gallery_images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [activeGallery]);

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

      {/* Gallery Section */}
      {activeGallery && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon className="w-5 h-5" />
            <h2 className="text-2xl font-semibold">
              {language === 'ta' ? 'கேலரி' : 'Gallery'} — {activeGallery.year}
            </h2>
          </div>

          {(activeGallery.description_en || activeGallery.description_ta) && (
            <p className="text-muted-foreground mb-5">
              {language === 'ta' && activeGallery.description_ta ? activeGallery.description_ta : activeGallery.description_en}
            </p>
          )}

          {activeImages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {activeImages.map((image) => {
                const publicUrl = supabase.storage.from('event-gallery').getPublicUrl(image.file_path).data.publicUrl;
                return (
                  <Card key={image.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <img
                        src={publicUrl}
                        alt={image.caption || 'Gallery image'}
                        className="w-full h-48 object-cover hover:scale-105 transition-transform duration-200 cursor-pointer"
                        onClick={() => window.open(publicUrl, '_blank')}
                      />
                      {image.caption && (
                        <div className="p-3">
                          <p className="text-sm text-muted-foreground">{image.caption}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-60" />
              <p>{language === 'ta' ? 'படங்கள் இல்லை' : 'No images available'}</p>
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
                <span className="text-xs text-muted-foreground">({g.gallery_images?.length || 0})</span>
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

export default EventDetailsPage;
