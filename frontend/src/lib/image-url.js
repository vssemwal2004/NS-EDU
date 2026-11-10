// Smaller copies of our Cloudinary images come from Next's own image optimiser (/_next/image),
// never from Cloudinary URL transformations (c_fill, w_…, f_auto…). Cloudinary bills every
// transformation against the plan; on the Free plan (25 credits a month) admin thumbnails and
// tiles over thousands of images used it up, and the first account was disabled in Nov 2026.
// Next fetches the original once, resizes it on our server and caches it.

// Next 16 defaults: imageSizes 32…384 plus deviceSizes 640…3840, and quality 75 only.
const WIDTHS = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920];

export const isCloudinary = (url) => typeof url === 'string' && url.startsWith('https://res.cloudinary.com/');

// Campus photographs are stored on Cloudflare R2. NEXT_PUBLIC_IMAGE_HOST is the host of that bucket's
// public address (e.g. pub-xxxx.r2.dev or images.example.com); next.config.mjs allows exactly that host.
const IMAGE_HOST = process.env.NEXT_PUBLIC_IMAGE_HOST || '';
export const isStoredImage = (url) => typeof url === 'string' && Boolean(IMAGE_HOST) && url.startsWith(`https://${IMAGE_HOST}/`);

/** Images next/image can fetch and resize: Cloudinary uploads and our R2 bucket. */
export const isOptimisable = (url) => isCloudinary(url) || isStoredImage(url);

/** A resized copy of one of our images at least `width` px wide; any other URL is returned as is. */
export function resizedImage(url, width) {
  if (!isOptimisable(url)) return url || '';
  const size = WIDTHS.find((candidate) => candidate >= width) ?? WIDTHS.at(-1);
  return `/_next/image?url=${encodeURIComponent(url)}&w=${size}&q=75`;
}
