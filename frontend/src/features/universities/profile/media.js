import Image from 'next/image';
import { isOptimisable } from '@/lib/image-url';

// Scraped photos are re-hosted on our own storage (R2, or the older Cloudinary account), which
// next/image can optimise. Anything still on an institution's own host is rendered as a plain <img>:
// next.config only allows our storage hosts.
export const isCloudinary = (url) => { try { return new URL(url).hostname === 'res.cloudinary.com'; } catch { return false; } };

/** Fills its (positioned, aspect-ratio'd) parent. No intrinsic size is known, so the box reserves space. */
export function Photo({ src, alt = '', sizes = '100vw', priority = false, className = '' }) {
  if (!src) return null;
  if (isOptimisable(src)) return <Image className={className} src={src} alt={alt} fill sizes={sizes} priority={priority} />;
  return <img className={className} src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async"
    fetchPriority={priority ? 'high' : undefined} referrerPolicy="no-referrer" />;
}
