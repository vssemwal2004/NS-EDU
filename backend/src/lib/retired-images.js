import { cloudinaryConfig, cloudinaryFolder } from './cloudinary.js';

/**
 * Images stored by an earlier Cloudinary account of ours that no longer serves them (the old
 * account was deactivated and answers 401). They are recognised by shape: a Cloudinary delivery
 * URL under our own folder (gyaan-vidhya/…) on a cloud other than the one configured now.
 * Images on universities' own Cloudinary accounts never use our folder, so they are never matched.
 *
 * Pages hide such links (liveImage) so students see the designed fallbacks instead of broken
 * images, and `npm run images:rebuild` / `scrape enrich-images --retired` replace them for good.
 */
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function isRetiredImage(url) {
  if (typeof url !== 'string' || !url.startsWith('https://res.cloudinary.com/')) return false;
  // Any transformation and version segments may sit between /upload/ and our folder.
  const ours = new RegExp(`^https://res\\.cloudinary\\.com/([^/]+)/image/upload/(?:[^/]+/)*?${escape(cloudinaryFolder())}/`).exec(url);
  return Boolean(ours) && ours[1] !== cloudinaryConfig().cloudName;
}

/** The URL when it still loads, else '' (so the page shows its fallback). */
export const liveImage = (url) => (isRetiredImage(url) ? '' : (url || ''));

/** A MongoDB regex matching retired image URLs, for selecting the records that need new images. */
export function retiredImagePattern() {
  const current = cloudinaryConfig().cloudName;
  const notCurrent = current ? `(?!${escape(current)}/)` : '';
  return new RegExp(`^https://res\\.cloudinary\\.com/${notCurrent}[^/]+/image/upload/(?:[^/]+/)*?${escape(cloudinaryFolder())}/`);
}
