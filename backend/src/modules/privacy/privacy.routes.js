import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { createRateLimiter } from '../../lib/rate-limit.js';
import { requirePermission, requireStudent } from '../../middleware/auth.js';
import { parseAccountRequest, parsePublicRequest, parseResolution, RELATIONSHIPS, REQUEST_TYPES, RESPONSE_TIME_TEXT } from './privacy-model.js';
import {
  addNote, anonymiseForRequest, createRequest, exportMyData, listRequests, myData, receiptOf, requestDetail, resolveRequest, stopContactForRequest, withdrawForStudent,
} from './privacy-service.js';

// Per-process limiters (see lib/rate-limit.js). The public form needs no login, so it is capped per network.
const publicPerIp = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
const accountPerStudent = createRateLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 10 });
const exportsPerStudent = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const limit = (limiter, key, message) => {
  const result = limiter.hit(key);
  if (!result.allowed) throw new HttpError(429, message, { retryAfterSeconds: result.retryAfterSeconds });
};
const meta = (request) => ({ ip: request.ip ?? '', userAgent: String(request.get('user-agent') ?? '').slice(0, 300) });

// Public and student endpoints: /api/privacy
export const privacyRouter = Router();
privacyRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

privacyRouter.get('/options', (_request, response) => response.json({ types: REQUEST_TYPES, relationships: RELATIONSHIPS, responseTime: RESPONSE_TIME_TEXT }));

privacyRouter.post('/requests', async (request, response) => {
  // Honeypot: a hidden field people never see. Bots that fill it get a normal-looking answer and nothing is stored.
  if (typeof request.body?.website === 'string' && request.body.website.trim()) return response.status(201).json({ ok: true, ref: null, responseTime: RESPONSE_TIME_TEXT });
  limit(publicPerIp, request.ip, 'Too many requests from this network. Please try again later, or write to us by email.');
  const data = parsePublicRequest(request.body);
  const doc = await createRequest({ ...data, source: 'public-form', ...meta(request) });
  response.status(201).json({ ok: true, ...receiptOf(doc) });
});

privacyRouter.get('/me', requireStudent, async (request, response) => response.json(await myData(request.student)));

privacyRouter.get('/me/export', requireStudent, async (request, response) => {
  limit(exportsPerStudent, request.student._id.toString(), 'You have downloaded your data many times in the last hour. Please try again later.');
  const now = new Date();
  const data = await exportMyData(request.student, now);
  response.set('Content-Disposition', `attachment; filename="gyaan-vidhya-my-data-${now.toISOString().slice(0, 10)}.json"`);
  response.type('application/json').send(JSON.stringify(data, null, 2));
});

privacyRouter.post('/me/requests', requireStudent, async (request, response) => {
  const data = parseAccountRequest(request.body);
  limit(accountPerStudent, request.student._id.toString(), 'You have sent many requests today. Please try again tomorrow.');
  const { student } = request;
  const doc = await createRequest({
    ...data, source: 'account', studentId: student._id, subjectName: student.name ?? '', ...meta(request),
    requester: { name: student.name ?? '', email: student.email ?? '', phone: student.phone ?? '', relationship: 'self' },
  });
  response.status(201).json({ ok: true, ...receiptOf(doc) });
});

privacyRouter.post('/me/withdraw-consent', requireStudent, async (request, response) => {
  limit(accountPerStudent, request.student._id.toString(), 'You have sent many requests today. Please try again tomorrow.');
  response.status(201).json({ ok: true, ...await withdrawForStudent(request.student, meta(request)) });
});

// Staff queue: /api/admin/privacy (mounted behind requirePermission('privacy.view', 'privacy.manage') in
// admin.routes.js). Reading needs privacy.view; every change needs privacy.manage.
export const adminPrivacyRouter = Router();
const manage = requirePermission('privacy.manage');

adminPrivacyRouter.get('/requests', async (request, response) => response.json(await listRequests(request.query)));
adminPrivacyRouter.get('/requests/:id', async (request, response) => response.json(await requestDetail(request.params.id)));
adminPrivacyRouter.patch('/requests/:id', manage, async (request, response) => {
  response.json({ item: await resolveRequest(request.admin, request.params.id, parseResolution(request.body)) });
});
adminPrivacyRouter.post('/requests/:id/notes', manage, async (request, response) => {
  response.status(201).json({ item: await addNote(request.admin, request.params.id, request.body?.text) });
});
adminPrivacyRouter.post('/requests/:id/anonymise', manage, async (request, response) => {
  response.json(await anonymiseForRequest(request.admin, request.params.id, { leadIds: request.body?.leadIds, deleteAccount: request.body?.deleteAccount === true }));
});
adminPrivacyRouter.post('/requests/:id/stop-contact', manage, async (request, response) => {
  response.json(await stopContactForRequest(request.admin, request.params.id, { leadIds: request.body?.leadIds }));
});
