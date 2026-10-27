export const queryString = (value, max = 120) => (typeof value === 'string' ? value : '').trim().slice(0, max);

// `allowedLimits` snaps the page size to the nearest offered value (e.g. 25/50/100).
export function pagination(query, { defaultLimit = 20, maxLimit = 100, allowedLimits = null } = {}) {
  const integer = (value, fallback) => /^\d{1,6}$/.test(queryString(value)) ? Number(queryString(value)) : fallback;
  const page = Math.max(1, integer(query.page, 1));
  let limit = Math.min(maxLimit, Math.max(1, integer(query.limit, defaultLimit)));
  if (allowedLimits?.length) limit = allowedLimits.reduce((best, item) => (Math.abs(item - limit) < Math.abs(best - limit) ? item : best));
  return { page, limit, skip: (page - 1) * limit };
}

// Keyset cursors for lists sorted by { createdAt, _id }: "<ms>.<objectId hex>", base64url.
export function encodeCursor(doc) {
  return Buffer.from(`${doc.createdAt.getTime()}.${doc._id.toString()}`).toString('base64url');
}
export function decodeCursor(value) {
  const match = /^(\d{1,15})\.([a-f0-9]{24})$/.exec(Buffer.from(queryString(value, 80), 'base64url').toString());
  return match ? { createdAt: new Date(Number(match[1])), id: match[2] } : null;
}
