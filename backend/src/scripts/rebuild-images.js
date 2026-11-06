// Re-creates our own images on the Cloudinary account configured in backend/.env, for images whose
// stored links point at a previous account that no longer serves them (see lib/retired-images.js).
//
//   npm run images:rebuild --workspace backend -- places [--dry-run]
//       State and city photos: downloaded again from the Wikimedia Commons file each one records
//       (imageSource), resized exactly as places:images does, uploaded under the same public id.
//   npm run images:rebuild --workspace backend -- site --from <folder> [--dry-run]
//       Site images (media library rows from images:migrate): uploaded again from a folder holding
//       the original files at their old paths (e.g. eligibility/graduation.webp), which can be
//       restored from git history. The `media` site-content entry is updated to the new links.
//   npm run images:rebuild --workspace backend -- status
//       How many stored links still point at a retired account.
//
// University photos, covers and logos come from the official websites again:
//   npm run scrape --workspace backend -- enrich-images --retired --limit 10000
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { COLLECTIONS, closeDb, getDb } from '../db/collections.js';
import { cloudinaryConfig, cloudinaryFolder, uploadImage } from '../lib/cloudinary.js';
import { isRetiredImage, retiredImagePattern } from '../lib/retired-images.js';

const args = process.argv.slice(2);
const step = args[0];
const dryRun = args.includes('--dry-run');
const option = (name) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : ''; };
const USER_AGENT = 'GyaanVidhyaPlacePhotos/1.0 (education directory; image restore)';
const pause = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function requireCloudinary() {
  const config = cloudinaryConfig();
  if (!config.configured) throw new Error('Cloudinary is not configured: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in backend/.env.');
  return config;
}

// Deep-replaces exact string values (old link → new link) anywhere in a site-content entry.
function replaceLinks(value, links) {
  if (typeof value === 'string') return links.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceLinks(item, links));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceLinks(item, links)]));
  return value;
}

