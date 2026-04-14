import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ArrowLeft, Share2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
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
  embed_codes?: Record<string, string>; // Facebook embed codes {1: code, 2: code}
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
  const [selectedPost, setSelectedPost] = useState<string>('1');

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
            embed_codes,
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

  // Reset selected post to #1 when gallery changes
  React.useEffect(() => {
    setSelectedPost('1');
  }, [activeGallery?.id]);

  // Reparse Facebook SDK when post changes
  React.useEffect(() => {
    // Use small delay to ensure DOM is fully rendered before Facebook SDK parses
    const timer = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (win.FB?.XFBML?.parse) {
        try {
          win.FB.XFBML.parse();
        } catch (error) {
          // Suppress non-fatal Facebook SDK errors (element attachment timing issues)
          console.debug('Facebook SDK parse error (non-fatal):', error);
        }
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [selectedPost]);

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

      {/* Facebook Embeds Section - Only for this event's year */}
      {activeGallery && activeGallery.embed_codes && Object.keys(activeGallery.embed_codes).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-12">
          {/* Section Header */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-primary/30">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Share2 className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {language === 'ta' ? 'பக்க பதிவுகள்' : 'Facebook Posts'} — {activeGallery.year}
            </h2>
          </div>

          {/* Post Tabs */}
          <div className="flex gap-3 mb-8 flex-wrap">
            {Object.keys(activeGallery.embed_codes)
              .sort((a, b) => parseInt(a) - parseInt(b))
              .map((number) => (
                <button
                  key={number}
                  onClick={() => setSelectedPost(number)}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                    selectedPost === number
                      ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/40 scale-105'
                      : 'bg-secondary/60 text-secondary-foreground hover:bg-secondary/80 hover:shadow-md border border-secondary'
                  }`}
                >
                  <span className="inline-block">{language === 'ta' ? 'பின்னணி' : 'Post'} #{number}</span>
                </button>
              ))}
          </div>

          {/* Selected Post Display */}
          <motion.div
            key={selectedPost}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-br from-card via-card to-card/50 rounded-2xl border-2 border-primary/20 p-6 shadow-2xl hover:shadow-3xl transition-shadow duration-300"
          >
            {/* Post Badge */}
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-primary/20 to-primary/10 text-primary font-bold rounded-full text-sm border border-primary/30">
                {language === 'ta' ? 'பின்னணி' : 'Post'} #{selectedPost}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {`${Object.keys(activeGallery.embed_codes).length} posts available`}
              </span>
            </div>

            {/* Facebook Embed Container */}
            <div className="w-full overflow-hidden rounded-xl min-h-96 bg-white/5 border border-border/20 p-2">
              <div
                id={`fb-embed-${id}-${selectedPost}`}
                className="w-full flex justify-center"
                dangerouslySetInnerHTML={{ __html: activeGallery.embed_codes[selectedPost] }}
              />
            </div>
          </motion.div>
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
                <span className="text-xs text-muted-foreground">({Object.keys(g.embed_codes || {}).length})</span>
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
