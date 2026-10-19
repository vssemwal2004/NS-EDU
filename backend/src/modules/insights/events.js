import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { COLLECTIONS, getDb } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';

/**
 * Student activity capture.
 *
 * WHAT IS STORED (and nothing else) in `student_events`:
 *   studentId        the signed-in student's _id, or null
 *   visitorId        a random first-party UUID kept in the http-only `gv_visitor` cookie
 *   type             one of EVENT_TYPES
 *   query            the text the viewer typed, trimmed to 120 characters
 *   institutionSlug  the institution the event is about
 *   state/city/stream/courseSlug   the declared filter values
 *   results          how many results a search returned (powers the admin content-gap list)
 *   path             the route only — any query string or hash is stripped before storing
 *   at               when it happened (clamped to a sane window)
 *
 * Never stored: IP address, user-agent, referrer, full URLs or any other free-form payload.
 * Raw rows expire after RETENTION_DAYS through the TTL index on `at` (see db/indexes.js).
 */
export const EVENTS_COLLECTION = COLLECTIONS.studentEvents;
export const VISITOR_COOKIE = 'gv_visitor';
export const RETENTION_DAYS = 180;
export const VISITOR_MAX_AGE_SECONDS = RETENTION_DAYS * 24 * 60 * 60;
export const EVENT_TYPES = Object.freeze(['search', 'view', 'filter', 'apply-open', 'compare']);
export const MAX_EVENTS_PER_REQUEST = 20;
export const MAX_TEXT = 120;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_PATTERN = /^\/[\w\-./]*$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;
const MAX_FUTURE_MS = 60_000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const eventsCollection = async () => (await getDb()).collection(EVENTS_COLLECTION);

const text = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '');
const slug = (value) => { const cleaned = text(value).toLowerCase(); return SLUG_PATTERN.test(cleaned) ? cleaned : ''; };
// Routes only: everything from the first ? or # is dropped so no search terms arrive twice.
const route = (value) => { const cleaned = text(value).split(/[?#]/)[0]; return PATH_PATTERN.test(cleaned) ? cleaned : ''; };

function timestamp(value, now) {
  const parsed = typeof value === 'number' ? new Date(value) : typeof value === 'string' ? new Date(value) : null;
  const ms = parsed?.getTime();
  if (!Number.isFinite(ms) || ms > now.getTime() + MAX_FUTURE_MS || ms < now.getTime() - MAX_AGE_MS) return now;
  return new Date(ms);
}

/** One client event -> a storable row, or null when it is unknown or carries nothing to learn from. */
export function normalizeEvent(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!EVENT_TYPES.includes(raw.type)) return null;
  const event = {
    type: raw.type,
    query: text(raw.query),
    institutionSlug: slug(raw.institutionSlug),
    state: text(raw.state),
    city: text(raw.city),
    stream: text(raw.stream),
    courseSlug: slug(raw.courseSlug),
    results: Number.isInteger(raw.results) && raw.results >= 0 && raw.results <= 1_000_000 ? raw.results : null,
    path: route(raw.path),
    at: timestamp(raw.at, now),
  };
  const signal = event.query || event.institutionSlug || event.state || event.city || event.stream || event.courseSlug;
  return signal ? event : null;
}

export const visitorCookieOptions = () => ({
  httpOnly: true, sameSite: 'lax', secure: env.isProduction, path: '/', maxAge: VISITOR_MAX_AGE_SECONDS * 1000,
});

/** Reads the first-party visitor id, minting and setting one when it is missing or malformed. */
export function withVisitor(request, response, next) {
  const current = request.cookies?.[VISITOR_COOKIE];
  request.visitorId = UUID_PATTERN.test(current ?? '') ? current : randomUUID();
  if (request.visitorId !== current) response.cookie(VISITOR_COOKIE, request.visitorId, visitorCookieOptions());
  next();
}

/** Validates, caps and stores a batch. Unknown or empty events are dropped silently, not rejected. */
export async function recordEvents(body, { studentId = null, visitorId }) {
  const list = Array.isArray(body?.events) ? body.events : Array.isArray(body) ? body : null;
  if (!list) throw new HttpError(400, 'Send { events: [...] }');
  if (list.length > MAX_EVENTS_PER_REQUEST) throw new HttpError(400, `Send at most ${MAX_EVENTS_PER_REQUEST} events per request`);
  const now = new Date();
  const docs = [];
  for (const raw of list) {
    const event = normalizeEvent(raw, now);
    if (event) docs.push({ studentId: studentId ?? null, visitorId, ...event });
  }
  if (docs.length) await (await eventsCollection()).insertMany(docs, { ordered: false });
  return { accepted: docs.length, dropped: list.length - docs.length };
}
