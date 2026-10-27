import { Router } from 'express';
import { requireAdmin, requireOwnerAdmin, requireReadyStaff } from '../../middleware/auth.js';
import { collection, COLLECTIONS } from '../../db/collections.js';
import { hashPassword } from '../../lib/password.js';
import { HttpError } from '../../lib/http-error.js';
import { assertValid } from '../../lib/validation.js';
import { assertEmployeePassword } from '../admin-auth/password-policy.js';
import { getDashboard } from './dashboard.js';
import { describeResources } from './resources.js';
import { createItem, deleteItem, getItem, listItems, updateItem } from './resource-service.js';
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

adminRouter.use('/reference-students', referenceStudentsRouter);
adminRouter.use('/account-students', accountStudentsRouter);
adminRouter.use('/leads', leadsRouter);
adminRouter.use(requireOwnerAdmin);

adminRouter.use('/data-ops', dataOpsRouter);
adminRouter.use('/media', mediaRouter);
adminRouter.use('/content', adminContentRouter);
adminRouter.use('/insights', adminInsightsRouter);
adminRouter.use('/drives', drivesRouter);
adminRouter.get('/dashboard', async (_request, response) => response.json(await getDashboard()));
adminRouter.get('/resources', (_request, response) => response.json({ resources: describeResources() }));

adminRouter.get('/students', async (request, response) => response.json(await listStudents(request.query)));
adminRouter.post('/students/assignments/bulk', async (request, response) => response.json(await bulkAssignStudents(COLLECTIONS.students, request.body)));
adminRouter.patch('/students/:id', async (request, response) => response.json({ item: await updateStudent(request.params.id, request.body) }));
adminRouter.patch('/students/:id/assignments', async (request, response) => response.json({ item: await assignStudent(request.params.id, request.body) }));

adminRouter.get('/employees', async (_request, response) => {
  const employees = await (await collection(COLLECTIONS.admins)).find({ role: 'employee' }, { projection: { passwordHash: 0 } }).sort({ createdAt: -1 }).toArray();
  response.json({ items: employees.map((item) => ({ id: item._id.toString(), email: item.email, phone: item.phone, mustChangePassword: item.mustChangePassword, createdAt: item.createdAt, lastLoginAt: item.lastLoginAt })) });
});
adminRouter.post('/employees', async (request, response) => {
  const { email, phone } = assertValid([
    { name: 'email', type: 'email', required: true },
    { name: 'phone', type: 'string', required: true, maxLength: 20 },
  ], request.body);
  if (!/^\+?[0-9]{10,15}$/.test(phone)) throw new HttpError(400, 'Enter a valid mobile number', { fields: { phone: 'Use 10 to 15 digits, optionally starting with +.' } });
  const password = request.body?.password;
  assertEmployeePassword(password);
  const admins = await collection(COLLECTIONS.admins);
  const employee = { email, phone, role: 'employee', passwordHash: await hashPassword(password), mustChangePassword: true, createdAt: new Date(), lastLoginAt: null };
  try { await admins.insertOne(employee); }
  catch (error) {
    if (error.code === 11000) throw new HttpError(409, 'An account with this email already exists', { fields: { email: 'This email is already in use.' } });
    throw error;
  }
  response.status(201).json({ item: { id: employee._id.toString(), email, phone, mustChangePassword: true, createdAt: employee.createdAt, lastLoginAt: null } });
});

adminRouter.get('/:resource', async (request, response) => response.json(await listItems(request.params.resource, request.query)));
adminRouter.post('/:resource', async (request, response) => response.status(201).json({ item: await createItem(request.params.resource, request.body) }));
adminRouter.get('/:resource/:id', async (request, response) => response.json({ item: await getItem(request.params.resource, request.params.id) }));
adminRouter.patch('/:resource/:id', async (request, response) => response.json({ item: await updateItem(request.params.resource, request.params.id, request.body) }));
adminRouter.delete('/:resource/:id', async (request, response) => {
  await deleteItem(request.params.resource, request.params.id);
  response.status(204).end();
});
