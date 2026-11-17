import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError, notFound } from '../../lib/http-error.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { audit } from '../access/access-service.js';
import { CONSENT_TEXT, REVIEW_STATUSES, serializeOwn, serializePublic } from './schema.js';

// Student reviews of Gyaan Vidhya. Built for many thousands of rows: every list is keyset-paginated
// on an index (never skip/count over the whole collection), and the public summary and first pages
// are cached for a minute; moderation clears the cache on this instance immediately.
const reviews = () => collection(COLLECTIONS.reviews);
const cache = createTtlCache({ ttlMs: 60_000, staleMs: 10 * 60_000, maxEntries: 50 });
export const clearReviewCache = () => cache.clear();

const PUBLIC_MAX = 30;
const ADMIN_MAX = 50;
const limitOf = (raw, fallback, max) => {
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
};
const ratingOf = (raw) => {
  const value = Number.parseInt(raw, 10);
  return value >= 1 && value <= 5 ? value : null;
};

// Cursor = "<time ms>_<id>" in base64url: the last row's sort key, so the next page starts after it.
const encodeCursor = (date, id) => Buffer.from(`${date.getTime()}_${id}`).toString('base64url');
function decodeCursor(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 80) return null;
  const [time, id] = Buffer.from(raw, 'base64url').toString().split('_');
  const objectId = toObjectId(id);
  const at = Number(time);
  return objectId && Number.isSafeInteger(at) ? { at: new Date(at), id: objectId } : null;
}
const after = (field, cursor) => (cursor ? { $or: [{ [field]: { $lt: cursor.at } }, { [field]: cursor.at, _id: { $lt: cursor.id } }] } : {});

async function page(filter, field, { limit, cursor }) {
  const rows = await (await reviews()).find({ ...filter, ...after(field, cursor) })
    .sort({ [field]: -1, _id: -1 }).limit(limit + 1).toArray();
  const more = rows.length > limit;
  const items = more ? rows.slice(0, limit) : rows;
  return { items, nextCursor: more ? encodeCursor(items.at(-1)[field], items.at(-1)._id) : null };
}

// ---------------------------------------------------------------------------------------------
// Public

/** Approved reviews, newest first; `rating` filters to one star value. */
export async function listPublic(query = {}) {
  const limit = limitOf(query.limit, 12, PUBLIC_MAX);
  const rating = ratingOf(query.rating);
  const cursor = decodeCursor(query.cursor);
  const load = async () => {
    const result = await page({ status: 'approved', ...(rating && { rating }) }, 'approvedAt', { limit, cursor });
    return { items: result.items.map(serializePublic), nextCursor: result.nextCursor };
  };
  // Only first pages are shared enough to be worth caching.
  return cursor ? load() : structuredClone(await cache.wrap(`list:${rating ?? 'all'}:${limit}`, load));
}

/** For the homepage strip: reviews a moderator featured, then the newest approved ones. */
export async function listHighlights(query = {}) {
  const limit = limitOf(query.limit, 24, PUBLIC_MAX);
  return structuredClone(await cache.wrap(`highlights:${limit}`, async () => {
    const docs = await reviews();
    const featured = await docs.find({ status: 'approved', featured: true }).sort({ approvedAt: -1, _id: -1 }).limit(limit).toArray();
    const rest = featured.length < limit
      ? await docs.find({ status: 'approved', featured: { $ne: true } }).sort({ approvedAt: -1, _id: -1 }).limit(limit - featured.length).toArray()
      : [];
    return { items: [...featured, ...rest].map(serializePublic) };
  }));
}

/** Average and star distribution over every approved review. */
export async function reviewSummary() {
  return structuredClone(await cache.wrap('summary', async () => {
    const rows = await (await reviews()).aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]).toArray();
    const distribution = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: rows.find((row) => row._id === stars)?.count ?? 0 }));
    const count = distribution.reduce((sum, row) => sum + row.count, 0);
    const total = distribution.reduce((sum, row) => sum + row.stars * row.count, 0);
    return { count, average: count ? Math.round((total / count) * 10) / 10 : null, distribution };
  }));
}

// ---------------------------------------------------------------------------------------------
// The signed-in student's own review (one per account; editing sends it back to moderation)

export async function getOwnReview(studentId) {
  const doc = await (await reviews()).findOne({ studentId });
  return doc ? serializeOwn(doc) : null;
}

