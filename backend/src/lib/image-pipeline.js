// Download → verify → compress → upload. One path for every picture the scraper re-hosts, so a
// stored image is always one we fetched from the institution's own domain, decoded ourselves and
// re-encoded small. Nothing here throws into the crawl: a picture that fails is skipped and logged.
import { cloudinaryConfig, cloudinaryFolder, uploadImage } from './cloudinary.js';

export const IMAGE_LIMITS = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  timeoutMs: 15_000,
  minWidth: 480,
  minHeight: 320,
  maxWidth: 1600,
  minAspect: 1.2,
  maxAspect: 2.4,
  quality: 78,
});

export const IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

// sharp is a native module; load it only when an image is actually processed so the rest of the
// scraper keeps working on a machine where it is not installed.
let sharpPromise;
export function loadSharp() {
  sharpPromise ??= import('sharp').then((module) => module.default).catch((error) => {
    sharpPromise = undefined;
    throw new Error(`sharp is required for the image pipeline but could not be loaded: ${error.message}`);
  });
  return sharpPromise;
}

export class ImageError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ImageError';
    this.code = code; // download | type | decode | too-small | shape | encode | upload | disabled
  }
}

/** Default downloader for standalone use. The crawler passes its polite fetcher instead. */
export function plainDownloader({ fetchImpl = globalThis.fetch, userAgent = 'GyaanVidhyaBot/1.0' } = {}) {
  return async (url, { maxBytes = IMAGE_LIMITS.maxBytes, timeoutMs = IMAGE_LIMITS.timeoutMs } = {}) => {
    const response = await fetchImpl(url, { headers: { 'user-agent': userAgent, accept: 'image/*' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
    if (!response.ok) throw new ImageError(`HTTP ${response.status}`, 'download');
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > maxBytes) throw new ImageError('Larger than the size limit', 'download');
    return { contentType, body };
  };
}

/**
 * Decodes the bytes, checks that this really is a usable photograph, strips metadata and
 * re-encodes it small. Photos become WebP; a logo keeps PNG only when it actually has transparency.
 * @returns {Promise<{ data: Buffer, format: string, width: number, height: number }>}
 */
export async function prepareImage(bytes, { kind = 'photo', limits = IMAGE_LIMITS } = {}) {
  const sharp = await loadSharp();
  let image = sharp(bytes, { failOn: 'error', animated: false });
  let meta;
  try { meta = await image.metadata(); } catch (error) { throw new ImageError(`Could not decode the image: ${error.message}`, 'decode'); }
  // EXIF orientations 5–8 turn the picture a quarter turn, so the stored width and height are the
  // wrong way round. Measure what the viewer will see, or a portrait photo passes the shape check.
  const turned = (meta.orientation ?? 0) >= 5;
  const width = (turned ? meta.height : meta.width) ?? 0;
  const height = (turned ? meta.width : meta.height) ?? 0;
  if (!width || !height) throw new ImageError('The image has no readable dimensions', 'decode');
  if (kind === 'photo') {
    if (width < limits.minWidth || height < limits.minHeight) throw new ImageError(`Too small (${width}×${height})`, 'too-small');
    const aspect = width / height;
    if (aspect < limits.minAspect || aspect > limits.maxAspect) throw new ImageError(`Wrong shape (${aspect.toFixed(2)}:1)`, 'shape');
  }
  // rotate() with no argument applies the EXIF orientation and then drops the EXIF block.
  image = image.rotate();
  if (width > limits.maxWidth) image = image.resize({ width: limits.maxWidth, withoutEnlargement: true });
  const keepPng = kind === 'logo' && Boolean(meta.hasAlpha);
  const encoded = keepPng
    ? image.png({ compressionLevel: 9, palette: true })
    : image.webp({ quality: limits.quality, effort: 4 });
  let data;
  try { data = await encoded.toBuffer(); } catch (error) { throw new ImageError(`Could not re-encode the image: ${error.message}`, 'encode'); }
  const finalWidth = Math.min(width, limits.maxWidth);
  return { data, format: keepPng ? 'png' : 'webp', width: finalWidth, height: Math.round((height * finalWidth) / width) };
}

/**
 * The pipeline the crawler and the enrich-images CLI both use.
 * @param {{ download: (url: string, options?: object) => Promise<{contentType: string, body: Buffer}>,
 *           upload?: Function, enabled?: boolean, log?: Function, limits?: object }} options
 */
export function createImagePipeline({ download, upload = uploadImage, enabled, log = () => {}, limits = IMAGE_LIMITS } = {}) {
  const ready = enabled ?? cloudinaryConfig().configured;
  const stats = { attempted: 0, uploaded: 0, skipped: 0, failed: 0, originalBytes: 0, compressedBytes: 0, reasons: {} };
  const note = (code) => { stats.reasons[code] = (stats.reasons[code] ?? 0) + 1; };

  /**
   * One image, end to end. Returns null when it is not usable — never throws at the caller.
   * @param {{ url: string, slug: string, kind?: 'photo'|'logo', index?: number, caption?: string, sourcePage?: string, domain?: string }} input
   */
  async function process({ url, slug, kind = 'photo', index = 1, caption = '', sourcePage = '', domain = '' }) {
    if (!ready) { stats.skipped += 1; note('disabled'); return null; }
    if (!slug) { stats.skipped += 1; note('no-slug'); return null; }
    stats.attempted += 1;
    try {
      const { contentType, body } = await download(url, { maxBytes: limits.maxBytes, timeoutMs: limits.timeoutMs, types: IMAGE_TYPES, domain });
      if (contentType && !IMAGE_TYPES.includes(contentType)) throw new ImageError(`Not an image (${contentType})`, 'type');
      if (!body?.byteLength) throw new ImageError('Empty response', 'download');
      const prepared = await prepareImage(body, { kind, limits });
      const result = await upload(prepared.data, {
        folder: `${cloudinaryFolder()}/universities/${slug}`,
        publicId: `${kind}-${index}`,
        overwrite: true,
        tags: ['scrape', kind],
      });
      if (!result?.secure_url) throw new ImageError('Cloudinary returned no URL', 'upload');
      stats.uploaded += 1;
      stats.originalBytes += body.byteLength;
      stats.compressedBytes += prepared.data.byteLength;
      return {
        url: result.secure_url,
        width: result.width ?? prepared.width,
        height: result.height ?? prepared.height,
        bytes: prepared.data.byteLength,
        originalBytes: body.byteLength,
        ...(caption ? { caption } : {}),
        credit: 'official website',
        ...(sourcePage ? { sourcePage } : {}),
      };
    } catch (error) {
      const code = error?.code ?? 'error';
      if (['too-small', 'shape', 'type', 'decode', 'not-allowed-type'].includes(code)) stats.skipped += 1;
      else stats.failed += 1;
      note(code);
      log(`image skipped <${url}> — ${error.message}`);
      return null;
    }
  }

  /** Works through candidates in order and stops once `want` images have been stored. */
  async function processMany(candidates, { slug, kind = 'photo', want = 8, startIndex = 1, domain = '' }) {
    const stored = [];
    for (const candidate of candidates) {
      if (stored.length >= want) break;
      const item = await process({ domain, ...candidate, slug, kind, index: startIndex + stored.length });
      if (item) stored.push(item);
    }
    return stored;
  }

  return { process, processMany, stats, enabled: ready };
}

export const compressionRatio = (stats) => (stats.originalBytes ? stats.compressedBytes / stats.originalBytes : 1);
