// node src/scripts/migrate-catalogue-images.js [--apply] [--recover] [--group places|institutions|counsellors]
// Dry runs read only the public catalogue. Applying switches each live reference after its R2
// object has been verified. A failed source or concurrent edit keeps the current public URL.
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { connectDatabase, closeDatabase } from '../config/database.js';
import { cloudinaryFolder } from '../lib/cloudinary.js';
import { isR2Url, r2Config } from '../lib/r2.js';
import { isRetiredImage } from '../lib/retired-images.js';
import { storeCuratedImage } from '../lib/curated-image.js';
import { PUBLIC_FILTER } from '../modules/universities/public-filter.js';
import { registrableDomain } from '../scraper/urls.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const selected = args.includes('--group') ? args[args.indexOf('--group') + 1] : 'all';
const include = (group) => selected === 'all' || selected === group;
const active = { active: { $ne: false } };
const maxBytes = 16 * 1024 * 1024;
const ipv4 = new BlockList();
const reserved = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
];
for (const [ip, bits] of reserved) ipv4.addSubnet(ip, bits);

async function connectCatalogue() {
  for (let attempt = 1; ; attempt++) {
    try { return await connectDatabase(); } catch (error) {
      if (attempt >= 3 || !['MongoServerSelectionError', 'MongoNetworkError'].includes(error.name)) throw error;
      console.log('Retrying catalogue database connection.');
      await pause(2000 * attempt);
    }
  }
}

// Pin the socket to a public address even after redirects. Catalogue image URLs may have been
// supplied by a site editor or an institution's own metadata; they aren't trusted network targets.
function publicLookup(host, opts, callback) {
  lookup(host, { all: true }).then((results) => {
    const valid = results.filter(({ address, family }) => family === 4
      ? !ipv4.check(address) : /^[23][0-9a-f]{3}:/i.test(address) && !/^(?:2001:(?:db8|0):|2002:)/i.test(address));
    if (!valid.length) throw new Error('No public address');
    if (opts.all) callback(null, valid);
    else callback(null, valid[0].address, valid[0].family);
  }).catch(callback);
}

async function download(input, hops = 0) {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port ||
      !url.hostname.includes('.') || isIP(url.hostname.replace(/^\[|\]$/g, '')) || hops > 4) throw new Error('Unsupported source address');
  const client = url.protocol === 'https:' ? https : http;
  const response = await new Promise((resolve, reject) => client.get(url, {
    lookup: publicLookup, signal: AbortSignal.timeout(16000),
    headers: { accept: 'image/*', 'user-agent': 'GyaanVidhyaMedia/1.0 (public education catalogue)' },
  }, resolve).on('error', reject));
  try {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      return download(new URL(response.headers.location, url).href, hops + 1);
    }
    if (response.statusCode !== 200) throw new Error('HTTP ' + response.statusCode);
    if (/^text\/html/i.test(response.headers['content-type'] || '')) throw new Error('HTML response');
    let size = 0;
    const chunks = [];
    for await (const chunk of response) {
      size += chunk.length;
      if (size > maxBytes) throw new Error('Image too large');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } finally { response.destroy(); }
}

function backupPath(url) {
  const src = new URL(url);
  if (src.hostname !== 'res.cloudinary.com') return null;
  const start = '/' + cloudinaryFolder() + '/';
  const path = decodeURIComponent(src.pathname).split(start)[1];
  return /^universities\/[a-z\d-]+\/(?:photo|logo)-\d+\.(?:webp|png)$/i.test(path || '')
    ? join(process.env.IMAGE_BACKUP_DIR || 'D:/gyaan-vidhya-image-backup', path) : null;
}

function commonsThumbnail(source) {
  if (!source) return '';
  const url = new URL(source);
  if (url.hostname !== 'commons.wikimedia.org' || !url.pathname.startsWith('/wiki/File:')) return '';
  const file = decodeURIComponent(url.pathname.slice('/wiki/File:'.length)).replaceAll(' ', '_');
  if (!file || file.includes('/')) return '';
  const hash = createHash('md5').update(file).digest('hex');
  const encoded = encodeURIComponent(file);
  return 'https://upload.wikimedia.org/wikipedia/commons/thumb/' + hash[0] + '/' + hash.slice(0, 2) + '/' + encoded + '/1280px-' + encoded;
}

function sourceAddresses(job) {
  const candidates = new Set([job.url]);
  const commons = commonsThumbnail(job.creditSource);
  if (commons) candidates.add(commons);
  if (!args.includes('--recover')) return candidates;
  const url = new URL(job.url);
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
    candidates.add(url.href);
  }
  // WordPress Photon embeds the source's exact host and file path in its own address.
  if (/^i\d\.wp\.com$/.test(url.hostname) && /^\/[a-z0-9.-]+\.[a-z]{2,}\/./i.test(url.pathname)) {
    candidates.add('https:/' + url.pathname);
  }
  // College sites often retire one of their bare/www aliases. Keep the file path identical.
  const domain = registrableDomain(url.hostname);
  if (!url.search && [domain, 'www.' + domain].includes(url.hostname)) {
    url.hostname = url.hostname === domain ? 'www.' + domain : domain;
    url.protocol = 'https:';
    candidates.add(url.href);
  }
  return candidates;
}

