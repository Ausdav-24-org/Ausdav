import React, { useState, useEffect } from "react";

interface ResponsiveImageProps {
  src: string;
  alt: string;
  webpSrc?: string;
  className?: string;
  loading?: "lazy" | "eager";
  priority?: boolean;
  onLoad?: () => void;
}

/**
 * ✅ OptimizedImage Component
 * 
 * Features:
 * - Lazy loading with Intersection Observer
 * - WebP format support with PNG fallback
 * - Responsive sizing
 * - Loading state management
 * - Automatic LQIP (Low Quality Image Placeholder) effect
 */
export const OptimizedImage: React.FC<ResponsiveImageProps> = ({
  src,
  webpSrc,
  alt,
  className = "",
  loading = "lazy",
  priority = false,
  onLoad,
}) => {
  const [isLoaded, setIsLoaded] = useState(!loading || priority);
  const [imageSrc, setImageSrc] = useState<string | null>(priority ? src : null);

  useEffect(() => {
    if (priority) {
      setImageSrc(src);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setImageSrc(src);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "50px" }
    );

    const img = document.getElementById(`img-${src}`);
    if (img) {
      observer.observe(img);
    }

    return () => {
      if (img) observer.unobserve(img);
    };
  }, [src, priority]);

  return (
    <picture>
      {webpSrc && imageSrc && (
        <source srcSet={webpSrc} type="image/webp" />
      )}
      <img
        id={`img-${src}`}
        src={imageSrc || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"}
        alt={alt}
        className={`${className} ${!isLoaded ? "opacity-0" : "opacity-100"} transition-opacity duration-500`}
        loading={loading}
        onLoad={() => {
          setIsLoaded(true);
          onLoad?.();
        }}
      />
    </picture>
  );
};

export default OptimizedImage;
