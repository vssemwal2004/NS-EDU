import { Router } from 'express';
import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { cloudinaryConfig, cloudinaryFolder, destroyImage, isOwnDeliveryUrl, signedUploadParams } from '../../lib/cloudinary.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { assertValid, escapeRegex } from '../../lib/validation.js';

// Media library: the browser uploads straight to Cloudinary with a short-lived signature,
// then registers the result here so admins can reuse URLs (university logos, covers, site art).
export const mediaRouter = Router();

const USAGES = ['logo', 'cover', 'site', 'other'];
const serialize = ({ _id, ...rest }) => ({ id: _id.toString(), ...rest });
const requireConfigured = () => {
  if (!cloudinaryConfig().configured) throw new HttpError(503, 'Cloudinary is not configured on the server yet. Add the Cloudinary keys to backend/.env.');
};

mediaRouter.get('/config', (_request, response) => {
  const { configured, cloudName } = cloudinaryConfig();
  response.json({ configured, cloudName: configured ? cloudName : null, folder: cloudinaryFolder() });
});

mediaRouter.post('/sign', (request, response) => {
  requireConfigured();
  const { usage } = assertValid([{ name: 'usage', type: 'select', options: USAGES, default: 'other' }], request.body ?? {});
  response.json(signedUploadParams({ folder: `${cloudinaryFolder()}/${usage}`, tags: ['gyaan-vidhya', usage] }));
});

mediaRouter.post('/', async (request, response) => {
  requireConfigured();
  const body = assertValid([
    { name: 'url', type: 'url', required: true },
    { name: 'publicId', type: 'string', required: true, maxLength: 300 },
    { name: 'width', type: 'integer', nullable: true, min: 1, max: 50_000 },
    { name: 'height', type: 'integer', nullable: true, min: 1, max: 50_000 },
    { name: 'bytes', type: 'integer', nullable: true, min: 0, max: 200_000_000 },
    { name: 'format', type: 'string', maxLength: 10 },
    { name: 'alt', type: 'string', maxLength: 200 },
    { name: 'usage', type: 'select', options: USAGES, default: 'other' },
  ], request.body);
  if (!isOwnDeliveryUrl(body.url) || !body.publicId.startsWith(`${cloudinaryFolder()}/`)) throw new HttpError(400, 'Only images uploaded to this platform’s Cloudinary folder can be registered');
  const doc = { ...body, createdAt: new Date(), createdBy: request.admin.email };
  const media = await collection(COLLECTIONS.media);
  await media.updateOne({ publicId: body.publicId }, { $set: doc }, { upsert: true });
  response.status(201).json({ item: serialize(await media.findOne({ publicId: body.publicId })) });
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
  if (cloudinaryConfig().configured) await destroyImage(item.publicId);
  await media.deleteOne({ _id });
  response.status(204).end();
});
