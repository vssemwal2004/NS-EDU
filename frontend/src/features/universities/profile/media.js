import Image from 'next/image';

// Scraped photos are re-hosted on Cloudinary (optimisable by next/image). Anything still on an
// institution's own host is rendered as a plain <img>: next.config only allows res.cloudinary.com.
export const isCloudinary = (url) => { try { return new URL(url).hostname === 'res.cloudinary.com'; } catch { return false; } };

/** Fills its (positioned, aspect-ratio'd) parent. No intrinsic size is known, so the box reserves space. */
export function Photo({ src, alt = '', sizes = '100vw', priority = false, className = '' }) {
  if (!src) return null;
  if (isCloudinary(src)) return <Image className={className} src={src} alt={alt} fill sizes={sizes} priority={priority} />;
  return <img className={className} src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async"
    fetchPriority={priority ? 'high' : undefined} referrerPolicy="no-referrer" />;
}
