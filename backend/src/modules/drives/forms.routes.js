import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { checkFormToken, closeAtLimit, createDriveLead, formToken, leadForms, parseSubmission, publicForm, SHORT_CODE_PATTERN } from './drive-service.js';

// Public school drive forms (QR links). A whole school can share one Wi-Fi address, so the per-IP caps
// are generous and a per-form cap stops floods from many addresses. In-memory, per API process.
const positive = (raw, fallback) => (Number.isInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : fallback);
const perFormIp = createRateLimiter({ windowMs: 10 * 60 * 1000, max: positive(process.env.DRIVE_SUBMITS_PER_FORM_IP, 120) });
const perForm = createRateLimiter({ windowMs: 60 * 1000, max: positive(process.env.DRIVE_SUBMITS_PER_FORM_MINUTE, 60) });
const perIp = createRateLimiter({ windowMs: 60 * 60 * 1000, max: positive(process.env.DRIVE_SUBMITS_PER_IP_HOUR, 600) });

const CLOSED = 'Registration closed';
const code = (request) => {
  const value = String(request.params.code ?? '').toLowerCase();
  if (!SHORT_CODE_PATTERN.test(value)) throw new HttpError(404, 'Registration form not found');
  return value;
};
function limit(limiter, key, message) {
  const result = limiter.hit(key);
  if (!result.allowed) throw new HttpError(429, message, { retryAfterSeconds: result.retryAfterSeconds });
}

export const formsRouter = Router();
formsRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

formsRouter.get('/:code', async (request, response) => {
  const found = await publicForm(code(request));
  if (!found) throw new HttpError(404, 'Registration form not found');
  if (found.closed) throw new HttpError(410, CLOSED, found.closed);
  response.json({ form: found.form, token: formToken(found.id) });
});

formsRouter.post('/:code/submit', async (request, response) => {
  const shortCode = code(request);
  limit(perIp, request.ip, 'Too many registrations from this network. Please try again later.');
  // Honeypot: a hidden field people never see. Bots that fill it get a normal-looking answer and no lead.
  if (typeof request.body?.website === 'string' && request.body.website.trim()) return response.status(201).json({ ok: true, ref: null });
  // Read from the database, not the cache, so closing a drive takes effect at once.
  const doc = await (await leadForms()).findOne({ shortCode });
  if (!doc) throw new HttpError(404, 'Registration form not found');
  if (doc.status !== 'active') throw new HttpError(410, CLOSED);
  if (doc.maxSubmissions && (doc.submissionCount ?? 0) >= doc.maxSubmissions) {
    await closeAtLimit(doc._id);
    throw new HttpError(410, CLOSED);
  }
  const formId = doc._id.toString();
  // Cheapest checks first, and the drive-wide bucket last: junk posts, retries and typing mistakes must
  // not use up the budget every student in the hall shares, and one address cannot drain it alone.
  const token = checkFormToken(request.body?.token, formId);
  if (token === 'too-fast') throw new HttpError(400, 'Please check your details, then submit again.', { retry: true });
  if (token !== 'ok') throw new HttpError(400, 'This page has been open too long. Reload it and submit again.', { tokenExpired: true });
  limit(perFormIp, `${formId}:${request.ip}`, 'Too many registrations from this network. Please try again in a few minutes.');
  const data = parseSubmission(doc, request.body);
  limit(perForm, formId, 'Many students are registering right now. Please wait a minute and submit again.');
  const { ref, created } = await createDriveLead(doc, data, {
    ip: request.ip ?? '', userAgent: String(request.get('user-agent') ?? '').slice(0, 300),
  });
  response.status(created ? 201 : 200).json({ ok: true, ref, ...(!created && { alreadyRegistered: true }) });
});
