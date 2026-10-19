import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { isPlainObject } from '../../lib/validation.js';
import { CONTENT_KEYS } from './registry.js';
import { getContentDetail, getContentEntries, listContentEntries, resetContentEntry, restoreContentEntry, setContentEntry } from './content-service.js';

// Public: GET /api/content?keys=site,landing → { site: {...}, landing: {...} }.
export const contentRouter = Router();
contentRouter.get('/', async (request, response) => {
  const raw = typeof request.query.keys === 'string' ? request.query.keys : '';
  const keys = [...new Set(raw.split(',').map((key) => key.trim()).filter(Boolean))];
  const unknown = keys.filter((key) => !Object.hasOwn(CONTENT_KEYS, key));
  if (!keys.length || unknown.length) {
    throw new HttpError(400, unknown.length ? `Unknown content keys: ${unknown.join(', ').slice(0, 200)}` : 'Pass ?keys= with one or more content keys', { allowed: Object.keys(CONTENT_KEYS) });
  }
  response.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  response.json(await getContentEntries(keys));
});

// Admin (mounted under /api/admin/content after the administrator check).
const by = (request) => ({ updatedBy: request.admin?.email ?? null });

export const adminContentRouter = Router();
adminContentRouter.get('/', async (_request, response) => response.json({ items: await listContentEntries() }));
adminContentRouter.get('/:key', async (request, response) => response.json({ item: await getContentDetail(request.params.key) }));
adminContentRouter.put('/:key', async (request, response) => {
  const body = request.body;
  if (!isPlainObject(body) || !Object.hasOwn(body, 'data')) throw new HttpError(400, 'Send { "data": { ... } }');
  response.json({ item: await setContentEntry(request.params.key, body.data, { ...by(request), expectedUpdatedAt: body.updatedAt }) });
});
adminContentRouter.post('/:key/restore', async (request, response) => {
  response.json({ item: await restoreContentEntry(request.params.key, request.body?.index, by(request)) });
});
adminContentRouter.post('/:key/reset', async (request, response) => response.json({ item: await resetContentEntry(request.params.key, by(request)) }));
