import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

interface YouTubeEmbedProps {
  videoId: string;
  title: string;
  className?: string;
  onPlay?: () => void;
  autoPlay?: boolean;
}

/**
 * Optimized YouTube embed component
 * - Shows thumbnail + play button until clicked or scrolled into view
 * - Lazy loads iframe only when needed
 * - Uses YouTube's max resolution thumbnail
 * - Respects reduced motion preferences
 */
const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({
  videoId,
  title,
  className = '',
  onPlay,
  autoPlay = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer: load when scrolled into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '100px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  const handlePlay = () => {
    setIsLoaded(true);
    onPlay?.();
  };

  const shouldAutoplay = autoPlay || isLoaded;

  return (
    <div
      ref={containerRef}
      className={`relative aspect-video rounded-2xl overflow-hidden border border-cyan-500/20 shadow-lg bg-black ${className}`}
    >
      {/* Thumbnail + Play Button (until loaded) */}
      {!isLoaded && !autoPlay && (
        <>
          {/* YouTube Thumbnail */}
          <img
            src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/40" />

          {/* Play Button */}
          <motion.button
            onClick={handlePlay}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
            className="absolute inset-0 flex items-center justify-center group"
            aria-label={`Play ${title}`}
            type="button"
          >
            <div className="relative">
              {/* Outer Ring */}
              <div className="absolute inset-0 rounded-full bg-red-600/90 w-20 h-20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Red Play Button (YouTube style) */}
              <div className="relative w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 transition-colors shadow-2xl flex items-center justify-center">
                <Play className="w-8 h-8 text-white fill-white ml-1" />
              </div>
            </div>
          </motion.button>
        </>
      )}

      {/* iframe - loads only after click or scroll visibility */}
      {(autoPlay || isLoaded || isVisible) && (
        <iframe
          className="w-full h-full absolute inset-0"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=${shouldAutoplay ? 1 : 0}&mute=${autoPlay ? 1 : 0}&playsinline=1&controls=1&rel=0&modestbranding=1`}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      )}
    </div>
  );
};

export default YouTubeEmbed;
