import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  placeholderClassName?: string;
  ratio?: 'square' | 'video' | 'none'; // aspect ratio preset
  onLoad?: () => void;
  onError?: () => void;
  loading?: 'lazy' | 'eager';
  preloadMargin?: string; // e.g., "100px", "50%"
}

/**
 * LazyImage Component - Efficiently loads images only when visible
 * 
 * Features:
 * - Intersection Observer for viewport detection
 * - Shows skeleton/placeholder while loading
 * - Smooth fade-in animation
 * - Error handling with fallback
 * - Aspect ratio support
 * 
 * Usage:
 * <LazyImage 
 *   src="/path/to/image.jpg" 
 *   alt="Description"
 *   ratio="video"
 *   className="rounded-lg"
 * />
 */
export const LazyImage = React.forwardRef<HTMLImageElement, LazyImageProps>(
  (
    {
      src,
      alt,
      className = '',
      containerClassName = '',
      placeholderClassName = '',
      ratio = 'none',
      onLoad,
      onError,
      loading = 'lazy',
      preloadMargin = '100px',
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(loading === 'eager');
    const [hasError, setHasError] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // Combine refs
    React.useImperativeHandle(ref, () => imgRef.current as HTMLImageElement);

    // Setup Intersection Observer for lazy loading
    useEffect(() => {
      if (loading === 'eager') return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              if (containerRef.current) {
                observer.unobserve(containerRef.current);
              }
            }
          });
        },
        {
          rootMargin: preloadMargin,
        }
      );

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      return () => {
        if (containerRef.current) {
          observer.unobserve(containerRef.current);
        }
      };
    }, [loading, preloadMargin]);

    const handleLoad = () => {
      if (onLoad) onLoad();
    };

    const handleError = () => {
      setHasError(true);
      if (onError) onError();
    };

    // Aspect ratio classes
    const aspectRatioClass = {
      square: 'aspect-square',
      video: 'aspect-video',
      none: '',
    }[ratio];

    return (
      <div
        ref={containerRef}
        className={cn('relative overflow-hidden bg-gray-200 dark:bg-gray-700', aspectRatioClass, containerClassName)}
      >
        {/* Skeleton Placeholder */}
        {!isVisible && (
          <div
            className={cn(
              'absolute inset-0 animate-pulse bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-600 dark:via-gray-700 dark:to-gray-600',
              placeholderClassName
            )}
          />
        )}

        {/* Error Fallback */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-300 dark:bg-gray-600">
            <svg
              className="w-12 h-12 text-gray-500 dark:text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        {/* Actual Image */}
        {isVisible && !hasError && (
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className={cn('w-full h-full object-cover', className)}
            onLoad={handleLoad}
            onError={handleError}
            loading={loading === 'eager' ? undefined : 'lazy'}
          />
        )}
      </div>
    );
  }
);

LazyImage.displayName = 'LazyImage';

export default LazyImage;
