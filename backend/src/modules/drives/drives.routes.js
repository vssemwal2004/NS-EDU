import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { requirePermission } from '../../middleware/auth.js';
import { bulkUpdateDrives, createDrive, driveQr, findDrive, listDrives, removeDrive, serializeDrive, updateDrive } from './drive-service.js';

// Mounted at /api/admin/drives behind drives.view. Each change checks its own permission, so the
// owner can grant view / create / edit / delete separately (see modules/access/permissions.js).
export const drivesRouter = Router();

// Archiving is the employee "delete" (registrations and leads stay); deleting for good is the master admin's.
const bulkGuard = (request, response, next) => requirePermission(request.body?.action === 'archive' ? 'drives.delete' : 'drives.edit')(request, response, next);

drivesRouter.get('/', async (request, response) => response.json(await listDrives(request.query)));
drivesRouter.post('/', requirePermission('drives.create'), async (request, response) => response.status(201).json({ item: await createDrive(request.body, request.admin) }));
drivesRouter.post('/bulk', bulkGuard, async (request, response) => response.json(await bulkUpdateDrives(request.body)));
drivesRouter.get('/:id', async (request, response) => response.json({ item: serializeDrive(await findDrive(request.params.id)) }));
drivesRouter.patch('/:id', requirePermission('drives.edit'), async (request, response) => response.json({ item: await updateDrive(request.params.id, request.body) }));
drivesRouter.delete('/:id', requirePermission('drives.delete'), async (request, response) => {
  const permanent = request.query.permanent === '1';
  if (permanent && !request.admin.isOwner) throw new HttpError(403, 'Only the master admin deletes drives for good. Archive it instead.');
  response.json(await removeDrive(request.params.id, { permanent }));
});

// Generated on every request from the immutable short code, so nothing is stored and edits never change it.
for (const format of ['png', 'svg']) {
  drivesRouter.get(`/:id/qr.${format}`, async (request, response) => {
    const qr = await driveQr(request.params.id, format, request.query);
    response.set('Content-Type', qr.type);
    if (request.query.download === '1') response.attachment(qr.filename);
    response.send(qr.body);
  });
}
