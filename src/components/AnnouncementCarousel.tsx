import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface Announcement {
  id: string | number;
  title: string;
  message: string;
  image_url?: string | null;
}

interface AnnouncementCarouselProps {
  announcements: Announcement[];
}

const MAX_PREVIEW_LENGTH = 140;

const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%231c1f2b'/><stop offset='100%' stop-color='%23343b52'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g)'/><circle cx='620' cy='120' r='120' fill='%235b6bff' opacity='0.25'/><circle cx='120' cy='360' r='140' fill='%23f4c85f' opacity='0.2'/></svg>";

const AnnouncementCarousel: React.FC<AnnouncementCarouselProps> = ({ announcements }) => {
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);

  const closeDialog = () => setActiveAnnouncement(null);

  return (
    <section className="py-6 relative">
      <div className="container mx-auto px-4">
        <div className="mb-3 sm:mb-4">
          <h2 className="text-sm sm:text-base font-semibold text-cyan-300 uppercase tracking-wide">Announcements</h2>
        </div>
        <Carousel
          opts={{
            align: 'start',
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {announcements.map((announcement, idx) => {
              const message = announcement.message || '';
              const isLongMessage = message.length > MAX_PREVIEW_LENGTH;
              const imageSrc = announcement.image_url || FALLBACK_IMAGE;

              return (
                <CarouselItem key={announcement.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                  >
                    <Card className="overflow-hidden bg-card/60 border-border/60 shadow-lg">
                      <div className="h-20 sm:h-32 md:h-40 w-full">
                        <img
                          src={imageSrc}
                          alt={announcement.title ? `${announcement.title} announcement image` : 'Announcement image'}
                          className="h-20 sm:h-32 md:h-40 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <CardContent className="p-3 sm:p-4 flex flex-col gap-2">
                        <h3 className="text-base font-semibold truncate" title={announcement.title}>
                          {announcement.title}
                        </h3>
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                        <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3">
                          {message}
                        </p>
                        {isLongMessage && (
                          <Button
                            variant="link"
                            className="px-0 text-primary"
                            onClick={() => setActiveAnnouncement(announcement)}
                            aria-label={`Learn more about ${announcement.title}`}
                          >
                            Learn more
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </CarouselItem>
              );
            })}
          </CarouselContent>

          <div className="flex items-center justify-end gap-2 mt-4">
            <CarouselPrevious className="static translate-y-0 glass-card border-border/30 hover:bg-primary/10 hover:text-primary" />
            <CarouselNext className="static translate-y-0 glass-card border-border/30 hover:bg-primary/10 hover:text-primary" />
          </div>
        </Carousel>
      </div>

      <Dialog
        open={!!activeAnnouncement}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeAnnouncement?.title}</DialogTitle>
          </DialogHeader>
          {activeAnnouncement && (
            <div className="space-y-4">
              <div className="w-full overflow-hidden rounded-lg border border-border/60">
                <img
                  src={activeAnnouncement.image_url || FALLBACK_IMAGE}
                  alt={activeAnnouncement.title ? `${activeAnnouncement.title} announcement image` : 'Announcement image'}
                  className="h-56 w-full object-cover"
                />
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {activeAnnouncement.message}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default AnnouncementCarousel;
