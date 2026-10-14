export const queryString = (value, max = 120) => (typeof value === 'string' ? value : '').trim().slice(0, max);

export function pagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const integer = (value, fallback) => /^\d{1,6}$/.test(queryString(value)) ? Number(queryString(value)) : fallback;
  const page = Math.max(1, integer(query.page, 1));
  const limit = Math.min(maxLimit, Math.max(1, integer(query.limit, defaultLimit)));
  return { page, limit, skip: (page - 1) * limit };
}
