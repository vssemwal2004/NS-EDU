// Download → verify → compress → upload. One path for every picture the scraper re-hosts, so a
// stored image is always one we fetched from the institution's own domain, decoded ourselves and
// re-encoded small. Nothing here throws into the crawl: a picture that fails is skipped and logged.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { cloudinaryConfig, cloudinaryFolder, uploadImage } from './cloudinary.js';
import { r2Selected, uploadImage as uploadToR2 } from './r2.js';

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

/**
 * IMAGE_BACKUP_DIR=<folder> also keeps every stored image on disk as
 * <folder>/universities/<slug>/<kind>-<index>.<webp|png> (the same name it has on Cloudinary), so a
 * disabled or deleted Cloudinary account never loses the pictures again and they can be uploaded to
 * any other storage later. A write that fails is logged and never stops the crawl.
 */
async function keepLocalCopy(prepared, { slug, kind, index }, log) {
  const dir = process.env.IMAGE_BACKUP_DIR;
  if (!dir) return;
  try {
    const target = join(dir, 'universities', slug, `${kind}-${index}.${prepared.format}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, prepared.data);
  } catch (error) { log(`local backup failed for ${slug} — ${error.message}`); }
}

/**
 * A 64-bit "difference hash" of how a picture looks: shrink to 9×8 grey pixels and record, for each
 * pixel, whether it is brighter than its right-hand neighbour. The same photo at another size,
 * quality or format gives (nearly) the same bits; a different photo differs in about half of them.
 * @returns {Promise<bigint>}
 */
export async function imageFingerprint(bytes) {
  const sharp = await loadSharp();
  const grey = await sharp(bytes, { failOn: 'none' }).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = 0n;
  for (let row = 0; row < 8; row += 1) for (let column = 0; column < 8; column += 1) bits = (bits << 1n) | (grey[row * 9 + column] > grey[row * 9 + column + 1] ? 1n : 0n);
  return bits;
}
export function printDistance(a, b) {
  let diff = a ^ b;
  let count = 0;
  while (diff) { count += Number(diff & 1n); diff >>= 1n; }
  return count;
}
// Measured: the same picture resized and re-encoded differs in 0–7 bits of 64, different pictures in
// 22–34. 10 catches re-encodes with a wide margin before two different photos could be confused.
const DUPLICATE_DISTANCE = 10;

export const IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

// sharp is a native module; load it only when an image is actually processed so the rest of the
// scraper keeps working on a machine where it is not installed.
let sharpPromise;
export function loadSharp() {
  sharpPromise ??= import('sharp').then((module) => {
    // Several scraper processes share one machine and each already runs dozens of images at once, so
    // libvips's default (one worker thread per core, in every process) only makes them fight over the
    // cores. SHARP_CONCURRENCY=0 restores sharp's default.
    const threads = process.env.SHARP_CONCURRENCY === undefined ? 2 : Number(process.env.SHARP_CONCURRENCY);
    if (Number.isInteger(threads) && threads >= 0) module.default.concurrency(threads);
    return module.default;
  }).catch((error) => {
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
export function createImagePipeline({ download, upload = r2Selected() ? uploadToR2 : uploadImage, enabled, log = () => {}, limits = IMAGE_LIMITS } = {}) {
  // Photographs go to Cloudflare R2 when it is configured (R2_IMAGES_PUBLIC_URL and the R2 keys),
  // otherwise to Cloudinary. IMAGE_STORAGE=cloudinary forces the old behaviour.
  const toR2 = upload === uploadToR2;
  const ready = enabled ?? (toR2 || cloudinaryConfig().configured);
  const stats = { attempted: 0, uploaded: 0, skipped: 0, failed: 0, originalBytes: 0, compressedBytes: 0, reasons: {} };
  const note = (code) => { stats.reasons[code] = (stats.reasons[code] ?? 0) + 1; };

  /**
   * One image, end to end. Returns null when it is not usable — never throws at the caller.
   * @param {{ url: string, slug: string, kind?: 'photo'|'logo', index?: number, caption?: string, sourcePage?: string, domain?: string }} input
   */
  async function process({ url, slug, kind = 'photo', index = 1, caption = '', sourcePage = '', domain = '', year = null, knownPrints = null }) {
    if (!ready) { stats.skipped += 1; note('disabled'); return null; }
    if (!slug) { stats.skipped += 1; note('no-slug'); return null; }
    stats.attempted += 1;
    try {
      const { contentType, body, lastModified } = await download(url, { maxBytes: limits.maxBytes, timeoutMs: limits.timeoutMs, types: IMAGE_TYPES, domain });
      // An untyped or octet-stream response is decoded below; sharp refuses bytes that are not an image.
      if (contentType && !IMAGE_TYPES.includes(contentType) && !/^(application|binary)\/octet-stream$/.test(contentType)) throw new ImageError(`Not an image (${contentType})`, 'type');
      if (!body?.byteLength) throw new ImageError('Empty response', 'download');
      const prepared = await prepareImage(body, { kind, limits });
      // The same picture served from two addresses (or already stored from an earlier run) is
      // recognised by how it looks, and is not uploaded again: an upload costs Cloudinary credits.
      let fingerprint = null;
      if (knownPrints) {
        fingerprint = await imageFingerprint(prepared.data);
        if (knownPrints.some((known) => printDistance(known, fingerprint) <= DUPLICATE_DISTANCE)) throw new ImageError('Already have this picture', 'duplicate');
      }
      let takenYear = null;
      if (kind === 'photo' && limits.maxAgeYears) {
        const age = photoAge({ exif: prepared.exif, lastModified, urlYear: year, maxAgeYears: limits.maxAgeYears });
        if (age.tooOld) throw new ImageError(`Older than ${limits.maxAgeYears} years (${age.evidence})`, 'too-old');
        takenYear = age.takenYear;
      }
      await keepLocalCopy(prepared, { slug, kind, index }, log);
      const result = await upload(prepared.data, {
        // The R2 bucket is ours alone, so keys start at universities/…, the layout of the disk backup.
        folder: `${toR2 ? '' : `${cloudinaryFolder()}/`}universities/${slug}`,
        publicId: `${kind}-${index}`,
        format: prepared.format,
        overwrite: true,
        tags: ['scrape', kind],
      });
      if (!result?.secure_url) throw new ImageError('The image store returned no URL', 'upload');
      stats.uploaded += 1;
      if (fingerprint) knownPrints.push(fingerprint);
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
      if (['too-small', 'shape', 'type', 'decode', 'not-allowed-type', 'not-a-photo', 'too-old', 'duplicate'].includes(code)) stats.skipped += 1;
      else stats.failed += 1;
      note(code);
      log(`image skipped <${url}> — ${error.message}`);
      return null;
    }
  }

  /**
   * Works through candidates in order and stops once `want` images have been stored, or after
   * `maxAttempts` candidates (each one is a polite, delayed download from the institution's site).
   */
  async function processMany(candidates, { slug, kind = 'photo', want = 8, startIndex = 1, domain = '', shouldContinue = () => true, maxAttempts = Infinity, knownPrints = null }) {
    const stored = [];
    for (const candidate of candidates.slice(0, Math.max(want, maxAttempts))) {
      if (stored.length >= want || !shouldContinue()) break;
      const item = await process({ domain, ...candidate, slug, kind, index: startIndex + stored.length, knownPrints });
      if (item) stored.push(item);
    }
    return stored;
  }

  return { process, processMany, stats, enabled: ready };
}

export const compressionRatio = (stats) => (stats.originalBytes ? stats.compressedBytes / stats.originalBytes : 1);