export async function saveOwnReview(student, data, { ip = '', userAgent = '' } = {}) {
  const docs = await reviews();
  const now = new Date();
  const fields = {
    ...data,
    status: 'pending', featured: false, approvedAt: null, rejectReason: '',
    // An account exists only after an OTP or Google check, so every review comes from a verified login.
    verified: Boolean(student.email || student.phone || student.googleSub),
    consent: { text: CONSENT_TEXT, at: now, ip, userAgent: userAgent.slice(0, 300) },
    submittedAt: now, updatedAt: now,
  };
  const existing = await docs.findOne({ studentId: student._id }, { projection: { submittedAt: 1 } });
  if (existing && now - existing.submittedAt < 30_000) throw new HttpError(429, 'You just saved your review. Please wait a moment before changing it again.', { retryAfterSeconds: 30 });
  try {
    await docs.updateOne({ studentId: student._id }, { $set: fields, $setOnInsert: { studentId: student._id, createdAt: now } }, { upsert: true });
  } catch (error) {
    // Two first submissions racing on the unique index: the other one won, so save over it.
    if (error?.code !== 11000) throw error;
    await docs.updateOne({ studentId: student._id }, { $set: fields });
  }
  clearReviewCache();
  return serializeOwn(await docs.findOne({ studentId: student._id }));
}

export async function deleteOwnReview(studentId) {
  const { deletedCount } = await (await reviews()).deleteOne({ studentId });
  clearReviewCache();
  return deletedCount > 0;
}

// ---------------------------------------------------------------------------------------------
// Moderation (staff with content.edit)

const serializeAdmin = (doc) => ({
  ...serializeOwn(doc),
  displayName: serializePublic(doc).name,
  featured: Boolean(doc.featured),
  verified: Boolean(doc.verified),
  moderatedAt: doc.moderatedAt ?? null,
  moderatedBy: doc.moderatedBy ?? null,
});

export async function listForModeration(query = {}) {
  const status = REVIEW_STATUSES.includes(query.status) ? query.status : 'pending';
  const rating = ratingOf(query.rating);
  const limit = limitOf(query.limit, 25, ADMIN_MAX);
  const docs = await reviews();
  const [result, counts] = await Promise.all([
    page({ status, ...(rating && { rating }) }, 'submittedAt', { limit, cursor: decodeCursor(query.cursor) }),
    // Three index-only counts (status is the index prefix), cheap even at large volume.
    Promise.all(REVIEW_STATUSES.map((value) => docs.countDocuments({ status: value }))),
  ]);
  return {
    items: result.items.map(serializeAdmin),
    nextCursor: result.nextCursor,
    counts: Object.fromEntries(REVIEW_STATUSES.map((value, index) => [value, counts[index]])),
  };
}

export async function moderateReview(id, body, admin) {
  const _id = toObjectId(id);
  if (!_id) throw notFound('Review not found');
  const docs = await reviews();
  const doc = await docs.findOne({ _id });
  if (!doc) throw notFound('Review not found');
  const status = body?.status === undefined ? doc.status : body.status;
  if (!REVIEW_STATUSES.includes(status)) throw new HttpError(400, 'Choose approved, rejected or pending', { fields: { status: 'Unknown status' } });
  const featured = typeof body?.featured === 'boolean' ? body.featured : Boolean(doc.featured);
  if (featured && status !== 'approved') throw new HttpError(400, 'Only approved reviews can be featured');
  const rejectReason = status === 'rejected' && typeof body?.rejectReason === 'string' ? body.rejectReason.trim().slice(0, 200) : '';
  const now = new Date();
  const $set = {
    status, featured, rejectReason, moderatedAt: now, moderatedBy: admin?.email ?? null, updatedAt: now,
    approvedAt: status === 'approved' ? (doc.status === 'approved' ? doc.approvedAt : now) : null,
  };
  await docs.updateOne({ _id }, { $set });
  clearReviewCache();
  return serializeAdmin({ ...doc, ...$set });
}

export async function deleteReview(id, admin) {
  const _id = toObjectId(id);
  const doc = _id && await (await reviews()).findOneAndDelete({ _id });
  if (!doc) throw notFound('Review not found');
  clearReviewCache();
  await audit(admin, 'review.delete', { type: 'review', id: _id, label: `${serializePublic(doc).name} · ${doc.rating}★` });
}
