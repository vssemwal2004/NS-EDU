import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { requireStudent } from '../../middleware/auth.js';
import { CONSENT_TEXT, LIMITS, parseReview, REVIEWER_STAGES } from './schema.js';
import {
  deleteOwnReview, deleteReview, getOwnReview, listForModeration, listHighlights, listPublic, moderateReview, reviewSummary, saveOwnReview,
} from './reviews-service.js';

// Per-process limiter (see lib/rate-limit.js); one review per account is enforced in the database.
const savesPerIp = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 });
const shared = (response) => response.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
const privateOnly = (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); };

// Public: /api/reviews
export const reviewsRouter = Router();

reviewsRouter.get('/', async (request, response) => {
  const result = await listPublic(request.query);
  if (!request.query.cursor) shared(response);
  response.json(result);
});
reviewsRouter.get('/summary', async (_request, response) => { shared(response); response.json(await reviewSummary()); });
reviewsRouter.get('/highlights', async (request, response) => { shared(response); response.json(await listHighlights(request.query)); });
// The form's fixed choices and limits, so the browser never drifts from the server's rules.
reviewsRouter.get('/form', (_request, response) => {
  shared(response);
  response.json({ stages: Object.entries(REVIEWER_STAGES).map(([id, label]) => ({ id, label })), limits: LIMITS, consentText: CONSENT_TEXT });
});

reviewsRouter.get('/mine', privateOnly, requireStudent, async (request, response) => {
  response.json({ item: await getOwnReview(request.student._id) });
});
reviewsRouter.put('/mine', privateOnly, requireStudent, async (request, response) => {
  const limit = savesPerIp.hit(request.ip);
  if (!limit.allowed) throw new HttpError(429, 'Too many reviews from this network. Please try again later.', { retryAfterSeconds: limit.retryAfterSeconds });
  const data = parseReview(request.body);
  const item = await saveOwnReview(request.student, data, { ip: request.ip ?? '', userAgent: String(request.get('user-agent') ?? '') });
  response.json({ item });
});
reviewsRouter.delete('/mine', privateOnly, requireStudent, async (request, response) => {
  if (!await deleteOwnReview(request.student._id)) throw new HttpError(404, 'You have not written a review yet');
  response.status(204).end();
});

// Admin: /api/admin/reviews (mounted behind the content.edit permission)
export const adminReviewsRouter = Router();
adminReviewsRouter.get('/', async (request, response) => response.json(await listForModeration(request.query)));
adminReviewsRouter.patch('/:id', async (request, response) => response.json({ item: await moderateReview(request.params.id, request.body, request.admin) }));
adminReviewsRouter.delete('/:id', async (request, response) => {
  await deleteReview(request.params.id, request.admin);
  response.status(204).end();
});
