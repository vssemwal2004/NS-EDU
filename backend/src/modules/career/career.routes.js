import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { optionalStudent } from '../../middleware/auth.js';
import { createCallbackLead, parseCallback, publicDirectory } from './career-service.js';

// Per-process limiters (see lib/rate-limit.js). Any email can sign up through OTP, so the
// contact list is also capped per student to slow down scraping of counsellors' numbers.
const contactReads = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 60 });
const callbacksPerIp = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

export const careerRouter = Router();

careerRouter.get('/fields', optionalStudent, async (request, response) => {
  response.set('Vary', 'Cookie');
  if (!request.student) {
    response.set('Cache-Control', 'public, max-age=60');
    return response.json(await publicDirectory({ withContacts: false }));
  }
  response.set('Cache-Control', 'private, no-store');
  const limit = contactReads.hit(request.student._id.toString());
  if (!limit.allowed) throw new HttpError(429, 'You have opened counsellor contacts many times in the last hour. Please try again later.', { retryAfterSeconds: limit.retryAfterSeconds });
  response.json(await publicDirectory({ withContacts: true }));
});

careerRouter.post('/callback', optionalStudent, async (request, response) => {
  response.set('Cache-Control', 'no-store');
  // Honeypot: a hidden field people never see. Bots that fill it get the normal answer and no lead.
  if (typeof request.body?.website === 'string' && request.body.website.trim()) return response.status(201).json({ ok: true, ref: null });
  const data = await parseCallback(request.body);
  const ipLimit = callbacksPerIp.hit(request.ip);
  if (!ipLimit.allowed) throw new HttpError(429, 'Too many callback requests from this network. Please try again later.', { retryAfterSeconds: ipLimit.retryAfterSeconds });
  const { ref } = await createCallbackLead(data, {
    student: request.student, ip: request.ip ?? '', userAgent: String(request.get('user-agent') ?? '').slice(0, 300),
  });
  response.status(201).json({ ok: true, ref });
});
