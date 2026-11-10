// Moves university photographs, covers and logos from Cloudinary to Cloudflare R2 and rewrites the
// addresses stored on the institution records.
//
//   node --env-file-if-exists=.env src/scripts/migrate-images-to-r2.js [--apply | --disk-only] [--concurrency 16] [--limit N] [--slug a,b] [--no-download]
//
// Without --apply nothing is uploaded or changed: it only counts what would move (and how many pictures
// are already on disk in IMAGE_BACKUP_DIR, which costs Cloudinary nothing to read).
// --disk-only downloads the pictures that are not on disk yet from Cloudinary into IMAGE_BACKUP_DIR and
// does nothing else (no R2, no database writes): the quick way to rescue everything before an account closes.
//
// For every distinct Cloudinary address of this account found in institutions (gallery[].url, coverUrl,
// logoUrl) it
//   1. takes the picture from IMAGE_BACKUP_DIR (<dir>/universities/<slug>/photo-N.webp), else downloads it
//      from Cloudinary (--no-download skips those),
//   2. stores it in the R2 bucket under the same path (universities/<slug>/photo-N.webp), unless it is there,
//   3. after checking that the public address really serves it, points the records at the new address.
// Records are updated per address with conditional writes (only where the old address is still stored), so
// it is safe next to a running scraper, and it can be stopped and started again: finished pictures are skipped.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { COLLECTIONS, closeDb, getDb } from '../db/collections.js';
import { cloudinaryConfig, cloudinaryFolder } from '../lib/cloudinary.js';
import { hasObject, objectKey, publicUrlFor, putObject, r2Config } from '../lib/r2.js';

const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(`--${name}`); return index === -1 ? undefined : args[index + 1]; };
const flag = (name) => args.includes(`--${name}`);
const apply = flag('apply');
const diskOnly = flag('disk-only');
const concurrency = Math.max(1, Math.min(Number(option('concurrency')) || 16, 48));
const limit = Number(option('limit')) || 0;
const slugs = (option('slug') ?? '').split(',').map((part) => part.trim()).filter(Boolean);
const download = !flag('no-download');
const backupDir = process.env.IMAGE_BACKUP_DIR || 'D:/gyaan-vidhya-image-backup';

/** universities/<slug>/photo-N.webp from a Cloudinary delivery address, or null if it is not one of ours. */
function keyOf(url, cloudName) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.hostname !== 'res.cloudinary.com' || !parsed.pathname.startsWith(`/${cloudName}/image/upload/`)) return null;
  let path = decodeURIComponent(parsed.pathname.slice(`/${cloudName}/image/upload/`.length));
  const version = /(?:^|\/)v\d+\//.exec(path); // drop any transformation segments and the version
  if (version) path = path.slice(version.index + version[0].length);
  const root = `${cloudinaryFolder()}/`;
  if (path.startsWith(root)) path = path.slice(root.length);
  return /\.(webp|png|jpe?g|avif|gif)$/i.test(path) ? path : null;
}

const writeCopy = async (key, bytes) => {
  const target = join(backupDir, key);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
};

