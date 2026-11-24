import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireJwtSecret } from '../../config/env.js';
import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { cloudinaryConfig, destroyImage, isOwnDeliveryUrl } from '../../lib/cloudinary.js';
import { deleteObject, objectInfo, objectKey, publicUrlFor, r2Config, signBrowserUpload } from '../../lib/r2.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { assertValid, escapeRegex, slugify } from '../../lib/validation.js';

// The browser sends only upload metadata here. The image goes directly into the public R2 bucket.
export const mediaRouter = Router();

const USAGES = ['logo', 'cover', 'site', 'place', 'counsellor', 'other'];
const FORMATS = { webp: 'image/webp', png: 'image/png', jpeg: 'image/jpeg', avif: 'image/avif', gif: 'image/gif' };
const RECEIPT_AUDIENCE = 'nsedu-media-upload';
const serialize = ({ _id, ...rest }) => ({ id: _id.toString(), ...rest });
const requireConfigured = () => {
  if (!r2Config().configured) throw new HttpError(503, 'Configure R2 image storage to enable uploads.');
};

mediaRouter.get('/config', (_request, response) => {
  response.json({ configured: r2Config().configured, provider: 'r2' });
});

mediaRouter.post('/sign', (request, response) => {
  requireConfigured();
  const { filename, usage, width, height, format, bytes } = assertValid([
    { name: 'filename', type: 'string', maxLength: 255 },
    { name: 'usage', type: 'select', options: USAGES, default: 'other' },
    { name: 'width', type: 'integer', required: true, min: 1, max: 8192 },
    { name: 'height', type: 'integer', required: true, min: 1, max: 8192 },
    { name: 'format', type: 'select', required: true, options: Object.keys(FORMATS) },
    { name: 'bytes', type: 'integer', required: true, min: 1, max: 8 * 1024 * 1024 },
  ], request.body);
  const basename = slugify(filename.replace(/\.[^.]+$/, '')).slice(0, 64) || 'image';
  const key = objectKey(`media/${usage}/${basename}-${randomUUID()}.${format}`);
  const receipt = jwt.sign({ key, width, height, format, bytes, usage }, requireJwtSecret(), {
    algorithm: 'HS256', audience: RECEIPT_AUDIENCE, subject: String(request.admin._id), expiresIn: '30m',
  });
  response.json({ ...signBrowserUpload(key, FORMATS[format], bytes), receipt });
});

mediaRouter.post('/', async (request, response) => {
  requireConfigured();
  const { receipt, alt } = assertValid([
    { name: 'receipt', type: 'string', required: true, maxLength: 2048 },
    { name: 'alt', type: 'string', maxLength: 200 },
  ], request.body);
  let upload;
  try {
    upload = jwt.verify(receipt, requireJwtSecret(), { algorithms: ['HS256'], audience: RECEIPT_AUDIENCE, subject: String(request.admin._id) });
  } catch { throw new HttpError(400, 'This upload receipt is invalid or expired. Choose the image again.'); }
  const { key, width, height, format, bytes, usage } = upload;
  const info = await objectInfo(key);
  if (!info || info.contentType !== FORMATS[format] || info.bytes !== bytes) throw new HttpError(409, 'R2 could not verify the uploaded image.');
  const url = publicUrlFor(key);
  const check = await fetch(url, { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!check.ok || check.headers.get('content-type') !== FORMATS[format]) throw new HttpError(502, 'The uploaded image is not accessible at its public R2 address.');
  const doc = { publicId: key, storage: 'r2', url, width, height, format, bytes, usage, alt, createdAt: new Date(), createdBy: request.admin.email };
  const media = await collection(COLLECTIONS.media);
  await media.updateOne({ publicId: key }, { $setOnInsert: doc }, { upsert: true });
  response.status(201).json({ item: serialize(await media.findOne({ publicId: key })) });
});

mediaRouter.get('/', async (request, response) => {
  const { page, limit, skip } = pagination(request.query, { defaultLimit: 24, maxLimit: 60 });
  const q = queryString(request.query.q, 80);
  const usage = USAGES.includes(request.query.usage) ? request.query.usage : '';
  const filter = { ...(usage && { usage }), ...(q && { $or: [{ alt: { $regex: escapeRegex(q), $options: 'i' } }, { publicId: { $regex: escapeRegex(q), $options: 'i' } }] }) };
  const media = await collection(COLLECTIONS.media);
  const [items, total] = await Promise.all([media.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(), media.countDocuments(filter)]);
  response.json({ items: items.map(serialize), total, page, limit });
});

mediaRouter.delete('/:id', async (request, response) => {
  const _id = toObjectId(request.params.id);
  const media = await collection(COLLECTIONS.media);
  const item = _id && await media.findOne({ _id });
  if (!item) throw new HttpError(404, 'Image not found');
  if (item.storage === 'r2') {
    requireConfigured();
    if (item.publicId.startsWith(objectKey('media/')) && item.url === publicUrlFor(item.publicId)) await deleteObject(item.publicId);
  } else if (cloudinaryConfig().configured && isOwnDeliveryUrl(item.url)) await destroyImage(item.publicId);
  await media.deleteOne({ _id });
  response.status(204).end();
});
