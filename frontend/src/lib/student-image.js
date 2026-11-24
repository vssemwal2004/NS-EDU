import manifest from './student-image-manifest.json';

const cdnOrigins = new Set(Object.values(manifest).map((url) => new URL(url).origin));
if (process.env.NEXT_PUBLIC_IMAGE_HOST) cdnOrigins.add(`https://${process.env.NEXT_PUBLIC_IMAGE_HOST}`);
const companyPhotos = new Set(Object.entries(manifest).filter(([path]) => path.startsWith('/company/')).map(([, url]) => url));

export function studentImageUrl(src) {
  return typeof src === 'string' && Object.hasOwn(manifest, src) ? manifest[src] : src;
}

/** The bucket already serves compressed files. Avoid a second trip through the app's image optimiser. */
export function isStudentCdnImage(src) {
  if (typeof src !== 'string' || !src.startsWith('https://')) return false;
  try { return cdnOrigins.has(new URL(src).origin); } catch { return false; }
}

/** The publisher uploads the original and two smaller widths for each journal photo. */
export function companyImageSources(src, width) {
  const full = studentImageUrl(src);
  if (!companyPhotos.has(full)) return null;
  const sources = [480, 960].filter((size) => size < width)
    .map((size) => `${full.replace(/\.webp$/, `-${size}.webp`)} ${size}w`);
  return [...sources, `${full} ${width}w`].join(', ');
}