/** Downloads each picture from Cloudinary into the backup folder. Touches nothing else. */
async function saveToDisk(missing) {
  const queue = [...missing];
  const total = queue.length;
  const stats = { saved: 0, failed: 0 };
  const failures = [];
  let done = 0;
  async function lane() {
    while (queue.length) {
      const job = queue.shift();
      try {
        const response = await fetch(job.url, { signal: AbortSignal.timeout(45_000) });
        if (!response.ok) throw new Error(`Cloudinary answered ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.byteLength) throw new Error('empty body');
        await writeCopy(job.key, bytes);
        stats.saved += 1;
      } catch (error) {
        stats.failed += 1;
        if (failures.length < 25) failures.push(`${job.key}: ${error.message}`);
      }
      done += 1;
      if (done % 250 === 0 || done === total) console.log(`${new Date().toLocaleTimeString()}  ${done}/${total}  saved ${stats.saved}, failed ${stats.failed}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, lane));
  console.log('Finished:', JSON.stringify(stats), `-> ${backupDir}`);
  for (const line of failures) console.log(`  failed ${line}`);
  if (stats.failed) console.log('Run the same command again to retry; pictures already on disk are skipped.');
}

async function main() {
  const { cloudName } = cloudinaryConfig();
  if (!cloudName) throw new Error('Cloudinary is not configured, so there is nothing to recognise as "ours".');
  const r2 = r2Config();
  if (apply && !r2.configured) throw new Error('R2 is not ready: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_IMAGES_PUBLIC_URL (https://…) in backend/.env.');

  const db = await getDb();
  const institutions = db.collection(COLLECTIONS.institutions);
  const prefix = new RegExp(`^https://res\\.cloudinary\\.com/${cloudName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`);
  const filter = { $or: [{ 'gallery.url': prefix }, { coverUrl: prefix }, { logoUrl: prefix }] };
  if (slugs.length) filter.slug = { $in: slugs };

  // Every distinct address, with where it is used.
  const urls = new Map();
  const note = (url, where) => {
    if (typeof url !== 'string' || !prefix.test(url)) return;
    const entry = urls.get(url) ?? { gallery: false, cover: false, logo: false };
    entry[where] = true;
    urls.set(url, entry);
  };
  let institutionCount = 0;
  for await (const doc of institutions.find(filter, { projection: { gallery: 1, coverUrl: 1, logoUrl: 1 } }).limit(limit || 0)) {
    institutionCount += 1;
    for (const row of doc.gallery ?? []) note(row?.url, 'gallery');
    note(doc.coverUrl, 'cover');
    note(doc.logoUrl, 'logo');
  }

  const jobs = [];
  const unrecognised = [];
  for (const [url, uses] of urls) {
    const key = keyOf(url, cloudName);
    if (key) jobs.push({ url, key, uses }); else unrecognised.push(url);
  }
  // Which pictures are already on disk (a size check, so the dry run does not read gigabytes).
  for (let start = 0; start < jobs.length; start += 500) {
    await Promise.all(jobs.slice(start, start + 500).map(async (job) => {
      try { job.local = (await stat(join(backupDir, job.key))).size > 0; } catch { job.local = false; }
    }));
  }
  const onDisk = jobs.filter((job) => job.local).length;
  console.log(`${institutionCount} institutions, ${jobs.length} distinct pictures on Cloudinary: ${onDisk} on disk in ${backupDir}, ${jobs.length - onDisk} would be downloaded from Cloudinary (~${Math.round((jobs.length - onDisk) * 85 / 1024)} MB of its bandwidth).`);
  if (unrecognised.length) console.log(`${unrecognised.length} addresses were not recognised and stay as they are, e.g. ${unrecognised[0]}`);
  if (diskOnly) { await saveToDisk(jobs.filter((job) => !job.local)); return; }
  if (!apply) { console.log('Dry run: nothing was uploaded or changed. Add --apply to migrate, or --disk-only to just copy the missing pictures to disk.'); return; }

  const stats = { uploaded: 0, alreadyThere: 0, updatedRecords: 0, failed: 0, downloaded: 0, fromDisk: 0 };
  const failures = [];
  let checked = 0;
  const queue = [...jobs];
  const total = jobs.length;
  let done = 0;

  async function publicCheck(job) {
    // The new address must serve the picture before any record points at it.
    const response = await fetch(publicUrlFor(objectKey(job.key)), { method: 'HEAD', signal: AbortSignal.timeout(20_000) });
    if (!response.ok || !/^image\//.test(response.headers.get('content-type') ?? '')) throw new Error(`public address answers ${response.status} ${response.headers.get('content-type') ?? ''}`.trim());
  }

  async function updateRecords(job, newUrl) {
    const ops = [];
    const now = new Date();
    if (job.uses.gallery) ops.push({ updateMany: { filter: { 'gallery.url': job.url }, update: { $set: { 'gallery.$[g].url': newUrl, updatedAt: now } }, arrayFilters: [{ 'g.url': job.url }] } });
    if (job.uses.cover) ops.push({ updateMany: { filter: { coverUrl: job.url }, update: { $set: { coverUrl: newUrl, updatedAt: now } } } });
    if (job.uses.logo) ops.push({ updateMany: { filter: { logoUrl: job.url }, update: { $set: { logoUrl: newUrl, updatedAt: now } } } });
    const result = await institutions.bulkWrite(ops, { ordered: false });
    stats.updatedRecords += result.modifiedCount;
  }

  async function lane() {
    while (queue.length) {
      const job = queue.shift();
      try {
        let present = false;
        const key = objectKey(job.key);
        try { present = await hasObject(key); } catch { /* treat a failed check as "not there" and upload */ }
        if (present) stats.alreadyThere += 1;
        else {
          let bytes;
          if (job.local) { bytes = await readFile(join(backupDir, job.key)); stats.fromDisk += 1; }
          else if (download) {
            const response = await fetch(job.url, { signal: AbortSignal.timeout(45_000) });
            if (!response.ok) throw new Error(`Cloudinary answered ${response.status}`);
            bytes = Buffer.from(await response.arrayBuffer());
            if (!bytes.byteLength) throw new Error('Cloudinary sent an empty body');
            await writeCopy(job.key, bytes).catch(() => {}); // keep the disk copy too; never fail the migration over it
            stats.downloaded += 1;
          } else throw new Error('not on disk (--no-download)');
          await putObject(bytes, key);
          stats.uploaded += 1;
        }
        // The first picture and about one in fifty after it are fetched back through the public address.
        if (checked === 0 || Math.random() < 0.02) { checked += 1; await publicCheck(job); }
        await updateRecords(job, publicUrlFor(key));
      } catch (error) {
        stats.failed += 1;
        if (failures.length < 25) failures.push(`${job.key}: ${error.message}`);
        // A bucket that does not serve its pictures would break every record we rewrite: stop at once.
        if (/public address/.test(error.message)) { queue.length = 0; console.error(`STOPPED: ${error.message}. Is public access (r2.dev or a custom domain) enabled on the bucket, and R2_IMAGES_PUBLIC_URL correct?`); }
      }
      done += 1;
      if (done % 250 === 0 || done === total) console.log(`${new Date().toLocaleTimeString()}  ${done}/${total}  uploaded ${stats.uploaded}, already there ${stats.alreadyThere}, failed ${stats.failed}, records updated ${stats.updatedRecords}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, lane));
  console.log('Finished:', JSON.stringify(stats));
  for (const line of failures) console.log(`  failed ${line}`);
  if (stats.failed) console.log('Run the same command again to retry the failed ones; finished pictures are skipped.');
}

try { await main(); } catch (error) { console.error(`migrate-images-to-r2 failed: ${error.message}`); process.exitCode = 1; } finally { await closeDb(); }
