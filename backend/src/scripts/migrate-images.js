// Moves the site images out of frontend/public/images into Cloudinary.
// Usage: npm run images:migrate --workspace backend [-- --dry-run] [-- --delete-local]
//   1. uploads every image under frontend/public/images (public id = <folder>/site/<path>)
//   2. checks each delivery URL answers 200
//   3. records it in the `media` library and rewrites matching `src` values in the `media` site-content entry
//   4. with --delete-local, deletes the local copies that were uploaded and verified
// Brand assets (frontend/public/brand, favicon, manifest icons) stay local on purpose: browsers
// and crawlers request them from the site's own origin.
import { readdir, rm } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';
import { cloudinaryConfig, cloudinaryFolder, uploadImage } from '../lib/cloudinary.js';

const dryRun = process.argv.includes('--dry-run');
const deleteLocal = process.argv.includes('--delete-local');
const imagesDir = fileURLToPath(new URL('../../../frontend/public/images/', import.meta.url));
const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg']);

async function listImages(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(entries.map((entry) => (entry.isDirectory() ? listImages(join(dir, entry.name)) : IMAGE.has(extname(entry.name).toLowerCase()) ? [join(dir, entry.name)] : [])));
  return files.flat();
}

// Replaces every `src` equal to a migrated local path, at any depth of the media entry.
function rewrite(value, urls) {
  if (Array.isArray(value)) return value.map((item) => rewrite(item, urls));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'src' && urls.has(item) ? urls.get(item) : rewrite(item, urls)]));
  return value;
}

try {
  if (!cloudinaryConfig().configured) throw new Error('Cloudinary is not configured. Add CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET) to backend/.env and run again.');
  const files = await listImages(imagesDir);
  if (!files.length) { console.log('No local images left in frontend/public/images. Nothing to migrate.'); process.exit(0); }
  console.log(`${dryRun ? '[dry run] ' : ''}Migrating ${files.length} image(s) to Cloudinary folder "${cloudinaryFolder()}/site"`);

  const migrated = [];
  for (const file of files) {
    const localPath = `/images/${relative(imagesDir, file).split(sep).join('/')}`;
    const publicId = `${cloudinaryFolder()}/site/${localPath.slice('/images/'.length).replace(/\.[^.]+$/, '')}`;
    if (dryRun) { console.log(`  would upload ${localPath} -> ${publicId}`); continue; }
    const result = await uploadImage(file, { publicId, overwrite: true, tags: ['gyaan-vidhya', 'site'] });
    const check = await fetch(result.secure_url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
    if (!check.ok) throw new Error(`Uploaded ${localPath} but ${result.secure_url} answered ${check.status}; local file kept.`);
    migrated.push({ file, localPath, result });
    console.log(`  ${localPath} -> ${result.secure_url} (${Math.round(result.bytes / 1024)} KB)`);
  }
  if (dryRun) process.exit(0);

  const db = await getDb();
  const now = new Date();
  await db.collection(COLLECTIONS.media).bulkWrite(migrated.map(({ localPath, result }) => ({ updateOne: {
    filter: { publicId: result.public_id },
    update: { $set: { publicId: result.public_id, url: result.secure_url, width: result.width, height: result.height, bytes: result.bytes, format: result.format, usage: 'site', alt: '', sourcePath: localPath, createdAt: now, createdBy: 'migrate-images' } },
    upsert: true,
  } })));

  const content = db.collection(COLLECTIONS.siteContent);
  const entry = await content.findOne({ key: 'media' });
  if (entry) {
    const data = rewrite(entry.data, new Map(migrated.map(({ localPath, result }) => [localPath, result.secure_url])));
    await content.updateOne({ _id: entry._id }, {
      $set: { data, updatedAt: now, updatedBy: 'migrate-images' },
      $push: { history: { $each: [{ data: entry.data, updatedAt: entry.updatedAt ?? now, updatedBy: entry.updatedBy ?? null }], $slice: -5 } },
    });
    console.log('Updated the "media" site-content entry (previous version kept in its history). The API picks it up within a minute.');
  } else {
    console.warn('No "media" site-content entry found. Run `npm run seed` first, then re-run this script so pages use the Cloudinary URLs.');
  }

  if (deleteLocal) {
    if (!entry) throw new Error('Refusing to delete local images: the site still points at them (no "media" entry was updated).');
    for (const { file, localPath } of migrated) { await rm(file); console.log(`  deleted local ${localPath}`); }
  } else {
    console.log('Local files kept. Re-run with --delete-local after checking the site.');
  }
} catch (error) {
  console.error('Image migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
