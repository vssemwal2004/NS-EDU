import { Router } from 'express';
import { requireAdmin, requirePermission, requireReadyStaff } from '../../middleware/auth.js';
import { COLLECTIONS } from '../../db/collections.js';
import { accessRouter } from '../access/access.routes.js';
import { can, createStaff, listStaff } from '../access/access-service.js';
import { crmRouter } from '../crm/crm.routes.js';
import { getDashboard } from './dashboard.js';
import { homeSummary } from './home.js';
import { describeResources } from './resources.js';
import { bulkItems, createItem, deleteItem, getItem, listItems, resourceStats, updateItem } from './resource-service.js';
import { assignStudent, listStudents, updateStudent } from './students.js';
import { referenceStudentsRouter } from './reference-students.routes.js';
import { accountStudentsRouter } from './account-students.routes.js';
import { bulkAssignStudents } from './employee-assignments.js';
import { dataOpsRouter } from './data-ops.routes.js';
import { mediaRouter } from './media.routes.js';
import { leadsRouter } from '../applications/leads.routes.js';
import { adminContentRouter } from '../content/content.routes.js';
import { adminInsightsRouter } from './insights.routes.js';
import { drivesRouter } from '../drives/drives.routes.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin, requireReadyStaff);
adminRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

// Every area below is guarded by the permission that names it (see modules/access/permissions.js).
adminRouter.use('/access', accessRouter);
adminRouter.use('/reference-students', referenceStudentsRouter);
adminRouter.use('/account-students', accountStudentsRouter);
adminRouter.use('/leads', leadsRouter);
adminRouter.use('/crm', crmRouter);

adminRouter.use('/data-ops', requirePermission('data.manage'), dataOpsRouter);
// Image upload backs the image fields of every editor, so anyone who can edit those areas can use it.
adminRouter.use('/media', requirePermission('media.manage', 'catalogue.edit', 'locations.edit', 'career.manage', 'content.edit'), mediaRouter);
adminRouter.use('/content', requirePermission('content.edit'), adminContentRouter);
adminRouter.use('/insights', requirePermission('analytics.search'), adminInsightsRouter);
adminRouter.use('/drives', requirePermission('drives.manage'), drivesRouter);
adminRouter.get('/dashboard', requirePermission('dashboard.view'), async (_request, response) => response.json(await getDashboard()));
// The console home: every signed-in staff member; each section follows their own permissions.
adminRouter.get('/home', async (request, response) => response.json(await homeSummary(request.admin)));

// Which permission opens which generic editor. A resource not listed here stays owner-only.
const RESOURCE_PERMISSION = {
  institutions: 'catalogue.edit', programmes: 'catalogue.edit', courses: 'catalogue.edit', exams: 'catalogue.edit', scholarships: 'catalogue.edit',
  cities: 'locations.edit', states: 'locations.edit', career_fields: 'career.manage', counsellors: 'career.manage',
};
const resourceGuard = (request, response, next) => requirePermission(RESOURCE_PERMISSION[request.params.resource] ?? '__owner_only__')(request, response, next);
adminRouter.get('/resources', requirePermission('catalogue.edit', 'locations.edit', 'career.manage'), (request, response) => {
  const all = describeResources();
  response.json({ resources: Object.fromEntries(Object.entries(all).filter(([name]) => can(request.admin, RESOURCE_PERMISSION[name] ?? '__owner_only__'))) });
});

adminRouter.get('/students', requirePermission('students.manage'), async (request, response) => response.json(await listStudents(request.query)));
adminRouter.post('/students/assignments/bulk', requirePermission('students.manage'), async (request, response) => response.json(await bulkAssignStudents(COLLECTIONS.students, request.body)));
adminRouter.patch('/students/:id', requirePermission('students.manage'), async (request, response) => response.json({ item: await updateStudent(request.params.id, request.body) }));
adminRouter.patch('/students/:id/assignments', requirePermission('students.manage'), async (request, response) => response.json({ item: await assignStudent(request.params.id, request.body) }));

// Older "Add employee" screen: the same data as the Team & access page, kept for existing clients.
adminRouter.get('/employees', requirePermission('team.view', 'team.manage'), async (_request, response) => {
  const items = (await listStaff()).filter((staff) => staff.roleId !== 'owner');
  response.json({ items: items.map((item) => ({ ...item, mustChangePassword: item.mustChangePassword })) });
});
adminRouter.post('/employees', requirePermission('team.manage'), async (request, response) => {
  response.status(201).json({ item: await createStaff(request.admin, { ...request.body, roleId: request.body?.roleId || 'executive' }) });
});

adminRouter.get('/:resource', resourceGuard, async (request, response) => response.json(await listItems(request.params.resource, request.query)));
adminRouter.post('/:resource', resourceGuard, async (request, response) => response.status(201).json({ item: await createItem(request.params.resource, request.body) }));
// Declared before /:resource/:id so "stats" and "bulk" are never read as record ids.
adminRouter.get('/:resource/stats', resourceGuard, async (request, response) => response.json(await resourceStats(request.params.resource)));
adminRouter.post('/:resource/bulk', resourceGuard, async (request, response) => response.json(await bulkItems(request.params.resource, request.body)));
adminRouter.get('/:resource/:id', resourceGuard, async (request, response) => response.json({ item: await getItem(request.params.resource, request.params.id) }));
adminRouter.patch('/:resource/:id', resourceGuard, async (request, response) => response.json({ item: await updateItem(request.params.resource, request.params.id, request.body) }));
adminRouter.delete('/:resource/:id', resourceGuard, async (request, response) => {
  await deleteItem(request.params.resource, request.params.id);
  response.status(204).end();
});
