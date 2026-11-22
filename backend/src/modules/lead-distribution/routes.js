import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.js';
import { checkIn, checkOut, distributionSettings, distributionStatus, updateDistributionSettings } from './service.js';

export const distributionRouter = Router();

distributionRouter.get('/status', async (request, response) => response.json(await distributionStatus(request.admin)));
distributionRouter.post('/check-in', async (request, response) => response.json(await checkIn(request.admin)));
distributionRouter.post('/check-out', async (request, response) => response.json(await checkOut(request.admin)));
distributionRouter.get('/settings', requirePermission('settings.manage'), async (_request, response) => response.json(await distributionSettings()));
distributionRouter.put('/settings', requirePermission('settings.manage'), async (request, response) => response.json(await updateDistributionSettings(request.admin, request.body)));
