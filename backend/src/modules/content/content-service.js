import { collection, COLLECTIONS } from '../../db/collections.js';
import { HttpError, notFound } from '../../lib/http-error.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { CONTENT_KEYS, contentSize, isContentKey, validateContent } from './registry.js';

const HISTORY_LIMIT = 5;
// Content is identical for every visitor; admin writes on this instance clear it immediately.
const cache = createTtlCache({ ttlMs: 60_000, maxEntries: 50 });
export const invalidateContentCache = () => cache.clear();

const contents = () => collection(COLLECTIONS.siteContent);
const assertKey = (key) => { if (!isContentKey(key)) throw notFound('Unknown content key'); };
const defaultsFor = (key) => structuredClone(CONTENT_KEYS[key].defaults);
const freshDoc = (key, now = new Date()) => ({ key, data: defaultsFor(key), updatedAt: now, updatedBy: null, history: [] });

// A key missing from the database is created from its default on first read.
async function loadDoc(key) {
  const docs = await contents();
  const existing = await docs.findOne({ key });
  if (existing) return existing;
  await docs.updateOne({ key }, { $setOnInsert: freshDoc(key) }, { upsert: true });
  return docs.findOne({ key });
}

export async function getContentEntry(key) {
  assertKey(key);
  return structuredClone(await cache.wrap(key, async () => (await loadDoc(key)).data));
}

export async function getContentEntries(keys) {
  const values = await Promise.all(keys.map(getContentEntry));
  return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
}

export function assertValidContent(key, data) {
  assertKey(key);
  const errors = validateContent(key, data);
  if (Object.keys(errors).length) throw new HttpError(400, errors._ ?? 'Content is missing required properties.', { fields: errors });
}

// Stores a new version; the previous one is kept in `history` (newest last, at most 5).
// `expectedUpdatedAt` (optional) rejects the write if someone else saved in the meantime.
export async function setContentEntry(key, data, { updatedBy = null, expectedUpdatedAt } = {}) {
  assertValidContent(key, data);
  const docs = await contents();
  const current = await loadDoc(key);
  const expected = expectedUpdatedAt ? new Date(expectedUpdatedAt).getTime() : null;
  if (Number.isNaN(expected)) throw new HttpError(400, 'updatedAt must be a date', { fields: { updatedAt: 'Must be a date' } });
  if (expected !== null && expected !== current.updatedAt.getTime()) {
    throw new HttpError(409, 'This content was changed by someone else. Reload to see the latest version.');
  }
  const now = new Date();
  const result = await docs.updateOne({ _id: current._id, updatedAt: current.updatedAt }, {
    $set: { data, updatedAt: now, updatedBy },
    $push: { history: { $each: [{ data: current.data, updatedAt: current.updatedAt, updatedBy: current.updatedBy }], $slice: -HISTORY_LIMIT } },
  });
  if (!result.matchedCount) throw new HttpError(409, 'This content was changed by someone else. Reload to see the latest version.');
  invalidateContentCache();
  return describeEntry(await docs.findOne({ _id: current._id }), { withData: true });
}

export const resetContentEntry = (key, options) => { assertKey(key); return setContentEntry(key, defaultsFor(key), options); };

// `index` counts from the newest history entry (0 = the version before the current one).
export async function restoreContentEntry(key, index, options) {
  assertKey(key);
  const { history } = await loadDoc(key);
  const entry = Number.isInteger(index) ? history[history.length - 1 - index] : undefined;
  if (!entry) throw new HttpError(400, 'Choose a saved version to restore', { fields: { index: `Use 0 to ${Math.max(history.length - 1, 0)}` } });
  return setContentEntry(key, entry.data, options);
}

function describeEntry(doc, { withData = false } = {}) {
  const spec = CONTENT_KEYS[doc.key];
  const base = { key: doc.key, label: spec.label, description: spec.description, updatedAt: doc.updatedAt, updatedBy: doc.updatedBy ?? null, size: contentSize(doc.data), versions: doc.history?.length ?? 0 };
  if (!withData) return base;
  const history = (doc.history ?? []).toReversed().map((item, index) => ({ index, updatedAt: item.updatedAt, updatedBy: item.updatedBy ?? null, size: contentSize(item.data), data: item.data }));
  return { ...base, data: doc.data, history };
}

export async function listContentEntries() {
  return Promise.all(Object.keys(CONTENT_KEYS).map(async (key) => describeEntry(await loadDoc(key))));
}

export async function getContentDetail(key) {
  assertKey(key);
  return describeEntry(await loadDoc(key), { withData: true });
}

// Seed hook: inserts missing keys only. `force` replaces every key with its default (history keeps the old version).
export async function seedContentDefaults(db, { force = false } = {}) {
  const docs = db.collection(COLLECTIONS.siteContent);
  const summary = { inserted: 0, reset: 0, kept: 0 };
  for (const key of Object.keys(CONTENT_KEYS)) {
    const { upsertedCount } = await docs.updateOne({ key }, { $setOnInsert: freshDoc(key) }, { upsert: true });
    if (upsertedCount) summary.inserted += 1;
    else if (force) { await resetContentEntry(key, { updatedBy: 'seed --force-content' }); summary.reset += 1; }
    else summary.kept += 1;
  }
  invalidateContentCache();
  return summary;
}
