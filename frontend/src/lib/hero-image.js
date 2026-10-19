import { getImageProps } from 'next/image';

// Images come from the `media` content key: a site path or an https URL (e.g. Cloudinary).
// Site paths and Cloudinary go through the Next optimiser (images.remotePatterns); other hosts load as-is.
export const optimisable = (src) => src.startsWith('/') || src.startsWith('https://res.cloudinary.com/');

// `width` is the rendered size; the height keeps the entry's intrinsic aspect ratio.
export function mediaImage(image, width = image?.width) {
  if (!image?.src || !image.width || !image.height) return null;
  const height = Math.round((width * image.height) / image.width);
  return getImageProps({ src: image.src, width, height, alt: image.alt || '', unoptimized: !optimisable(image.src) }).props;
}

// Legacy callers outside the content provider (login drawer, admin sign-in) still call this without
// an entry; they should pass `media.hero` so this path can be removed with the local file.
const LEGACY_HERO = { src: '/images/approved-reference.png', width: 1672, height: 941, alt: 'Three students exploring their next chapter together in a university library' };

// Shared optimized source: the photo and campus decoration reuse one download.
export function getHeroImage(hero = LEGACY_HERO) {
  return mediaImage(hero, 840);
}
