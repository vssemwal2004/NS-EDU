import { Router } from 'express';
import { getDb } from '../db/collections.js';

export const healthRouter = Router();
healthRouter.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });

// Liveness: the process is up (used by container restarts). Never touches the database.
healthRouter.get('/', (_request, response) => {
  response.json({ status: 'ok', service: 'nsedu-api' });
});

// Readiness: the API can serve traffic (used by load balancers before routing to an instance).
healthRouter.get('/ready', async (_request, response) => {
  try {
    const started = Date.now();
    await (await getDb()).command({ ping: 1 });
    response.json({ status: 'ready', database: 'ok', latencyMs: Date.now() - started, uptimeSeconds: Math.round(process.uptime()) });
  } catch (error) {
    response.status(503).json({ status: 'unavailable', database: error.message?.startsWith('Set MONGODB_URI') ? 'not configured' : 'unreachable' });
  }
});
