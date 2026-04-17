import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import PublicGallery from '@/components/PublicGallery';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type GalleryRow = {
  id: string;
  event_id: number;
  year: number;
  title: string | null;
};

export default function EventGalleryPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || '0', 10);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseDb = supabase as unknown as SupabaseClient<any, any, any, any>;

  // Fetch all galleries for this event
  const { data: galleries, isLoading } = useQuery({
    queryKey: ['event-galleries', eventId],
    queryFn: async () => {
      const { data, error } = await (supabaseDb as any)
        .from('galleries')
        .select('id, event_id, year, title')
        .eq('event_id', eventId)
        .order('year', { ascending: false });

      if (error) throw error;
      return (data as GalleryRow[]) || [];
    },
    enabled: eventId > 0,
  });

  // Set default selected year to most recent
  React.useEffect(() => {
    if (galleries && galleries.length > 0 && selectedYear === null) {
      setSelectedYear(galleries[0].year);
    }
  }, [galleries, selectedYear]);

  const selectedGallery = galleries?.find((g) => g.year === selectedYear);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-8 md:py-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-8 md:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Event Galleries
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Explore photos from our university events and activities. Click on any image to view it in full screen.
          </p>
        </div>

        {/* Year Tabs/Buttons */}
        {galleries && galleries.length > 0 ? (
          <>
            <div className="mb-8 flex flex-wrap gap-2">
              {galleries.map((gallery) => (
                <Button
                  key={gallery.year}
                  onClick={() => setSelectedYear(gallery.year)}
                  variant={selectedYear === gallery.year ? 'default' : 'outline'}
                  className="px-6 py-2"
                >
                  {gallery.year}
                </Button>
              ))}
            </div>

            {/* Selected Gallery Display */}
            {selectedGallery ? (
              <div className="mb-16">
                <PublicGallery
                  eventId={eventId}
                  year={selectedGallery.year}
                  title={selectedGallery.title || `Gallery ${selectedGallery.year}`}
                  className="mb-4"
                />
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Please select a year to view galleries.</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No galleries available for this event yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}
