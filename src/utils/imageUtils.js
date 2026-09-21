import { BASE_URL } from '../api/axios';

/**
 * Transforms image URLs to optimized URLs.
 * Supports Cloudinary native transformations, direct WordPress URLs, and backend uploads.
 */
export const getImageUrl = (path, options = {}) => {
  if (!path) return '';
  
  // If array was accidentally passed, use first item
  const rawPath = Array.isArray(path) ? path[0] : path;
  if (!rawPath || typeof rawPath !== 'string') return '';
  
  let trimmed = rawPath.trim();
  if (!trimmed) return '';

  // Clean out any legacy or nested i0.wp.com proxy prefixes
  if (trimmed.includes('i0.wp.com/')) {
    trimmed = 'https://' + trimmed.split('i0.wp.com/')[1].split('?')[0];
  }

  const { quality = 60, width = 300, isOriginal = false } = options;
  let fullUrl = '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    fullUrl = trimmed;
  } else {
    const cleanPath = trimmed.replace(/\\/g, '/');
    fullUrl = `${BASE_URL}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
  }

  // Upgrade insecure http URLs to https for known domains to avoid mixed-content blocking
  if (fullUrl.startsWith('http://') && !fullUrl.includes('localhost') && !fullUrl.includes('127.0.0.1')) {
    fullUrl = fullUrl.replace('http://', 'https://');
  }

  if (isOriginal || fullUrl.startsWith('blob:') || fullUrl.startsWith('data:')) {
    return fullUrl;
  }

  // Cloudinary native transformations (safe against duplicate transforms)
  if (fullUrl.includes('cloudinary.com') && fullUrl.includes('/upload/')) {
    // If it already has transformation segment, return as is
    if (/\/upload\/[a-z0-9_,]+\//i.test(fullUrl)) {
      return fullUrl;
    }
    const transforms = [width ? `w_${width}` : '', quality ? `q_${quality}` : '', 'c_limit'].filter(Boolean).join(',');
    return fullUrl.replace('/upload/', `/upload/${transforms}/`);
  }

  return fullUrl;
};

/**
 * Returns the unproxied direct URL for fallbacks
 */
export const getDirectImageUrl = (path) => {
  return getImageUrl(path, { isOriginal: true });
};

export const DEFAULT_FALLBACK_IMAGE = 'https://placehold.co/150x150/1e293b/94a3b8?text=No+Image';
