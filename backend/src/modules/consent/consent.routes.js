import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { VISITOR_COOKIE, visitorCookieOptions } from '../insights/events.js';
import { CONSENT_COOKIE, consentCookieOptions, consentOf, recordConsent } from './consent.js';

// A visitor answers once, and may change their mind from the footer; this budget is generous for
// that and tight for a script inflating the counts.
const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export const consentRouter = Router();

consentRouter.post('/', (request, _response, next) => {
  const { allowed, retryAfterSeconds } = limiter.hit(request.ip);
  if (!allowed) throw new HttpError(429, 'Too many requests. Please try again shortly.', { retryAfterSeconds });
  next();
}, async (request, response) => {
  const choice = await recordConsent(request.body, { previous: consentOf(request) });
  response.cookie(CONSENT_COOKIE, choice, consentCookieOptions());
  // Withdrawing consent removes the personalisation id there and then, not at its expiry.
  if (choice !== 'all') {
    const { maxAge: _maxAge, ...options } = visitorCookieOptions();
    response.clearCookie(VISITOR_COOKIE, options);
  }
  response.set('Cache-Control', 'no-store').status(204).end();
});
