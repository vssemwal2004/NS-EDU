// Students only see visible, non-rejected records. Unverified (imported/scraped) records are
// public but carry their source and date so the page can say where the facts came from.
// Kept in its own module so the search index (modules/search) can use it without a circular import.
export const PUBLIC_FILTER = Object.freeze({ active: { $ne: false }, verification: { $ne: 'rejected' } });
