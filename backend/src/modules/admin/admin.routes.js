import { Router } from 'express';
import { requireAdmin } from '../../middleware/auth.js';
import { getDashboard } from './dashboard.js';
import { describeResources } from './resources.js';
import { createItem, deleteItem, getItem, listItems, updateItem } from './resource-service.js';
import { listStudents, updateStudent } from './students.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.use((_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

adminRouter.get('/dashboard', async (_request, response) => response.json(await getDashboard()));
adminRouter.get('/resources', (_request, response) => response.json({ resources: describeResources() }));

adminRouter.get('/students', async (request, response) => response.json(await listStudents(request.query)));
adminRouter.patch('/students/:id', async (request, response) => response.json({ item: await updateStudent(request.params.id, request.body) }));

adminRouter.get('/:resource', async (request, response) => response.json(await listItems(request.params.resource, request.query)));
adminRouter.post('/:resource', async (request, response) => response.status(201).json({ item: await createItem(request.params.resource, request.body) }));
adminRouter.get('/:resource/:id', async (request, response) => response.json({ item: await getItem(request.params.resource, request.params.id) }));
adminRouter.patch('/:resource/:id', async (request, response) => response.json({ item: await updateItem(request.params.resource, request.params.id, request.body) }));
adminRouter.delete('/:resource/:id', async (request, response) => {
  await deleteItem(request.params.resource, request.params.id);
  response.status(204).end();
});
