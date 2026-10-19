import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { queryString } from '../../lib/query.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { optionalStudent, requireStudentOrAdmin } from '../../middleware/auth.js';
import { recordEvents, withVisitor } from './events.js';
import { recommendUniversities } from './recommend.js';

// One batch carries up to 20 events and the client sends at most one batch every 5 seconds,
// so these budgets are generous for a real viewer and tight for a script.
const captureLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
const recommendLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const limit = (limiter, message) => (request, _response, next) => {
  const { allowed, retryAfterSeconds } = limiter.hit(request.ip);
  if (!allowed) throw new HttpError(429, message, { retryAfterSeconds });
  next();
};

export const insightsRouter = Router();
insightsRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
}, optionalStudent, withVisitor);

insightsRouter.post('/events', limit(captureLimiter, 'Too many events. Please slow down.'), async (request, response) => {
  const result = await recordEvents(request.body, { studentId: request.student?._id ?? null, visitorId: request.visitorId });
  response.status(202).json(result);
});

// Recommendations hand back directory records, so they sit behind the same gate as /api/universities.
// Capture above stays open: a visitor may search before signing in, and those events follow them in.
insightsRouter.get('/recommendations', requireStudentOrAdmin, limit(recommendLimiter, 'Too many requests. Please try again shortly.'), async (request, response) => {
  response.json(await recommendUniversities({
    studentId: request.student?._id ?? null,
    visitorId: request.visitorId,
    limit: request.query.limit,
    exclude: queryString(request.query.exclude, 100).toLowerCase(),
  }));
});
