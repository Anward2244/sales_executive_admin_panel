import React, { useState, useEffect, useRef } from 'react';
import { getImageUrl, DEFAULT_FALLBACK_IMAGE } from '@/utils/imageUtils';

/**
 * Optimized Image component for products, thumbnails, and catalog media.
 * Supports Cloudinary compression, lazy loading, async decoding, automatic retry, and graceful error fallback.
 */
export const OptimizedImage = ({
  src,
  alt = '',
  className = '',
  width = 300,
  quality = 60,
  isOriginal = false,
  fallback = DEFAULT_FALLBACK_IMAGE,
  onError,
  lowQuality = false,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false);
  const [hasRetried, setHasRetried] = useState(false);
  const retryTimeoutRef = useRef(null);
  const imgRef = useRef(null);

  const resolvedUrl = src ? getImageUrl(src, { width, quality, isOriginal }) : fallback;
  const [currentSrc, setCurrentSrc] = useState(resolvedUrl);

  useEffect(() => {
    setHasRetried(false);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    
    const newUrl = src ? getImageUrl(src, { width, quality, isOriginal }) : fallback;
    setCurrentSrc(newUrl);

    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [src, width, quality, isOriginal, fallback]);

  const handleError = (e) => {
    // If not retried yet and src exists, attempt a single retry after 400ms (fixes transient connection misses)
    if (!hasRetried && src) {
      setHasRetried(true);
      retryTimeoutRef.current = setTimeout(() => {
        const directUrl = getImageUrl(src, { isOriginal: true });
        // Append a minor cache-buster if direct was identical
        const retryUrl = directUrl === currentSrc 
          ? `${directUrl}${directUrl.includes('?') ? '&' : '?'}t=${Date.now()}` 
          : directUrl;
        setCurrentSrc(retryUrl);
      }, 400);
      return;
    }

    // Final fallback to placeholder
    setCurrentSrc(fallback);
    if (onError) onError(e);
  };

  return (
    <img
      ref={imgRef}
      src={currentSrc || fallback}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={handleError}
      className={`transition-opacity duration-300 ${!loaded ? 'opacity-40' : 'opacity-100'} ${lowQuality ? 'image-rendering-pixelated' : ''} ${className}`}
      {...props}
    />
  );
};

export const ProgressiveImage = OptimizedImage;
export default OptimizedImage;
