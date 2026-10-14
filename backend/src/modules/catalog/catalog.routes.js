import { Router } from 'express';
import { listColleges, listCourses, listExams, listLocations, listScholarships, platformStats, searchCatalog } from './catalog-service.js';

const noStore = (_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
};

export const catalogRouter = Router();
catalogRouter.use(noStore);
catalogRouter.get('/courses', async (_request, response) => response.json({ items: await listCourses() }));
catalogRouter.get('/exams', async (_request, response) => response.json({ items: await listExams() }));
catalogRouter.get('/colleges', async (_request, response) => response.json({ items: await listColleges() }));
catalogRouter.get('/locations', async (_request, response) => response.json(await listLocations()));
catalogRouter.get('/scholarships', async (_request, response) => response.json({ items: await listScholarships() }));
catalogRouter.get('/search', async (request, response) => response.json(await searchCatalog(request.query.q)));

export const platformRouter = Router();
platformRouter.use(noStore);
platformRouter.get('/stats', async (_request, response) => response.json(await platformStats()));
