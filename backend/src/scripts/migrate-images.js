// npm run images:migrate --workspace backend -- [--apply] [--sync-cms] [--from <original images folder>]
// --git-revision <commit> can supply the seven original illustrations retired from public/images.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';
import defaults from '../modules/content/defaults/media.js';
import { hasObject, objectKey, publicUrlFor, putObject, r2Config } from '../lib/r2.js';

const args = process.argv.slice(2);
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : '';
const apply = args.includes('--apply');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const manifestFile = join(root, 'frontend/src/lib/student-image-manifest.json');
const publicDir = join(root, 'frontend/public');
const legacyPaths = [];
function collectArt(value) {
  if (value?.src) legacyPaths.push(value.src);
  else for (const child of Object.values(value ?? {})) collectArt(child);
}
collectArt(defaults);

async function source(path) {
  try { return await readFile(join(publicDir, path.slice(1))); } catch (error) {
    if (error.code !== 'ENOENT' || !legacyPaths.includes(path)) throw error;
    if (option('--from')) return readFile(join(option('--from'), path.slice('/images/'.length)));
    if (!option('--git-revision')) throw new Error(`Provide --from or --git-revision for the original ${path}.`);
    return execFileSync(process.env.GIT_EXECUTABLE || 'git', ['show', `${option('--git-revision')}:frontend/public${path}`], { cwd: root, maxBuffer: 32 * 1024 ** 2 });
  }
}

const records = new Map();
const totals = { sources: 0, originalBytes: 0, fullBytes: 0, thumbnailBytes: 0, verifiedObjects: 0 };
async function migrate(path) {
  const input = await source(path);
  const isIcon = path.startsWith('/brand/') && path.endsWith('.png');
  const isCompany = path.startsWith('/company/');
  const format = isIcon ? 'png' : 'webp';
  const { width, height } = await sharp(input).metadata();
  const encode = (maxWidth) => {
    let image = sharp(input).rotate();
    if (maxWidth) image = image.resize({ width: maxWidth, withoutEnlargement: true });
    return isIcon ? image.png({ compressionLevel: 9, palette: true, quality: 95 }).toBuffer() :
      image.webp({ quality: path.startsWith('/brand/') ? 87 : 79, effort: 5, alphaQuality: 100 }).toBuffer();
  };
  let primary = await encode();
  if (path.endsWith('.' + format) && input.length < primary.length) primary = input;
  const outputs = [['', primary]];
  if (isCompany) {
    for (const w of [480, 960]) {
      const resized = await encode(w);
      outputs.push(['-' + w, width <= w || resized.length > primary.length ? primary : resized]);
    }
  }
  const hash = createHash('sha256');
  for (const [, bytes] of outputs) hash.update(bytes);
  const stem = objectKey('student-ui' + path.slice(0, -parse(path).ext.length) + '-' + hash.digest('hex').slice(0, 20));
  for (const [suffix, bytes] of outputs) {
    if (suffix) totals.thumbnailBytes += bytes.length;
    if (!apply) continue;
    const key = stem + suffix + '.' + format;
    if (!await hasObject(key)) await putObject(bytes, key, { cacheControl: 'public, max-age=31536000, immutable' });
    const res = await fetch(publicUrlFor(key), { method: 'HEAD', signal: AbortSignal.timeout(30000) });
    if (!res.ok || res.headers.get('content-type')?.split(';')[0] !== 'image/' + format || Number(res.headers.get('content-length')) !== bytes.length) {
      throw new Error(`Public verification failed for ${path}${suffix} (HTTP ${res.status}).`);
    }
    totals.verifiedObjects++;
  }
  const key = stem + '.' + format;
  records.set(path, { url: publicUrlFor(key), publicId: key, bytes: primary.length, width, height, format });
  totals.originalBytes += input.length;
  totals.fullBytes += primary.length;
  totals.sources++;
}

function replaceLinks(value, aliases) {
  if (typeof value === 'string') return aliases.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceLinks(item, aliases));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, replaceLinks(v, aliases)]));
  return value;
}

async function syncContent(aliases) {
  const db = await getDb();
  const media = db.collection(COLLECTIONS.media);
  const content = db.collection(COLLECTIONS.siteContent);
  const mediaUpdates = [];
  for await (const row of media.find({ sourcePath: { $in: legacyPaths }, usage: 'site' })) {
    const asset = records.get(row.sourcePath);
    if (row.url && row.url !== asset.url) aliases.set(row.url, asset.url);
    if (row.url !== asset.url) mediaUpdates.push({ updateOne: { filter: { _id: row._id, url: row.url }, update: { $set: { ...asset, updatedAt: new Date() } } } });
  }
  let updated = 0;
  for await (const doc of content.find({}, { projection: { data: 1, updatedBy: 1, updatedAt: 1 } })) {
    const data = replaceLinks(doc.data, aliases);
    if (JSON.stringify(data) === JSON.stringify(doc.data)) continue;
    const result = await content.updateOne({ _id: doc._id, data: doc.data }, {
      $set: { data, updatedAt: new Date(), updatedBy: 'images:migrate' },
      $push: { history: { $each: [{ data: doc.data, updatedAt: doc.updatedAt, updatedBy: doc.updatedBy }], $slice: -5 } },
    });
    if (!result.modifiedCount) throw new Error('A site content entry changed during migration. Re-run to merge it.');
    updated++;
  }
  if (mediaUpdates.length) await media.bulkWrite(mediaUpdates);
  console.log(`Updated ${updated} site content entries and ${mediaUpdates.length} artwork records.`);
}

try {
  if (apply && !r2Config().configured) throw new Error('Configure the R2 image bucket and public URL first.');
  const paths = [...legacyPaths];
  for (const folder of ['brand', 'company']) {
    const names = await readdir(join(publicDir, folder));
    for (const name of names.sort()) {
      if (name.endsWith('.webp') || (folder === 'brand' && /^(apple-touch-icon|favicon-64|icon-192|icon-512)\.png$/.test(name))) paths.push('/' + folder + '/' + name);
    }
  }
  const queue = [...paths];
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let path; (path = queue.shift());) await migrate(path);
  }));
  if (apply) {
    const aliases = new Map([...records].map(([path, rec]) => [path, rec.url]));
    const previous = await readFile(manifestFile, 'utf8').then(JSON.parse, (err) => { if (err.code === 'ENOENT') return {}; throw err; });
    if (args.includes('--sync-cms')) await syncContent(aliases);
    const manifest = Object.fromEntries(Object.entries({ ...previous, ...Object.fromEntries(aliases) }).sort(([a], [b]) => a.localeCompare(b)));
    const tmp = manifestFile + '.' + process.pid + '.tmp';
    await writeFile(tmp, JSON.stringify(manifest, null, 2) + '\n');
    await rename(tmp, manifestFile);
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...totals }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { await closeDb(); }
