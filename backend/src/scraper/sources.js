import { COLLECTIONS, getDb, toObjectId } from '../db/collections.js';
import { HttpError } from '../lib/http-error.js';
import { pagination, queryString } from '../lib/query.js';
import { assertValid, escapeRegex, isPlainObject, validate } from '../lib/validation.js';
import { foldText } from '../modules/universities/normalize.js';
import { INSTITUTION_CATEGORIES, INSTITUTION_TYPES } from '../modules/universities/schema.js';
import { parseCsv, rowsToObjects } from './csv.js';
import { canonicalState } from './india.js';
import { normalizeWebsite, registrableDomain, websiteKey } from './urls.js';

export const SOURCE_STATUSES = ['active', 'paused', 'blocked'];
export const MAX_SEED_ROWS = 20_000;

const SOURCE_FIELDS = [
  { name: 'name', type: 'string', required: true, maxLength: 200 },
  { name: 'website', type: 'url', required: true },
  { name: 'state', type: 'string', maxLength: 60 },
  { name: 'city', type: 'string', maxLength: 80 },
  { name: 'type', type: 'select', options: ['', ...INSTITUTION_TYPES], default: '' },
  { name: 'category', type: 'select', options: ['', ...INSTITUTION_CATEGORIES], default: '' },
  { name: 'seedListName', type: 'string', maxLength: 80 },
  { name: 'status', type: 'select', options: SOURCE_STATUSES, default: 'active' },
  { name: 'notes', type: 'text', maxLength: 500 },
];

