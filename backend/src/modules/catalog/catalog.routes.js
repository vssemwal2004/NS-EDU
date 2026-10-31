import { Router } from 'express';
import { loadViewer } from '../../middleware/auth.js';
import { freeViewLimit } from '../universities/free-preview.js';
import { courseOfferings } from './course-offerings.js';
import { listColleges,listCourses, listExams, listLocations, listScholarships, platformStats, searchCatalog } from './catalog-service.js';

const noStore = (_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
};

export const catalogRouter = Router();
catalogRouter.use(noStore);
catalogRouter.get('/courses', async (_request, response) => response.json({ items: await listCourses() }));
// Fee spread and counts are public; the named institutions need a student or staff session.
catalogRouter.get('/courses/:slug/offerings', async (request, response) => {
  response.json(await courseOfferings(request.params.slug, request.query, { withInstitutions: Boolean(await loadViewer(request)) }));
});
catalogRouter.get('/exams', async (_request, response) => response.json({ items: await listExams() }));
catalogRouter.get('/colleges', async (_request, response) => response.json({ items: await listColleges() }));
catalogRouter.get('/locations', async (_request, response) => response.json(await listLocations()));
catalogRouter.get('/scholarships', async (_request, response) => response.json({ items: await listScholarships() }));
// Course and exam matches are public. Signed out, university matches are limited to the free preview
// (the first few); `collegesLocked` counts the rest, which a login unlocks.
catalogRouter.get('/search', async (request, response) => {
  const result = await searchCatalog(request.query.q);
  if (await loadViewer(request)) { response.json(result); return; }
  const colleges = result.colleges.slice(0, freeViewLimit());
  const collegesLocked = result.colleges.length - colleges.length;
  response.json({ ...result, colleges, collegesLocked, collegesRequireLogin: collegesLocked > 0 });
});

export const platformRouter = Router();
platformRouter.use(noStore);
platformRouter.get('/stats', async (_request, response) => response.json(await platformStats()));
