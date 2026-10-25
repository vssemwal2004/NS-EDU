import { once } from 'node:events';
import { COLLECTIONS, getDb, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { isPlainObject } from '../../lib/validation.js';
import { csvRow, parseCsv, rowsToObjects, unguardCell } from '../../scraper/csv.js';
import { queueStats } from '../../scraper/queue.js';
import { queryKeys } from '../universities/normalize.js';
import { IMPORTABLE_FIELDS, INSTITUTION_FIELDS, INSTITUTION_TYPES, VERIFICATION } from '../universities/schema.js';
import { invalidateUniversityCaches, upsertUniversities } from '../universities/university-service.js';

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const TEMPLATE_COLUMNS = ['slug', ...IMPORTABLE_FIELDS, 'sourceUrl'];
const LIST_FIELDS = new Set(INSTITUTION_FIELDS.filter((field) => field.type === 'stringList').map((field) => field.name));
const EXPORT_COLUMNS = ['id', 'slug', ...INSTITUTION_FIELDS.map((field) => field.name).filter((name) => name !== 'slug'), 'source.kind', 'source.name', 'source.url', 'source.fetchedAt', 'createdAt', 'updatedAt'];

const institutions = async () => (await getDb()).collection(COLLECTIONS.institutions);
const flat = (key) => String(key ?? '').toLowerCase().replace(/[^a-z]/g, '');
const HEADER_LOOKUP = new Map([
  ...TEMPLATE_COLUMNS.map((name) => [flat(name), name]),
  ...INSTITUTION_FIELDS.filter((field) => IMPORTABLE_FIELDS.includes(field.name)).map((field) => [flat(field.label), field.name]),
]);

// Splits a list cell on semicolons when present (so commas may appear inside names), else on commas.
const splitList = (value) => (typeof value === 'string' ? value.split(value.includes(';') ? ';' : ',').map((part) => part.trim()).filter(Boolean) : value);

/** CSV (header row = field names or labels) or JSON (array / { items }) → records for upsertUniversities. */
export function parseInstitutionFile(content, format) {
  if (typeof content !== 'string' || !content.trim()) throw new HttpError(400, 'The file is empty.');
  if (Buffer.byteLength(content) > MAX_IMPORT_BYTES) throw new HttpError(413, 'Files are limited to 5 MB. Split the list and import it in parts.');
  if (format === 'json') {
    let parsed;
    try { parsed = JSON.parse(content); } catch { throw new HttpError(400, 'The file is not valid JSON.'); }
    const list = Array.isArray(parsed) ? parsed : parsed?.items ?? parsed?.universities ?? parsed?.institutions;
    if (!Array.isArray(list) || list.some((item) => !isPlainObject(item))) throw new HttpError(400, 'JSON must be an array of objects (or { "items": [...] }).');
    if (list.length > MAX_IMPORT_ROWS) throw new HttpError(400, `Import at most ${MAX_IMPORT_ROWS.toLocaleString('en-IN')} rows at a time.`);
    return { records: list, ignoredColumns: [] };
  }
  if (format !== 'csv') throw new HttpError(400, 'Choose CSV or JSON.');
  let rows;
  try { rows = parseCsv(content, { maxRows: MAX_IMPORT_ROWS + 1 }); } catch (error) { throw new HttpError(400, error.message); }
  if (rows.length < 2) throw new HttpError(400, 'The CSV needs a header row and at least one institution.');
  const ignoredColumns = rows[0].filter((name) => name && !HEADER_LOOKUP.has(flat(name)));
  if (!rows[0].some((name) => HEADER_LOOKUP.get(flat(name)) === 'name')) throw new HttpError(400, 'The CSV needs a "name" column. Download the template for the expected columns.');
  const records = rowsToObjects(rows, (name) => HEADER_LOOKUP.get(flat(name)) ?? '').map((row) => Object.fromEntries(Object.entries(row)
    .map(([key, value]) => [key, LIST_FIELDS.has(key) ? splitList(unguardCell(value)) : unguardCell(value)])));
  return { records, ignoredColumns };
}

const truthy = (value) => value === true || value === 'true' || value === '1';

export async function importInstitutions({ content, format, publish, dryRun, sourceName, sourceUrl }) {
  const { records, ignoredColumns } = parseInstitutionFile(content, format);
  const url = queryString(sourceUrl, 500);
  if (url && !/^https?:\/\//i.test(url)) throw new HttpError(400, 'The source link must be an http(s) URL.', { fields: { sourceUrl: 'Enter an http(s) URL' } });
  const summary = await upsertUniversities(records, {
    source: { kind: 'import', name: queryString(sourceName, 120) || 'Admin import', url },
    publish: truthy(publish), dryRun: truthy(dryRun),
  });
  return { ...summary, rows: records.length, dryRun: truthy(dryRun), publish: truthy(publish), ignoredColumns, items: summary.items.slice(0, 200) };
}

// ---------------------------------------------------------------------------------------------
// Filters shared by export and review

export function institutionFilter(query = {}) {
  const filter = {};
  const verification = queryString(query.verification, 20);
  if (VERIFICATION.includes(verification)) filter.verification = verification;
  const type = queryString(query.type, 20);
  if (INSTITUTION_TYPES.includes(type)) filter.type = type;
  const state = queryString(query.state, 60);
  if (state) filter.state = state;
  const active = queryString(query.active, 5);
  if (active === 'true') filter.active = { $ne: false };
  if (active === 'false') filter.active = false;
  const kind = queryString(query['source.kind'] ?? query.source, 10);
  if (['seed', 'admin', 'import', 'scrape'].includes(kind)) filter['source.kind'] = kind;
  const keys = queryKeys(queryString(query.q, 120));
  if (keys.length) filter.searchPrefixes = { $all: keys };
  return filter;
}

const exportValue = (doc, column) => {
  if (column === 'id') return doc._id.toString();
  if (column.startsWith('source.')) return doc.source?.[column.slice(7)] ?? '';
  return doc[column];
};

// Streams rows from a cursor with backpressure; 20k institutions never sit in memory at once.
export async function streamInstitutionsCsv(query, response) {
  const cursor = (await institutions()).find(institutionFilter(query)).sort({ nameKey: 1, _id: 1 }).batchSize(500);
  const stamp = new Date().toISOString().slice(0, 10);
  response.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="universities-${stamp}.csv"` });
  let closed = false;
  response.on('close', () => { closed = true; cursor.close().catch(() => {}); });
  let chunk = `﻿${csvRow(EXPORT_COLUMNS)}`;
  try {
    for await (const doc of cursor) {
      if (closed) break;
      chunk += csvRow(EXPORT_COLUMNS.map((column) => exportValue(doc, column)));
      if (chunk.length > 64 * 1024) {
        if (!response.write(chunk)) await once(response, 'drain');
        chunk = '';
      }
    }
    if (!closed) response.end(chunk);
  } finally {
    await cursor.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------
// Bulk review actions

const BULK_ACTIONS = {
  verify: { verification: 'verified', active: true },
  reject: { verification: 'rejected', active: false },
  publish: { active: true },
  hide: { active: false },
};

export async function bulkUpdateInstitutions(body, admin) {
  if (!isPlainObject(body)) throw new HttpError(400, 'Request body must be a JSON object');
  const { ids, action } = body;
  if (!Object.hasOwn(BULK_ACTIONS, action)) throw new HttpError(400, `Choose one of: ${Object.keys(BULK_ACTIONS).join(', ')}`, { fields: { action: 'Unknown action' } });
  const objectIds = Array.isArray(ids) && ids.length <= 500 ? [...new Set(ids)].map(toObjectId) : [];
  if (!objectIds.length || objectIds.some((id) => !id)) throw new HttpError(400, 'Select between 1 and 500 valid records', { fields: { ids: 'Invalid selection' } });
  const now = new Date();
  const set = { ...BULK_ACTIONS[action], updatedAt: now };
  if (action === 'verify' || action === 'reject') Object.assign(set, { reviewedAt: now, reviewedBy: admin?.email ?? null });
  const result = await (await institutions()).updateMany({ _id: { $in: objectIds } }, { $set: set });
  invalidateUniversityCaches();
  return { action, matched: result.matchedCount, modified: result.modifiedCount };
}

// ---------------------------------------------------------------------------------------------
// Review queue

const REVIEW_VIEWS = {
  held: { verification: 'unverified', active: false },
  visible: { verification: 'unverified', active: { $ne: false } },
  all: { verification: 'unverified' },
};

export async function listReviewQueue(query = {}) {
  const { page, limit, skip } = pagination(query, { defaultLimit: 20, maxLimit: 100 });
  const view = Object.hasOwn(REVIEW_VIEWS, query.view) ? query.view : 'held';
  const { verification: _verification, active: _active, ...extra } = institutionFilter(query);
  const filter = { ...extra, ...REVIEW_VIEWS[view] };
  const database = await getDb();
  const collection = database.collection(COLLECTIONS.institutions);
  const [docs, total, held, visible] = await Promise.all([
    collection.find(filter, { projection: { searchPrefixes: 0 } }).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(filter),
    collection.countDocuments(REVIEW_VIEWS.held),
    collection.countDocuments(REVIEW_VIEWS.visible),
  ]);
  const slugs = docs.map((doc) => doc.slug);
  const jobs = slugs.length ? await database.collection(COLLECTIONS.scrapeJobs).aggregate([
    { $match: { 'result.slug': { $in: slugs }, status: 'done' } },
    { $sort: { finishedAt: -1 } },
    { $group: { _id: '$result.slug', fields: { $first: '$result.fields' }, missing: { $first: '$result.missing' }, finishedAt: { $first: '$finishedAt' } } },
  ]).toArray() : [];
  const scraped = new Map(jobs.map((job) => [job._id, job]));
  const items = docs.map((doc) => ({
    id: doc._id.toString(), slug: doc.slug, name: doc.name, city: doc.city ?? '', state: doc.state ?? null, website: doc.website ?? '',
    type: doc.type ?? '', active: doc.active !== false, verification: doc.verification ?? 'unverified', lockedFields: doc.lockedFields ?? [],
    source: doc.source ? { kind: doc.source.kind, name: doc.source.name ?? '', url: doc.source.url ?? '', fetchedAt: doc.source.fetchedAt ?? null } : null,
    missing: ['state', 'website', 'city'].filter((key) => !doc[key]),
    scrapedFields: scraped.get(doc.slug)?.fields ?? [],
    updatedAt: doc.updatedAt ?? null,
  }));
  return { items, total, page, limit, view, counts: { held, visible } };
}

const COVERAGE = {
  about: { about: { $nin: [null, ''] } },
  photos: { 'gallery.0': { $exists: true } },
  programmes: { 'programmesOffered.0': { $exists: true } },
  courses: { 'courseSlugs.0': { $exists: true } },
  fees: { $or: [{ 'programmesOffered.annualFeeInr': { $type: 'number' } }, { 'programmesOffered.semesterFeeInr': { $type: 'number' } }, { 'programmesOffered.totalFeeInr': { $type: 'number' } }] },
  placements: { $or: [{ 'placements.averagePackageLpa': { $type: 'number' } }, { 'placements.highestPackageLpa': { $type: 'number' } }, { 'placements.placedPercent': { $type: 'number' } }, { 'placementHistory.0': { $exists: true } }] },
  placementSeasons: { 'placementHistory.1': { $exists: true } },
};

export async function dataOverview() {
  const [facets] = await (await institutions()).aggregate([{ $facet: {
    verification: [{ $group: { _id: '$verification', count: { $sum: 1 } } }],
    source: [{ $group: { _id: '$source.kind', count: { $sum: 1 } } }],
    hidden: [{ $match: { active: false } }, { $count: 'value' }],
    held: [{ $match: { active: false, verification: 'unverified' } }, { $count: 'value' }],
    total: [{ $count: 'value' }],
    // Profile depth: how many records carry each kind of content the crawl fills in.
    ...Object.fromEntries(Object.entries(COVERAGE).map(([key, filter]) => [`has_${key}`, [{ $match: filter }, { $count: 'value' }]])),
  } }]).toArray();
  const byKey = (rows) => Object.fromEntries(rows.map((row) => [row._id ?? 'unknown', row.count]));
  const verification = byKey(facets.verification);
  return {
    institutions: {
      total: facets.total[0]?.value ?? 0, verified: verification.verified ?? 0, unverified: (verification.unverified ?? 0) + (verification.unknown ?? 0), rejected: verification.rejected ?? 0,
      hidden: facets.hidden[0]?.value ?? 0, held: facets.held[0]?.value ?? 0, bySource: byKey(facets.source),
    },
    coverage: Object.fromEntries(Object.keys(COVERAGE).map((key) => [key, facets[`has_${key}`][0]?.value ?? 0])),
    scraper: await queueStats(),
  };
}