async function commonsThumb(title) {
  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: 'json', action: 'query', titles: title, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '1600' })}`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
    if (response.ok) {
      const info = Object.values((await response.json()).query?.pages ?? {})[0]?.imageinfo?.[0];
      if (!info?.thumburl) throw new Error(`Commons has no file ${title}`);
      return info.thumburl;
    }
    await pause(Number(response.headers.get('retry-after')) * 1000 || 5000 * (attempt + 1)); // Commons rate limit
  }
  throw new Error(`Commons did not answer for ${title}`);
}

async function places() {
  if (!dryRun) requireCloudinary();
  const db = await getDb();
  const dead = retiredImagePattern();
  let done = 0; let failed = 0;
  for (const [kind, name] of [['state', COLLECTIONS.states], ['city', COLLECTIONS.cities]]) {
    const rows = await db.collection(name).find({ imageUrl: dead }).toArray();
    for (const place of rows) {
      const title = decodeURIComponent(String(place.imageSource ?? '').split('/wiki/')[1] ?? '');
      if (!title.startsWith('File:')) { failed += 1; console.log(`skip   ${kind}:${place.name} — no Commons file recorded`); continue; }
      if (dryRun) { console.log(`dry    ${kind}:${place.name} ← ${title}`); continue; }
      try {
        const response = await fetch(await commonsThumb(title), { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(60_000) });
        if (!response.ok) throw new Error(`download answered ${response.status}`);
        const jpeg = await sharp(Buffer.from(await response.arrayBuffer())).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
        const upload = await uploadImage(jpeg, { publicId: `${kind}-${slugOf(place.name)}`, folder: `${cloudinaryFolder()}/place`, overwrite: true, tags: ['gyaan-vidhya', 'place'] });
        const now = new Date();
        await db.collection(name).updateOne({ _id: place._id }, { $set: { imageUrl: upload.secure_url, updatedAt: now } });
        await db.collection(COLLECTIONS.media).updateOne({ publicId: upload.public_id }, { $set: { url: upload.secure_url, width: upload.width, height: upload.height, bytes: upload.bytes, format: upload.format, updatedAt: now } }, { upsert: true });
        done += 1;
        console.log(`ok     ${kind}:${place.name} → ${upload.secure_url}`);
        await pause(800); // polite to Commons
      } catch (error) {
        failed += 1;
        console.log(`ERROR  ${kind}:${place.name} — ${error.message}`);
      }
    }
  }
  console.log(`${done} place photo(s) restored${failed ? `, ${failed} failed (run again to retry)` : ''}`);
}

async function site() {
  const from = option('--from');
  if (!from) throw new Error('Usage: images:rebuild site --from <folder with the original files>');
  if (!dryRun) requireCloudinary();
  const db = await getDb();
  const rows = await db.collection(COLLECTIONS.media).find({ usage: 'site', url: retiredImagePattern() }).toArray();
  const links = new Map();
  for (const row of rows) {
    const relative = String(row.sourcePath ?? '').replace(/^\/images\//, '');
    if (!relative) { console.log(`skip   ${row.publicId} — no original path recorded`); continue; }
    const file = join(from, ...relative.split('/'));
    const bytes = await readFile(file).catch(() => null);
    if (!bytes) { console.log(`MISSING ${file}`); continue; }
    if (dryRun) { console.log(`dry    ${row.sourcePath} → ${row.publicId}`); continue; }
    const upload = await uploadImage(bytes, { publicId: row.publicId, overwrite: true, tags: ['gyaan-vidhya', 'site'] });
    await db.collection(COLLECTIONS.media).updateOne({ _id: row._id }, { $set: { url: upload.secure_url, width: upload.width, height: upload.height, bytes: upload.bytes, format: upload.format, updatedAt: new Date() } });
    links.set(row.url, upload.secure_url);
    console.log(`ok     ${row.sourcePath} → ${upload.secure_url}`);
  }
  if (links.size) {
    const content = db.collection(COLLECTIONS.siteContent);
    const entry = await content.findOne({ key: 'media' });
    if (entry) {
      await content.updateOne({ _id: entry._id }, { $set: { data: replaceLinks(entry.data, links), updatedAt: new Date(), updatedBy: 'images:rebuild' } });
      console.log(`site content "media" updated (${links.size} link(s))`);
    }
  }
  console.log(`${links.size} site image(s) restored`);
}

async function status() {
  const db = await getDb();
  const dead = retiredImagePattern();
  const [galleries, covers, logos, states, cities, media] = await Promise.all([
    db.collection(COLLECTIONS.institutions).countDocuments({ 'gallery.url': dead }),
    db.collection(COLLECTIONS.institutions).countDocuments({ coverUrl: dead }),
    db.collection(COLLECTIONS.institutions).countDocuments({ logoUrl: dead }),
    db.collection(COLLECTIONS.states).countDocuments({ imageUrl: dead }),
    db.collection(COLLECTIONS.cities).countDocuments({ imageUrl: dead }),
    db.collection(COLLECTIONS.media).countDocuments({ url: dead }),
  ]);
  const content = await db.collection(COLLECTIONS.siteContent).findOne({ key: 'media' });
  const contentLinks = [...JSON.stringify(content?.data ?? {}).matchAll(/https:\/\/res\.cloudinary\.com\/[^"]+/g)].filter(([url]) => isRetiredImage(url)).length;
  console.log(`Cloudinary account now: ${cloudinaryConfig().cloudName || '(not configured)'}`);
  console.log('Still on a retired account:', { universitiesWithDeadPhotos: galleries, deadCovers: covers, deadLogos: logos, states, cities, mediaRows: media, siteContentLinks: contentLinks });
}

try {
  if (step === 'places') await places();
  else if (step === 'site') await site();
  else if (step === 'status') await status();
  else console.log('Usage: images:rebuild places | site --from <folder> | status   [--dry-run]');
} catch (error) {
  console.error(`images:rebuild ${step} failed:`, error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
