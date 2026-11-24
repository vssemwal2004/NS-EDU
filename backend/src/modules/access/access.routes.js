import { Router } from 'express';
import { requireOwnerAdmin, requirePermission } from '../../middleware/auth.js';
import {
  bulkStaffPermissions, createStaff, getStaffPermissions, listAudit, listStaff, listStaffPage, removeStaff, resetStaffPassword, setStaffPermissions, updateStaff,
} from './access-service.js';
import {
  ACCESS_PRESETS, DEFAULT_EMPLOYEE_PERMISSIONS, PERMISSION_ACTIONS, PERMISSION_GROUPS, PERMISSION_MODULES, PERMISSIONS, ROLE_COLORS,
} from './permissions.js';

// Mounted at /api/admin/access. Reading the team needs `team.view`; staff account changes need `team.manage`;
// what an employee may do (their permissions) is changed by the master admin only (checked in the service).
export const accessRouter = Router();

// The catalogue is only labels and hints; every signed-in staff member may read it ("What I can do").
accessRouter.get('/catalogue', (_request, response) => {
  response.json({
    groups: PERMISSION_GROUPS, modules: PERMISSION_MODULES, actions: PERMISSION_ACTIONS, permissions: PERMISSIONS,
    defaults: DEFAULT_EMPLOYEE_PERMISSIONS, presets: ACCESS_PRESETS, colors: ROLE_COLORS,
  });
});

// `?page=` returns one server-filtered page ({ items, total, page, limit, counts }); without it, every account (older clients).
accessRouter.get('/staff', requirePermission('team.view', 'team.manage'), async (request, response) => {
  response.json(request.query.page !== undefined ? await listStaffPage(request.query) : { items: await listStaff() });
});
accessRouter.post('/staff/permissions/bulk', requireOwnerAdmin, async (request, response) => response.json(await bulkStaffPermissions(request.admin, request.body)));
accessRouter.get('/staff/:id/permissions', requirePermission('team.view', 'team.manage'), async (request, response) => response.json({ item: await getStaffPermissions(request.params.id) }));
accessRouter.put('/staff/:id/permissions', requireOwnerAdmin, async (request, response) => response.json({ item: await setStaffPermissions(request.admin, request.params.id, request.body) }));
accessRouter.post('/staff', requirePermission('team.manage'), async (request, response) => response.status(201).json({ item: await createStaff(request.admin, request.body) }));
accessRouter.patch('/me', async (request, response) => {
  const { name, phone } = request.body ?? {};
  if (name === undefined && phone === undefined) return response.status(400).json({ error: 'Choose a profile field to update' });
  response.json({ item: await updateStaff(request.admin, request.admin._id, { name, phone }) });
});
accessRouter.patch('/staff/:id', requirePermission('team.manage'), async (request, response) => response.json({ item: await updateStaff(request.admin, request.params.id, request.body) }));
accessRouter.delete('/staff/:id', requirePermission('team.manage'), async (request, response) => {
  await removeStaff(request.admin, request.params.id);
  response.status(204).end();
});
accessRouter.post('/staff/:id/password', requirePermission('team.manage'), async (request, response) => {
  await resetStaffPassword(request.admin, request.params.id, request.body?.password);
  response.status(204).end();
});

accessRouter.get('/audit', requirePermission('audit.view'), async (request, response) => response.json(await listAudit(request.query)));
