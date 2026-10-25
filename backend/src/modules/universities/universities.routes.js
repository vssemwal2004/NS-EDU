import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { requireStudentOrAdmin } from '../../middleware/auth.js';
import { featuredUniversities, getUniversity, listUniversities, sitemapPage, suggestUniversities, universityFacets } from './university-service.js';

// The directory is for signed-in students (and console staff) only, so responses may be kept
// briefly by the viewer's own browser but never by a shared cache. Admin writes clear the API cache.
const privateCache = (_request, response, next) => {
  response.set({ 'Cache-Control': 'private, max-age=60', Vary: 'Cookie' });
  next();
};

// Typeahead fires on every keystroke, so it gets its own generous per-IP budget.
const suggestLimiter = createRateLimiter({ windowMs: 60_000, max: 240 });
const limitSuggest = (request, _response, next) => {
  const { allowed, retryAfterSeconds } = suggestLimiter.hit(request.ip);
  if (!allowed) throw new HttpError(429, 'Too many searches. Please slow down.', { retryAfterSeconds });
  next();
};

export const universitiesRouter = Router();

// Public: the small landing-page set. Everything below requires a session.
universitiesRouter.get('/featured', async (request, response) => {
  response.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  response.json(await featuredUniversities(request.query.limit, request.query.course));
});

universitiesRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
}, requireStudentOrAdmin, privateCache);
universitiesRouter.get('/', async (request, response) => response.json(await listUniversities(request.query)));
universitiesRouter.get('/suggest', limitSuggest, async (request, response) => response.json(await suggestUniversities(request.query.q, request.query.limit)));
universitiesRouter.get('/facets', async (request, response) => response.json(await universityFacets(request.query)));
universitiesRouter.get('/sitemap', async (request, response) => response.json(await sitemapPage(request.query.page)));
universitiesRouter.get('/:slug', async (request, response) => response.json(await getUniversity(request.params.slug)));
