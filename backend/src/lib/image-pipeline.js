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
  // Campus panoramas and section banners on modern sites run to about 2.5–2.7:1; banner strips
  // (3:1 and wider) are still refused.
  maxAspect: 2.7,
  quality: 78,
  // Charts, text slides and "admission open" posters are large flat areas of colour, while a
  // photograph is detail everywhere. Shannon entropy separates the two cleanly: campus photographs
  // measure around 6–7.5, a bar chart or a title slide around 2–4. The cut is deliberately low so
  // that a foggy or very plain photograph is still kept.
  minEntropy: 4.2,
  // Campus photographs older than this are refused when the file proves its age (see photoAge).
  maxAgeYears: 5,
});

// EXIF dates are ASCII "YYYY:MM:DD HH:MM:SS". The earliest one is when the picture was taken (a later
// one is an edit). "…:01:01 00:00:00" is the reset value of a camera whose clock was never set.
const EXIF_DATE = /(199\d|20[0-3]\d):(0[1-9]|1[0-2]):([0-2]\d|3[01]) ([01]\d|2[0-3]):[0-5]\d:[0-5]\d/g;
export function exifYear(exif) {
  if (!exif?.length) return null;
  const years = [...exif.toString('latin1').matchAll(EXIF_DATE)]
    .filter((match) => !/:01:01 00:00:00$/.test(match[0]))
    .map((match) => Number(match[1]));
  return years.length ? Math.min(...years) : null;
}

/**
 * How old a picture provably is: the camera's own date, else the server's Last-Modified date (a
 * file last changed in 2016 was taken no later than 2016). Neither date says a picture is new, so
 * an undated file is not refused.
 * @returns {{ takenYear: number|null, tooOld: boolean, evidence: string }}
 */
export function photoAge({ exif, lastModified, urlYear = null, now = new Date(), maxAgeYears = IMAGE_LIMITS.maxAgeYears }) {
  const oldest = now.getFullYear() - maxAgeYears;
  const taken = exifYear(exif);
  if (taken !== null && taken < oldest) return { takenYear: taken, tooOld: true, evidence: `taken in ${taken}` };
  const modified = lastModified ? new Date(lastModified) : null;
  const modifiedYear = modified && !Number.isNaN(modified.getTime()) ? modified.getFullYear() : null;
  if (modifiedYear !== null && modifiedYear < oldest) return { takenYear: taken ?? urlYear, tooOld: true, evidence: `file unchanged since ${modifiedYear}` };
  if (urlYear !== null && urlYear < oldest) return { takenYear: urlYear, tooOld: true, evidence: `dated ${urlYear} by its address` };
  return { takenYear: taken ?? urlYear, tooOld: false, evidence: '' };
}

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
    return { contentType, body, lastModified: response.headers.get('last-modified') ?? '' };
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
    // A chart or a notice reads as clutter where a campus should be, and no filename or alt text
    // gives it away — the picture itself has to be measured.
    const entropy = await image.stats().then((stats) => stats.entropy).catch(() => null);
    if (entropy !== null && entropy < limits.minEntropy) throw new ImageError(`Looks like a graphic, not a photograph (entropy ${entropy.toFixed(1)})`, 'not-a-photo');
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
  // The EXIF block is dropped from the stored copy; only the year it gave is kept, by the caller.
  return { data, format: keepPng ? 'png' : 'webp', width: finalWidth, height: Math.round((height * finalWidth) / width), exif: meta.exif ?? null };
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
  async function process({ url, slug, kind = 'photo', index = 1, caption = '', sourcePage = '', domain = '', year = null }) {
    if (!ready) { stats.skipped += 1; note('disabled'); return null; }
    if (!slug) { stats.skipped += 1; note('no-slug'); return null; }
    stats.attempted += 1;
    try {
      const { contentType, body, lastModified } = await download(url, { maxBytes: limits.maxBytes, timeoutMs: limits.timeoutMs, types: IMAGE_TYPES, domain });
      // An untyped or octet-stream response is decoded below; sharp refuses bytes that are not an image.
      if (contentType && !IMAGE_TYPES.includes(contentType) && !/^(application|binary)\/octet-stream$/.test(contentType)) throw new ImageError(`Not an image (${contentType})`, 'type');
      if (!body?.byteLength) throw new ImageError('Empty response', 'download');
      const prepared = await prepareImage(body, { kind, limits });
      let takenYear = null;
      if (kind === 'photo' && limits.maxAgeYears) {
        const age = photoAge({ exif: prepared.exif, lastModified, urlYear: year, maxAgeYears: limits.maxAgeYears });
        if (age.tooOld) throw new ImageError(`Older than ${limits.maxAgeYears} years (${age.evidence})`, 'too-old');
        takenYear = age.takenYear;
      }
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
        ...(takenYear ? { year: takenYear } : {}),
      };
    } catch (error) {
      const code = error?.code ?? 'error';
      if (['too-small', 'shape', 'type', 'decode', 'not-allowed-type', 'not-a-photo', 'too-old'].includes(code)) stats.skipped += 1;
      else stats.failed += 1;
      note(code);
      log(`image skipped <${url}> — ${error.message}`);
      return null;
    }
  }

  /** Works through candidates in order and stops once `want` images have been stored. */
  async function processMany(candidates, { slug, kind = 'photo', want = 8, startIndex = 1, domain = '', shouldContinue = () => true }) {
    const stored = [];
    for (const candidate of candidates) {
      if (stored.length >= want || !shouldContinue()) break;
      const item = await process({ domain, ...candidate, slug, kind, index: startIndex + stored.length });
      if (item) stored.push(item);
    }
    return stored;
  }

  return { process, processMany, stats, enabled: ready };
}

export const compressionRatio = (stats) => (stats.originalBytes ? stats.compressedBytes / stats.originalBytes : 1);
