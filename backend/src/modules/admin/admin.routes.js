import { Router } from 'express';
import { requireAdmin, requireConfidentiality, requirePermission, requireReadyStaff } from '../../middleware/auth.js';
import { COLLECTIONS } from '../../db/collections.js';
import { accessRouter } from '../access/access.routes.js';
import { can, createStaff, listStaff } from '../access/access-service.js';
import { crmRouter } from '../crm/crm.routes.js';
import { getDashboard } from './dashboard.js';
import { homeSummary } from './home.js';
import { describeResources } from './resources.js';
import { bulkItems, createItem, deleteItem, getItem, listItems, resourceStats, updateItem } from './resource-service.js';
import { assignStudent, bulkDeleteStudentAccounts, bulkUpdateStudents, deleteStudentAccount, listStudents, updateStudent } from './students.js';
import { referenceStudentsRouter } from './reference-students.routes.js';
import { accountStudentsRouter } from './account-students.routes.js';
import { bulkAssignStudents } from './employee-assignments.js';
import { dataOpsRouter } from './data-ops.routes.js';
import { mediaRouter } from './media.routes.js';
import { leadsRouter } from '../applications/leads.routes.js';
import { adminContentRouter } from '../content/content.routes.js';
import { adminInsightsRouter } from './insights.routes.js';
import { drivesRouter } from '../drives/drives.routes.js';
import { adminReviewsRouter } from '../reviews/reviews.routes.js';
import { distributionRouter } from '../lead-distribution/routes.js';
import { adminPrivacyRouter } from '../privacy/privacy.routes.js';

export const adminRouter = Router();
// Every console route needs a session, a changed temporary password and the accepted confidentiality undertaking.
adminRouter.use(requireAdmin, requireReadyStaff, requireConfidentiality);
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
adminRouter.use('/lead-distribution', distributionRouter);

// Each area is mounted behind its `view` key; changes inside check create / edit / delete separately.
adminRouter.use('/data-ops', requirePermission('data.view'), dataOpsRouter);
// Image upload backs the image fields of every editor, so anyone who can edit those areas can use it
// (media.routes.js checks media.upload / media.edit / media.delete for the library's own actions).
adminRouter.use('/media', requirePermission('media.view', 'catalogue.edit', 'locations.edit', 'career.edit', 'content.edit'), mediaRouter);
adminRouter.use('/content', requirePermission('content.edit'), adminContentRouter);
// Student reviews: reviews.view / reviews.moderate / reviews.delete; site-content editors keep full access.
adminRouter.use('/reviews', requirePermission('reviews.view', 'content.edit'), adminReviewsRouter);
adminRouter.use('/insights', requirePermission('analytics.search'), adminInsightsRouter);
adminRouter.use('/drives', requirePermission('drives.view'), drivesRouter);
// DPDP privacy requests: requester contact details, matched leads and erasure. Owners only unless granted.
// Reading needs privacy.view (implied by privacy.manage); every change checks privacy.manage in the router.
adminRouter.use('/privacy', requirePermission('privacy.view', 'privacy.manage'), adminPrivacyRouter);
adminRouter.get('/dashboard', requirePermission('dashboard.view'), async (_request, response) => response.json(await getDashboard()));
// The console home: every signed-in staff member; each section follows their own permissions.
adminRouter.get('/home', async (request, response) => response.json(await homeSummary(request.admin)));

// Which permission module owns which generic editor. A resource not listed here stays owner-only.
// Reads need `<module>.view`, POST `.create`, PATCH and publish/unpublish `.edit`, DELETE and bulk delete `.delete`.
const RESOURCE_MODULE = {
  institutions: 'catalogue', programmes: 'catalogue', courses: 'catalogue', exams: 'catalogue', scholarships: 'catalogue',
  cities: 'locations', states: 'locations', career_fields: 'career', counsellors: 'career',
};
const resourceAction = (request) => {
  if (request.method === 'GET') return 'view';
  if (request.method === 'DELETE') return 'delete';
  if (request.method === 'PATCH') return 'edit';
  if (/\/bulk$/.test(request.path)) return request.body?.action === 'delete' ? 'delete' : 'edit';
  return 'create';
};
const resourceGuard = (request, response, next) => {
  const module = RESOURCE_MODULE[request.params.resource];
  requirePermission(module ? `${module}.${resourceAction(request)}` : '__owner_only__')(request, response, next);
};
adminRouter.get('/resources', requirePermission('catalogue.view', 'locations.view', 'career.view'), (request, response) => {
  const all = describeResources();
  response.json({ resources: Object.fromEntries(Object.entries(all).filter(([name]) => RESOURCE_MODULE[name] && can(request.admin, `${RESOURCE_MODULE[name]}.view`))) });
});

// Student sign-in accounts: accounts.view / accounts.edit (block, name) / accounts.assign / accounts.delete.
adminRouter.get('/students', requirePermission('accounts.view'), async (request, response) => response.json(await listStudents(request.query)));
adminRouter.post('/students/assignments/bulk', requirePermission('accounts.assign'), async (request, response) => response.json(await bulkAssignStudents(COLLECTIONS.students, request.body)));
adminRouter.post('/students/bulk', requirePermission('accounts.edit'), async (request, response) => response.json(await bulkUpdateStudents(request.body)));
adminRouter.post('/students/bulk-delete', requirePermission('accounts.delete'), async (request, response) => response.json(await bulkDeleteStudentAccounts(request.admin, request.body)));
adminRouter.patch('/students/:id', requirePermission('accounts.edit'), async (request, response) => response.json({ item: await updateStudent(request.params.id, request.body) }));
adminRouter.delete('/students/:id', requirePermission('accounts.delete'), async (request, response) => response.json(await deleteStudentAccount(request.admin, request.params.id)));
adminRouter.patch('/students/:id/assignments', requirePermission('accounts.assign'), async (request, response) => response.json({ item: await assignStudent(request.params.id, request.body) }));

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
