import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.js';
import {
  createRole, createStaff, deleteRole, listAudit, listRoles, listStaff, removeStaff, resetStaffPassword, updateRole, updateStaff,
} from './access-service.js';
import { PERMISSION_GROUPS, PERMISSIONS, ROLE_COLORS } from './permissions.js';

// Mounted at /api/admin/access. Reading the team and roles needs `team.view`; every change has its own permission.
export const accessRouter = Router();

// The catalogue is only labels and hints; anyone who can open Team & access may read it ("What I can do").
accessRouter.get('/catalogue', requirePermission('team.view', 'roles.manage', 'team.manage', 'audit.view'), (_request, response) => {
  response.json({ groups: PERMISSION_GROUPS, permissions: PERMISSIONS, colors: ROLE_COLORS });
});

accessRouter.get('/roles', requirePermission('team.view', 'roles.manage', 'team.manage'), async (_request, response) => response.json({ items: await listRoles() }));
accessRouter.post('/roles', requirePermission('roles.manage'), async (request, response) => response.status(201).json({ item: await createRole(request.admin, request.body) }));
accessRouter.patch('/roles/:slug', requirePermission('roles.manage'), async (request, response) => response.json({ item: await updateRole(request.admin, request.params.slug, request.body) }));
accessRouter.delete('/roles/:slug', requirePermission('roles.manage'), async (request, response) => {
  await deleteRole(request.admin, request.params.slug);
  response.status(204).end();
});

accessRouter.get('/staff', requirePermission('team.view', 'team.manage'), async (_request, response) => response.json({ items: await listStaff() }));
accessRouter.post('/staff', requirePermission('team.manage'), async (request, response) => response.status(201).json({ item: await createStaff(request.admin, request.body) }));
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
