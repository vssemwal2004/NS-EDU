import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { loadViewer } from '../../middleware/auth.js';
import { placeFilter } from '../catalog/catalog-service.js';
import { claimFreeView, previewIdOf, previewOfList } from './free-preview.js';
import { featuredUniversities, getUniversity, listUniversities, sitemapPage, suggestUniversities, universityFacets } from './university-service.js';

// Signed-in answers may be kept briefly by the viewer's own browser but never by a shared cache.
// A signed-out visitor's answer depends on their free-view count, so it is never stored at all.
const privateCache = (request, response) => {
  response.set(request.viewer
    ? { 'Cache-Control': 'private, max-age=60', Vary: 'Cookie' }
    : { 'Cache-Control': 'no-store', Vary: 'Cookie' });
};

// Typeahead fires on every keystroke, so it gets its own generous per-IP budget.
const suggestLimiter = createRateLimiter({ windowMs: 60_000, max: 240 });
const limitSuggest = (request, _response, next) => {
  const { allowed, retryAfterSeconds } = suggestLimiter.hit(request.ip);
  if (!allowed) throw new HttpError(429, 'Too many searches. Please slow down.', { retryAfterSeconds });
  next();
};

// A session (student or console staff) when there is one; signed-out visitors carry on with the preview rules.
async function viewerOrPreview(request, response, next) {
  request.viewer = await loadViewer(request);
  request.student = request.viewer?.student ?? null;
  request.admin = request.viewer?.admin ?? null;
  privateCache(request, response);
  next();
}

function requireViewer(request, _response, next) {
  if (!request.viewer) throw new HttpError(401, 'Sign in to search and view universities.', { loginRequired: true });
  next();
}

export const universitiesRouter = Router();

// Public: the small landing-page set.
universitiesRouter.get('/featured', async (request, response) => {
  response.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  response.json(await featuredUniversities(request.query.limit, request.query.course));
});

universitiesRouter.use(viewerOrPreview);
// Destination tiles link with a city and no state (the city facet always sends a state), and their
// counts fold aliases and districts, so those links get the tile's own row set.
universitiesRouter.get('/', async (request, response) => {
  const { city, state } = request.query;
  const place = typeof city === 'string' && !state ? await placeFilter(city.trim().slice(0, 80)) : null;
  const result = await listUniversities(request.query, { place });
  // Signed out: the first few results are free; `preview.locked` says how many more a login unlocks.
  response.json(request.viewer ? result : previewOfList(result));
});
// Names and counts only, so searching and filtering work before login; the details they lead to are what the preview limits.
universitiesRouter.get('/suggest', limitSuggest, async (request, response) => response.json(await suggestUniversities(request.query.q, request.query.limit)));
universitiesRouter.get('/facets', async (request, response) => response.json(await universityFacets(request.query)));
universitiesRouter.get('/sitemap', requireViewer, async (request, response) => response.json(await sitemapPage(request.query.page)));
universitiesRouter.get('/:slug', async (request, response) => {
  // Looked up first, so a mistyped address answers 404 instead of spending one of the free views.
  const detail = await getUniversity(request.params.slug);
  if (request.viewer) { response.json(detail); return; }
  const claim = await claimFreeView(previewIdOf(request, response), detail.item.id);
  const preview = { used: claim.used, limit: claim.limit, remaining: Math.max(0, claim.limit - claim.used) };
  if (!claim.allowed) {
    throw new HttpError(401, claim.limit
      ? `You have used your ${claim.limit} free university views. Log in to keep exploring.`
      : 'Sign in to view university profiles.', { loginRequired: true, freeLimitReached: Boolean(claim.limit), preview });
  }
  // `detail` is shared by every request (it comes from a cache), so the preview note goes on a copy.
  response.json({ ...detail, preview });
});
