import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { COLLECTIONS, getDb } from '../../db/collections.js';

/**
 * Free preview of the university directory for visitors who have not signed in.
 *
 * A visitor may open FREE_UNIVERSITY_VIEWS (default 2) different university profiles, and sees the
 * first FREE_UNIVERSITY_VIEWS results of any search. Past that the API answers 401 and the site asks
 * them to log in, so the choice to sign up comes after they have seen what the directory offers.
 *
 * The count lives on the server, in `preview_views`, keyed by a random id in the `gv_preview` cookie.
 * That is what makes it work for server-rendered pages (which cannot set cookies themselves) and keeps
 * it out of reach of a script that edits page state. The cookie is a strictly-necessary one: it holds
 * only that random id, no personal data, and is never used for recommendations (see consent.js).
 * Clearing cookies starts a fresh preview — this is a soft wall by design, not a security boundary.
 */
export const PREVIEW_COOKIE = 'gv_preview';
export const PREVIEW_DAYS = 30;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_FREE_VIEWS = 2;

/** How many profiles (and search results) a signed-out visitor sees. 0 turns the preview off. */
export function freeViewLimit() {
  const value = Number.parseInt(process.env.FREE_UNIVERSITY_VIEWS ?? '', 10);
  return Number.isInteger(value) && value >= 0 && value <= 20 ? value : DEFAULT_FREE_VIEWS;
}

export const previewCookieOptions = () => ({
  httpOnly: true, sameSite: 'lax', secure: env.isProduction, path: '/', maxAge: PREVIEW_DAYS * 24 * 60 * 60 * 1000,
});

/** The visitor's preview id from their cookie, minting one (and setting the cookie) when it is missing or malformed. */
export function previewIdOf(request, response) {
  const current = request.cookies?.[PREVIEW_COOKIE];
  if (UUID_PATTERN.test(current ?? '')) return current;
  const id = randomUUID();
  response.cookie(PREVIEW_COOKIE, id, previewCookieOptions());
  return id;
}

/**
 * Counts one profile against the visitor's free views. Re-opening a profile already counted is free,
 * so refreshing a page never costs a view. Returns { allowed, used, limit }.
 */
export async function claimFreeView(id, slug, attempt = 0) {
  const limit = freeViewLimit();
  if (!limit) return { allowed: false, used: 0, limit };
  const views = (await getDb()).collection(COLLECTIONS.previewViews);
  try {
    // One atomic round trip: the row matches when this profile is already counted, or while the slot
    // of the last allowed view is still empty — so two tabs cannot slip past the limit together.
    const row = await views.findOneAndUpdate(
      { _id: id, $or: [{ slugs: slug }, { [`slugs.${limit - 1}`]: { $exists: false } }] },
      { $addToSet: { slugs: slug }, $set: { at: new Date() } },
      { upsert: true, returnDocument: 'after', projection: { slugs: 1 } },
    );
    return { allowed: true, used: row?.slugs?.length ?? 1, limit };
  } catch (error) {
    if (error.code !== 11000) throw error;
    // The row exists but matched neither branch: every free view is used, on other profiles. (The
    // first view of a brand-new visitor from two tabs at once can also collide here; one retry
    // tells the two cases apart.)
    if (attempt === 0) {
      const row = await views.findOne({ _id: id }, { projection: { slugs: 1 } });
      if (row && (row.slugs ?? []).length < limit) return claimFreeView(id, slug, 1);
    }
    return { allowed: false, used: limit, limit };
  }
}

/** What a signed-out visitor sees of a search: the first `limit` results, plus how many are held back. */
export function previewOfList(result, limit = freeViewLimit()) {
  const items = result.page === 1 ? result.items.slice(0, limit) : [];
  return { ...result, items, pages: 1, preview: { limit, shown: items.length, total: result.total, locked: Math.max(0, result.total - items.length) } };
}
