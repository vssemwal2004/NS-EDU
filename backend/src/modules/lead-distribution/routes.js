import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.js';
import { attendanceHistory, checkIn, checkOut, distributionSettings, distributionStatus, myAttendance, updateDistributionSettings } from './service.js';

export const distributionRouter = Router();

distributionRouter.get('/status', async (request, response) => response.json(await distributionStatus(request.admin)));
// Light, read-only state for the top-bar check-in button (polled by every open tab).
distributionRouter.get('/me', async (request, response) => response.set('Cache-Control', 'no-store').json(await myAttendance(request.admin)));
distributionRouter.get('/history', async (request, response) => response.set('Cache-Control', 'no-store').json(await attendanceHistory(request.admin, { limit: request.query.limit })));
distributionRouter.post('/check-in', async (request, response) => response.json(await checkIn(request.admin)));
distributionRouter.post('/check-out', async (request, response) => response.json(await checkOut(request.admin)));
distributionRouter.get('/settings', requirePermission('settings.manage'), async (_request, response) => response.json(await distributionSettings()));
distributionRouter.put('/settings', requirePermission('settings.manage'), async (request, response) => response.json(await updateDistributionSettings(request.admin, request.body)));