async function storedSource(job, key) {
  const backup = backupPath(job.url);
  if (backup) {
    const bytes = await readFile(backup).catch((err) => { if (err.code !== 'ENOENT') throw err; });
    if (bytes?.length) return { stored: await storeCuratedImage(bytes, key, { maxWidth: job.width }), bytes: bytes.length };
  }
  let firstError;
  for (const address of sourceAddresses(job)) {
    let bytes;
    try { bytes = await download(address); } catch (error) {
      firstError ??= error;
      continue;
    }
    try {
      return { stored: await storeCuratedImage(bytes, key, { maxWidth: job.width }), bytes: bytes.length };
    } catch (error) {
      // Only decode errors can have a working copy at an alternate source address.
      if (!/unsupported image|corrupt|bad seek|input buffer|svgload|invalid image|pixel limit/i.test(error.message)) throw error;
      firstError ??= error;
    }
  }
  throw firstError;
}

async function catalogue(db) {
  const jobs = new Map();
  const stats = { r2References: 0, retiredReferences: 0, pendingReferences: 0 };
  function note(name, row, path, url, width) {
    if (!url || typeof url !== 'string') return;
    if (isR2Url(url)) { stats.r2References++; return; }
    if (isRetiredImage(url) && name === 'institutions') { stats.retiredReferences++; return; }
    const job = jobs.get(url) || { url, refs: [], width, creditSource: row.imageSource };
    job.refs.push({ name, id: row._id, path });
    job.width = Math.max(job.width, width);
    jobs.set(url, job);
    stats.pendingReferences++;
  }
  if (include('places')) for (const name of ['states', 'cities']) {
    for await (const row of db.collection(name).find(active, { projection: { imageUrl: 1, imageSource: 1 } })) note(name, row, 'imageUrl', row.imageUrl, 1600);
  }
  if (include('institutions')) {
    for await (const row of db.collection('institutions').find(PUBLIC_FILTER, { projection: { logoUrl: 1, coverUrl: 1, 'gallery.url': 1 } })) {
      note('institutions', row, 'logoUrl', row.logoUrl, 512);
      note('institutions', row, 'coverUrl', row.coverUrl, 1600);
      for (const photo of row.gallery || []) note('institutions', row, 'gallery', photo?.url, 1600);
    }
  }
  if (include('counsellors')) {
    const fields = await db.collection('career_fields').distinct('slug', active);
    for await (const row of db.collection('counsellors').find({ ...active, fieldSlug: { $in: fields } }, { projection: { photoUrl: 1 } })) note('counsellors', row, 'photoUrl', row.photoUrl, 512);
  }
  return { jobs: [...jobs.values()], ...stats };
}

async function switchImages(db, job, stored) {
  if (job.refs.some(({ name }) => ['cities', 'states'].includes(name))) {
    await db.collection('media').updateMany({ url: job.url, usage: 'place' }, { $set: {
      url: stored.secure_url, publicId: stored.public_id, storage: 'r2', bytes: stored.bytes,
      format: stored.format, width: stored.width, height: stored.height, updatedAt: new Date(),
    } });
  }
  let updated = 0;
  for (const { name, path, id } of job.refs) {
    const gallery = path === 'gallery';
    const shown = name === 'institutions' ? PUBLIC_FILTER : active;
    const query = { _id: id, ...shown, [gallery ? 'gallery.url' : path]: job.url };
    const values = gallery ? {
      'gallery.$[im].url': stored.secure_url, 'gallery.$[im].width': stored.width,
      'gallery.$[im].height': stored.height, 'gallery.$[im].bytes': stored.bytes,
    } : { [path]: stored.secure_url };
    const options = gallery ? { arrayFilters: [{ 'im.url': job.url }] } : {};
    const result = await db.collection(name).updateOne(query, { $set: { ...values, updatedAt: new Date() } }, options);
    updated += result.modifiedCount;
  }
  return updated;
}

try {
  if (!['all', 'places', 'institutions', 'counsellors'].includes(selected)) throw new Error('Unknown catalogue group.');
  if (!r2Config().configured) throw new Error('Configure the R2 image storage first.');
  const db = await connectCatalogue();
  const { jobs, ...inventory } = await catalogue(db);
  console.log(JSON.stringify({ ...inventory, uniqueSources: jobs.length }));
  if (apply) {
    const stats = { migrated: 0, updated: 0, sourceBytes: 0, storedBytes: 0, failed: 0 };
    const failures = {};
    const lanes = Math.max(1, Math.min(Number(process.env.CATALOGUE_IMAGE_CONCURRENCY) || 10, 20));
    async function worker() {
      for (let job; (job = jobs.shift());) {
        try {
          const key = createHash('sha256').update(job.url).digest('hex').slice(0, 24);
          const { stored, bytes } = await storedSource(job, 'catalogue/' + key);
          stats.updated += await switchImages(db, job, stored);
          stats.migrated++; stats.sourceBytes += bytes; stats.storedBytes += stored.bytes;
        } catch (error) {
          stats.failed++;
          const reason = error.code || error.message.split('\n')[0].slice(0, 90);
          failures[reason] = (failures[reason] || 0) + 1;
        }
        if ((stats.migrated + stats.failed) % 100 === 0) console.log(JSON.stringify(stats));
      }
    }
    await Promise.all(Array.from({ length: lanes }, worker));
    console.log(JSON.stringify({ ...stats, failures }));
    if (stats.failed) process.exitCode = 1;
  }
} catch (error) {
  console.error(error.code || error.name, error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[database]'));
  process.exitCode = 1;
} finally { await closeDatabase(); }
