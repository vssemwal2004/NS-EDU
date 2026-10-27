import { Router } from 'express';
import { createDrive, driveQr, findDrive, listDrives, removeDrive, serializeDrive, updateDrive } from './drive-service.js';

// Mounted at /api/admin/drives after the owner-only guard: employees never manage drives.
export const drivesRouter = Router();

drivesRouter.get('/', async (request, response) => response.json(await listDrives(request.query)));
drivesRouter.post('/', async (request, response) => response.status(201).json({ item: await createDrive(request.body, request.admin) }));
drivesRouter.get('/:id', async (request, response) => response.json({ item: serializeDrive(await findDrive(request.params.id)) }));
drivesRouter.patch('/:id', async (request, response) => response.json({ item: await updateDrive(request.params.id, request.body) }));
drivesRouter.delete('/:id', async (request, response) => response.json(await removeDrive(request.params.id, { permanent: request.query.permanent === '1' })));

// Generated on every request from the immutable short code, so nothing is stored and edits never change it.
for (const format of ['png', 'svg']) {
  drivesRouter.get(`/:id/qr.${format}`, async (request, response) => {
    const qr = await driveQr(request.params.id, format, request.query);
    response.set('Content-Type', qr.type);
    if (request.query.download === '1') response.attachment(qr.filename);
    response.send(qr.body);
  });
}
