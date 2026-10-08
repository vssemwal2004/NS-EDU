import { Router } from 'express';
import { getEducationNews } from '../services/education-news.js';

export function createEducationNewsRouter(loader = getEducationNews) {
  const router = Router();
  router.get('/', async (_request, response, next) => {
    try {
      const feed = await loader();
      response.set('Cache-Control', 'no-store');
      response.status(feed.status === 'unavailable' ? 503 : 200).json(feed);
    } catch (error) { next(error); }
  });
  return router;
}
export const educationNewsRouter = createEducationNewsRouter();
