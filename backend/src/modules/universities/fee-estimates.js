// Approximate fee ranges for programmes whose institution publishes no fee.
//
// An estimate is never a published figure and is never stored in a programme row. It is the middle
// half (25th to 75th percentile) of the fees that comparable institutions DO publish for the same
// catalogue course, in the same period (a year, a semester or the whole programme — periods are
// never converted into each other), split public / private, using the narrowest area that has
// enough published peers: the city, then the state, then India. Each institution counts once per
// course (its median row), so a university with fifty B.Tech branches cannot set the range.
import { COLLECTIONS, getDb } from '../../db/collections.js';
import { createTtlCache } from '../../lib/ttl-cache.js';

export const MIN_PEERS = 5;
// A range wider than this (high more than 4x low) says nothing useful about one institution, so none is shown.
export const MAX_SPREAD = 4;
const PERIODS = [['annualFeeInr', 'a year'], ['semesterFeeInr', 'a semester'], ['totalFeeInr', 'whole programme']];
const SCOPES = ['city', 'state', 'india'];

const priceOf = (row) => PERIODS.map(([field, label]) => (row?.[field] > 0 ? { field, label, value: row[field] } : null)).find(Boolean) ?? null;
export const ownershipClass = (ownership) => (ownership === 'public' ? 'public' : ownership === 'private' || ownership === 'public-private' ? 'private' : '');
const key = (...parts) => parts.join('|');
const place = (value) => String(value ?? '').trim().toLowerCase();

export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  return sorted[low] + (sorted[Math.ceil(at)] - sorted[low]) * (at - low);
}
// Round so a range never looks more exact than it is.
export const roundFee = (value) => { const step = value < 100_000 ? 1_000 : value < 1_000_000 ? 5_000 : 25_000; return Math.round(value / step) * step; };

export function summarise(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length < MIN_PEERS) return null;
  const low = roundFee(quantile(sorted, 0.25));
  const high = Math.max(low, roundFee(quantile(sorted, 0.75)));
  if (high > low * MAX_SPREAD) return null;
  return { low, high, median: roundFee(quantile(sorted, 0.5)), sample: sorted.length };
}

const median = (values) => quantile([...values].sort((a, b) => a - b), 0.5);

/**
 * Pure: turns institutions into estimate groups. `institutions` need `slug`, `city`, `state`,
 * `ownership` and `programmesOffered` (rows with `courseSlug` and fee fields).
 */
export function buildGroups(institutions) {
  // institution -> course -> period -> published values (one median per institution)
  const groups = new Map();
  const add = (groupKey, meta, value) => { const group = groups.get(groupKey) ?? { ...meta, values: [] }; group.values.push(value); groups.set(groupKey, group); };
  for (const inst of institutions) {
    const perCourse = new Map();
    for (const row of inst.programmesOffered ?? []) {
      const price = row.courseSlug && priceOf(row);
      if (!price) continue;
      const slot = key(row.courseSlug, price.field);
      perCourse.set(slot, { courseSlug: row.courseSlug, ...price, all: [...(perCourse.get(slot)?.all ?? []), price.value] });
    }
    const klass = ownershipClass(inst.ownership);
    for (const { courseSlug, field, label, all } of perCourse.values()) {
      const value = median(all);
      const scopes = [['city', place(inst.city)], ['state', place(inst.state)], ['india', 'india']].filter(([, name]) => name);
      for (const [scope, name] of scopes) {
        for (const ownership of klass ? [klass, ''] : ['']) {
          add(key(courseSlug, field, scope, name, ownership), { courseSlug, field, label, scope, scopeValue: name, ownership }, value);
        }
      }
    }
  }
  return [...groups.values()].map(({ values, ...meta }) => ({ ...meta, ...summarise(values) })).filter((group) => group.sample);
}

/** Pure: the estimate for one programme row, from a Map built by `indexGroups`. */
export function pickEstimate(institution, row, index) {
  if (!row?.courseSlug || priceOf(row)) return null; // never estimate over a published fee
  const klass = ownershipClass(institution.ownership);
  const areas = { city: place(institution.city), state: place(institution.state), india: 'india' };
  for (const scope of SCOPES) {
    if (!areas[scope]) continue;
    // The institution's own class first; a class we cannot tell uses the mixed group.
    for (const ownership of klass ? [klass] : ['']) {
      const found = PERIODS.map(([field]) => index.get(key(row.courseSlug, field, scope, areas[scope], ownership))).filter(Boolean);
      if (!found.length) continue;
      const best = found.sort((a, b) => b.sample - a.sample)[0]; // the period most peers publish
      return {
        period: best.label, low: best.low, high: best.high, median: best.median, sample: best.sample,
        scope: scope === 'india' ? 'India' : scope === 'state' ? institution.state : institution.city,
        ownership: ownership || '',
      };
    }
  }
  return null;
}

export const indexGroups = (groups) => new Map(groups.map((group) => [key(group.courseSlug, group.field, group.scope, group.scopeValue, group.ownership), group]));

// ---------------------------------------------------------------------------------------------
// Persistence: one derived collection, rebuilt from the published rows by `npm run fees:estimate`.

export async function rebuildFeeEstimates({ log = () => {} } = {}) {
  const db = await getDb();
  const institutions = await db.collection(COLLECTIONS.institutions)
    .find({ active: true, 'programmesOffered.0': { $exists: true } }, { projection: { slug: 1, city: 1, state: 1, ownership: 1, programmesOffered: { courseSlug: 1, annualFeeInr: 1, semesterFeeInr: 1, totalFeeInr: 1 } } })
    .toArray();
  const groups = buildGroups(institutions);
  const now = new Date();
  const collection = db.collection(COLLECTIONS.feeEstimates);
  await collection.deleteMany({}); // derived data: rebuilt in full from the published rows
  for (let start = 0; start < groups.length; start += 5000) await collection.insertMany(groups.slice(start, start + 5000).map((group) => ({ ...group, computedAt: now })), { ordered: false });
  estimateCache.clear();
  log(`${groups.length} estimate groups from ${institutions.length} institutions`);
  return { groups: groups.length, institutions: institutions.length };
}

const estimateCache = createTtlCache({ ttlMs: 10 * 60_000, staleMs: 60 * 60_000, maxEntries: 4 });
const loadIndex = () => estimateCache.wrap('index', async () => indexGroups(await (await getDb()).collection(COLLECTIONS.feeEstimates).find({}, { projection: { _id: 0, computedAt: 0 } }).toArray()));

/** Adds `estimate` to every programme row that has a catalogue course but no published fee. */
export async function withFeeEstimates(item) {
  if (!item?.programmesOffered?.length) return item;
  const index = await loadIndex();
  if (!index.size) return item;
  return { ...item, programmesOffered: item.programmesOffered.map((row) => { const estimate = pickEstimate(item, row, index); return estimate ? { ...row, estimate } : row; }) };
}
