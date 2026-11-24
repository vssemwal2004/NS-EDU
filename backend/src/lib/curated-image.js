import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { hasObject, objectKey, publicUrlFor, putObject } from './r2.js';

// Curation scripts keep the original credit on the place record. Only the compressed bytes go to storage.
export async function storeCuratedImage(bytes, stem, { maxWidth = 1600 } = {}) {
  const original = await sharp(bytes, { animated: true }).metadata();
  const encoded = await sharp(bytes, { animated: true }).rotate()
    .resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  const reuse = original.format === 'webp' && !original.exif && !original.xmp && !original.iptc &&
    !original.orientation && original.width <= maxWidth && bytes.length < encoded.data.length;
  const data = reuse ? bytes : encoded.data;
  const info = reuse ? original : encoded.info;
  const digest = createHash('sha256').update(data).digest('hex').slice(0, 20);
  const key = objectKey(`${stem}-${digest}.webp`);
  if (!await hasObject(key)) await putObject(data, key, { cacheControl: 'public, max-age=31536000, immutable' });
  const url = publicUrlFor(key);
  const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
  if (!response.ok || response.headers.get('content-type') !== 'image/webp' || Number(response.headers.get('content-length')) !== data.length) {
    throw new Error(`Public R2 image verification failed (HTTP ${response.status}).`);
  }
  return { public_id: key, secure_url: url, width: info.width, height: info.height, bytes: data.length, format: 'webp' };
}
