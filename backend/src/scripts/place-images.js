// Destination photographs for the city and state tiles, from Wikimedia Commons.
//   plan   npm run places:images -- plan [--out file.json]      finds candidates, writes nothing to the DB
//   apply  npm run places:images -- apply <plan.json> <picks.json> [--dry-run] [--reuse]
// `picks.json` maps a place name to the Commons file title chosen from the plan, so a person looks at
// every photo before it is published. Only CC0, public-domain, CC BY and CC BY-SA files are accepted, and
// the author, licence and file page are stored with the photo so the site can credit it.
// Photos go to Cloudinary (never a local folder); the place's imageUrl/imageAlt/imageCredit/imageSource are set.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { COLLECTIONS, closeDb, getDb } from '../db/collections.js';
import { cloudinaryConfig, cloudinaryFolder, findImage, uploadImage } from '../lib/cloudinary.js';
import { cityPhotos, statePhotos } from '../data/seed/place-photos.js';

const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'GyaanVidhyaPlacePhotos/1.0 (education directory; one-off curation script)';
const ACCEPTED = /^(CC0|Public domain|PD[\s-]|CC BY(-SA)? \d)/i;
const SKIP_TITLE = /\b(map|logo|flag|coat|seal|stamp|poster|diagram|painting|sketch|postcard|drawing|lithograph|engraving|collage|montage)\b/i;
const args = process.argv.slice(2);
const mode = args[0];
const flag = (name) => args.includes(name);
const option = (name) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : ''; };
const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const plain = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function commons(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', action: 'query', ...params })}`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
    if (response.ok) return response.json();
    // Commons answers 429 when asked too fast; honour Retry-After, else back off.
    await pause(Number(response.headers.get('retry-after')) * 1000 || 5000 * (attempt + 1));
  }
  throw new Error(`Commons request failed: ${params.gsrsearch ?? params.titles}`);
}

const IMAGE_INFO = { prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription' };

function toCandidate(page, width) {
  const info = page.imageinfo?.[0];
  if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime)) return null;
  const meta = info.extmetadata ?? {};
  const license = plain(meta.LicenseShortName?.value);
  const ratio = info.width / info.height;
  if (!ACCEPTED.test(license) || SKIP_TITLE.test(page.title) || info.width < 1600 || info.height < 1000 || ratio < 1.25 || ratio > 2.4) return null;
  return {
    title: page.title, width: info.width, height: info.height, license, licenseUrl: plain(meta.LicenseUrl?.value),
    author: plain(meta.Artist?.value).slice(0, 120) || 'Unknown author', source: info.descriptionurl,
    thumb: info.thumburl, description: plain(meta.ImageDescription?.value).slice(0, 160), width1: width,
  };
}

async function plan() {
  const places = [...statePhotos.map((place) => ({ ...place, kind: 'state' })), ...cityPhotos.map((place) => ({ ...place, kind: 'city' }))];
  const file = option('--out') || 'place-photo-plan.json';
  // Resumable: places already planned in `file` are kept, so a rate-limited run can simply be repeated.
  const out = await readFile(file, 'utf8').then(JSON.parse, () => []);
  for (const place of places) {
    if (out.some((done) => done.kind === place.kind && done.name === place.name && done.candidates.length)) continue;
    const data = await commons({ generator: 'search', gsrnamespace: '6', gsrlimit: '30', gsrsearch: `${place.query} filetype:bitmap`, iiurlwidth: '480', ...IMAGE_INFO });
    const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index);
    const candidates = pages.map((page) => toCandidate(page, 480)).filter(Boolean).slice(0, 5);
    out.splice(0, out.length, ...out.filter((done) => !(done.kind === place.kind && done.name === place.name)), { ...place, candidates });
    await writeFile(file, JSON.stringify(out, null, 1));
    console.log(`${place.kind.padEnd(5)} ${place.name.padEnd(42)} ${candidates.length} candidates`);
    await pause(1500);
  }
  console.log(`Wrote ${file}`);
}

async function download(title) {
  const data = await commons({ titles: title, iiurlwidth: '1600', ...IMAGE_INFO });
  const info = Object.values(data.query.pages)[0].imageinfo?.[0];
  if (!info?.thumburl) throw new Error(`No file for ${title}`);
  const response = await fetch(info.thumburl, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${title}`);
  // 1600 px wide JPEG: sharp bakes in the EXIF rotation; Cloudinary re-encodes per device on delivery.
  return sharp(Buffer.from(await response.arrayBuffer())).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

async function apply() {
  const [planFile, picksFile] = args.slice(1).filter((arg) => !arg.startsWith('--'));
  if (!planFile || !picksFile) throw new Error('Usage: places:images apply <plan.json> <picks.json> [--dry-run]');
  const planned = JSON.parse(await readFile(planFile, 'utf8'));
  const picks = JSON.parse(await readFile(picksFile, 'utf8'));
  if (!flag('--dry-run') && !cloudinaryConfig().configured) throw new Error('Cloudinary is not configured; set it in backend/.env first.');
  const db = await getDb();
  const media = db.collection(COLLECTIONS.media);
  const now = new Date();
  let done = 0;
  for (const place of planned) {
    const title = picks[`${place.kind}:${place.name}`];
    if (!title) { console.log(`skip   ${place.kind}:${place.name} (no pick)`); continue; }
    const candidate = place.candidates.find((item) => item.title === title);
    if (!candidate) { console.log(`ERROR  ${place.name}: ${title} is not a planned candidate`); continue; }
    const credit = `Photo: ${candidate.author} · ${candidate.license}`.slice(0, 200);
    if (flag('--dry-run')) { console.log(`dry    ${place.kind}:${place.name} ← ${title} (${credit})`); continue; }
    const publicId = `${place.kind}-${slugOf(place.name)}`;
    // --reuse links the photo already on Cloudinary (e.g. after a database restore) instead of uploading it again.
    const existing = flag('--reuse') ? await findImage(`${cloudinaryFolder()}/place/${publicId}`) : null;
    const upload = existing ?? await uploadImage(await download(title), { publicId, folder: `${cloudinaryFolder()}/place`, overwrite: true, tags: ['gyaan-vidhya', 'place'] });
    await media.updateOne({ publicId: upload.public_id }, { $set: { url: upload.secure_url, publicId: upload.public_id, width: upload.width, height: upload.height, bytes: upload.bytes, format: upload.format, alt: place.alt, usage: 'place', createdAt: now, createdBy: 'places:images' } }, { upsert: true });
    const collection = db.collection(place.kind === 'city' ? COLLECTIONS.cities : COLLECTIONS.states);
    // Upsert: union territories the directory covers had no curated tile until now.
    await collection.updateOne({ name: place.name }, {
      $set: { imageUrl: upload.secure_url, imageAlt: place.alt, imageCredit: credit, imageSource: candidate.source, updatedAt: now },
      $setOnInsert: { name: place.name, landmark: '', crop: null, featured: false, order: 1000, active: true, createdAt: now },
    }, { upsert: true });
    done += 1;
    console.log(`ok     ${place.kind}:${place.name} → ${upload.secure_url}`);
  }
  console.log(`${done} photo(s) applied`);
}

try {
  if (mode === 'plan') await plan();
  else if (mode === 'apply') await apply();
  else console.log('Usage: places:images plan [--out file] | apply <plan.json> <picks.json> [--dry-run]');
} finally {
  await closeDb();
}