// Header synonyms seen in directory downloads (UGC/AICTE/AISHE-style lists and hand-made sheets).
const HEADER_SYNONYMS = {
  name: ['name', 'institution', 'institutionname', 'nameoftheinstitution', 'nameofinstitution', 'university', 'universityname', 'nameoftheuniversity', 'college', 'collegename', 'nameofthecollege'],
  website: ['website', 'websiteurl', 'web', 'webaddress', 'url', 'site', 'homepage', 'officialwebsite'],
  state: ['state', 'statename', 'stateut', 'stateuts', 'stateunionterritory'],
  city: ['city', 'town', 'cityname', 'district', 'location'],
  type: ['type', 'institutiontype'],
  category: ['category', 'universitytype', 'universitycategory'],
};
const headerKey = (raw) => {
  const key = String(raw ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return Object.entries(HEADER_SYNONYMS).find(([, names]) => names.includes(key))?.[0] ?? '';
};

const sources = async () => (await getDb()).collection(COLLECTIONS.scrapeSources);

function prepare(data) {
  const website = normalizeWebsite(data.website);
  if (!website) throw new HttpError(400, 'Please correct the highlighted fields.', { fields: { website: 'Enter the official http(s) website' } });
  const state = data.state ? canonicalState(data.state) || data.state : '';
  return { ...data, website, state, websiteKey: websiteKey(website), domain: registrableDomain(new URL(website).hostname), nameKey: foldText(data.name).slice(0, 160) };
}

export const serializeSource = ({ _id, nameKey: _nameKey, ...rest }) => ({ id: _id.toString(), ...rest });

// Bare hosts such as "www.xyz.ac.in" are accepted and stored as https URLs.
const withWebsite = (body) => (isPlainObject(body) && typeof body.website === 'string' ? { ...body, website: normalizeWebsite(body.website) || body.website } : body);

export async function createSource(body, { seedListName = 'Admin console' } = {}) {
  const data = prepare(assertValid(SOURCE_FIELDS, { seedListName, ...withWebsite(body) }));
  const now = new Date();
  const doc = { ...data, hints: {}, lastJobAt: null, lastResult: null, createdAt: now, updatedAt: now };
  try { await (await sources()).insertOne(doc); } catch (error) {
    if (error.code === 11000) throw new HttpError(409, 'A source with this website already exists', { fields: { website: 'Already in use' } });
    throw error;
  }
  return serializeSource(doc);
}

export async function updateSource(id, body) {
  const _id = toObjectId(id);
  const collection = await sources();
  const existing = _id && await collection.findOne({ _id });
  if (!existing) throw new HttpError(404, 'Source not found');
  const patch = assertValid(SOURCE_FIELDS, withWebsite(body), { partial: true });
  const data = prepare({ ...existing, ...patch });
  const changes = Object.fromEntries(Object.entries(data).filter(([key]) => Object.hasOwn(patch, key) || ['website', 'websiteKey', 'domain', 'nameKey', 'state'].includes(key)));
  try {
    const updated = await collection.findOneAndUpdate({ _id }, { $set: { ...changes, updatedAt: new Date() } }, { returnDocument: 'after' });
    if (patch.status && patch.status !== 'active') await cancelQueuedFor(_id);
    return serializeSource(updated);
  } catch (error) {
    if (error.code === 11000) throw new HttpError(409, 'A source with this website already exists', { fields: { website: 'Already in use' } });
    throw error;
  }
}

export async function deleteSource(id) {
  const _id = toObjectId(id);
  const db = await getDb();
  const result = _id ? await db.collection(COLLECTIONS.scrapeSources).deleteOne({ _id }) : { deletedCount: 0 };
  if (!result.deletedCount) throw new HttpError(404, 'Source not found');
  await cancelQueuedFor(_id);
}

async function cancelQueuedFor(sourceId) {
  const now = new Date();
  await (await getDb()).collection(COLLECTIONS.scrapeJobs).updateMany({ sourceId, status: 'queued' }, { $set: { status: 'cancelled', finishedAt: now, updatedAt: now }, $unset: { open: '' } });
}

export async function listSources(query = {}) {
  const { page, limit, skip } = pagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};
  const status = queryString(query.status, 20);
  if (SOURCE_STATUSES.includes(status)) filter.status = status;
  const seedList = queryString(query.seedList, 80);
  if (seedList) filter.seedListName = seedList;
  if (query.crawled === 'never') filter.lastJobAt = null;
  const q = queryString(query.q, 120);
  if (q) {
    const folded = foldText(q);
    filter.$or = [...(folded ? [{ nameKey: { $regex: `^${escapeRegex(folded)}` } }] : []), { domain: { $regex: `^${escapeRegex(q.toLowerCase().replace(/^https?:\/\/(www\.)?/, ''))}` } }];
  }
  const collection = await sources();
  const [docs, total] = await Promise.all([
    collection.find(filter).sort({ nameKey: 1, _id: 1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);
  return { items: docs.map(serializeSource), total, page, limit };
}

// CSV or JSON seed list → normalized rows. Rows without a usable website are reported, not stored.
export function parseSeedList(content, format) {
  let rows;
  if (format === 'json') {
    let parsed;
    try { parsed = JSON.parse(content); } catch { throw new HttpError(400, 'The file is not valid JSON.'); }
    const list = Array.isArray(parsed) ? parsed : parsed?.items ?? parsed?.sources ?? parsed?.institutions;
    if (!Array.isArray(list)) throw new HttpError(400, 'JSON must be an array of objects (or { "items": [...] }).');
    rows = list.map((item) => Object.fromEntries(Object.entries(item && typeof item === 'object' ? item : {}).map(([key, value]) => [headerKey(key), typeof value === 'string' ? value : value == null ? '' : String(value)]).filter(([key]) => key)));
  } else {
    try { rows = rowsToObjects(parseCsv(content, { maxRows: MAX_SEED_ROWS + 1 }), headerKey); } catch (error) { throw new HttpError(400, error.message); }
  }
  if (rows.length > MAX_SEED_ROWS) throw new HttpError(400, `Use at most ${MAX_SEED_ROWS} rows per file.`);
  return rows;
}

export async function importSources(rows, { seedListName = 'Seed list' } = {}) {
  const collection = await sources();
  const summary = { inserted: 0, updated: 0, duplicates: 0, failed: 0, errors: [] };
  const now = new Date();
  const operations = [];
  const seen = new Set();
  for (const [index, raw] of rows.entries()) {
    const type = INSTITUTION_TYPES.includes(String(raw.type ?? '').toLowerCase()) ? String(raw.type).toLowerCase() : '';
    const category = INSTITUTION_CATEGORIES.includes(String(raw.category ?? '').toLowerCase()) ? String(raw.category).toLowerCase() : '';
    const website = normalizeWebsite(raw.website);
    const { value, errors } = validate(SOURCE_FIELDS, { ...raw, website: website || raw.website || '', type, category, seedListName, status: 'active' });
    if (!website && !errors.website) errors.website = 'Enter the official http(s) website';
    if (Object.keys(errors).length) {
      summary.failed += 1;
      if (summary.errors.length < 100) summary.errors.push({ row: index + 2, name: String(raw.name ?? '').slice(0, 120), errors });
      continue;
    }
    const data = prepare(value);
    if (seen.has(data.websiteKey)) { summary.duplicates += 1; continue; }
    seen.add(data.websiteKey);
    const { status: _status, ...fields } = data;
    operations.push({ updateOne: {
      filter: { websiteKey: data.websiteKey },
      update: { $set: { ...fields, updatedAt: now }, $setOnInsert: { status: 'active', hints: {}, lastJobAt: null, lastResult: null, createdAt: now } },
      upsert: true,
    } });
  }
  for (let start = 0; start < operations.length; start += 1000) {
    const result = await collection.bulkWrite(operations.slice(start, start + 1000), { ordered: false });
    summary.inserted += result.upsertedCount;
    summary.updated += result.matchedCount;
  }
  return summary;
}
