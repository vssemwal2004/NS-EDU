import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { queryString } from '../../lib/query.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { searchStatus, suggestEverything, warmSearch } from './search-store.js';

// Typeahead fires on every keystroke, so it gets a generous per-IP budget of its own.
const limiter = createRateLimiter({ windowMs: 60_000, max: 300 });
const limit = (request, _response, next) => {
  const { allowed, retryAfterSeconds } = limiter.hit(request.ip);
  if (!allowed) throw new HttpError(429, 'Too many searches. Please slow down.', { retryAfterSeconds });
  next();
};

export const searchRouter = Router();

// GET /api/search/suggest?q= — universities, courses, exams and places in one answer, typo-tolerant
// and short-form aware ("upes", "iit bombay", "petrolium"). Names and counts only, the same as the
// public /universities/suggest, so it needs no session; profiles stay behind the free-preview limit.
// Identical for every visitor, so browsers and CDNs may keep an answer for a short while.
searchRouter.get('/suggest', limit, async (request, response) => {
  const q = queryString(request.query.q, 120);
  const size = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 6, 1), 10);
  if (!q.trim()) { response.json({ query: '', corrected: '', universities: [], universityTotal: 0, courses: [], exams: [], places: [] }); return; }
  let result = suggestEverything(q, { limit: size });
  // Only on a cold start, before the first index build has finished: wait a little for it.
  if (!result) {
    await Promise.race([warmSearch(), new Promise((resolve) => { setTimeout(resolve, 4000).unref(); })]);
    result = suggestEverything(q, { limit: size });
  }
  if (!result) { response.set('Retry-After', '2'); throw new HttpError(503, 'Search is warming up. Please try again in a moment.', { warming: true }); }
  response.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  response.json(result);
});

searchRouter.get('/status', (_request, response) => {
  response.set('Cache-Control', 'no-store');
  response.json(searchStatus());
});
